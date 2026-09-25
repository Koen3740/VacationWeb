/**
 * D-v2 S7 (owner GO 25-09 17:10, B4 30-08): page overlays registered via the existing
 * `scheduleResultsMatchsetLivePricing` (waitUntil) keep running after the Page-1
 * selection is final (cache warming), while the already produced response state
 * (selection, page1Ids output, CUT slot outcomes) never changes afterwards.
 * In-process only: local waitUntil is a no-op; Vercel behaviour is a S9 measurement point.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';
import type { TravelOffer } from '@/types/travel';
import {
  createPage1SettleController,
  resolvePage1SettleOutput,
  type PageSettleLiveOverlay,
} from '@/lib/search/page-settle';
import {
  awaitPendingResultsMatchsetLivePricingForTests,
  scheduleResultsMatchsetLivePricing,
} from '@/lib/search/schedule-results-matchset-live-pricing';
import {
  clearResultsLivePriceCache,
  getResultsLivePriceOverlay,
  setResultsLivePriceOverlay,
} from '@/lib/search/results-live-price-cache';
import { setLivePriceL2EnabledForTests } from '@/lib/search/live-price-l2-store';

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');
const params = { adults: 2 } as const;

afterEach(() => {
  clearResultsLivePriceCache();
  setLivePriceL2EnabledForTests(null);
});

function makeCatalog(id: string): TravelOffer {
  return {
    id,
    provider: 'Corendon',
    hotelName: `Hotel ${id}`,
    destinationCountry: 'Spanje',
    departureDate: '2026-08-27',
    nights: 8,
    flightIncluded: 'true',
    price: 458,
    pricePerDay: 57,
    imageUrl: 'https://example.com/a.jpg',
    deepLink: 'https://www.corendon.be/vakantie#9514.COSPY.BRUCFU.270826.3-4-3.SZ-U',
    livePriceStatus: 'catalog',
    livePriceSource: 'feed',
  } as TravelOffer;
}
function makeB(id: string): TravelOffer {
  return {
    ...makeCatalog(id),
    livePriceStatus: 'proven',
    livePriceSource: 'upsales',
    price: 717,
    pricePerDay: 90,
    liveTotalPrice: 1434,
    liveTotalPriceField: 'upsales.totalPrice',
  } as TravelOffer;
}

test('S7 T13: background overlay work continues after the final selection; response state unchanged', async () => {
  setLivePriceL2EnabledForTests(false);
  const slotOffers = [makeB('b1'), makeCatalog('late'), makeB('b2')];
  let resolveLate: (offer: TravelOffer) => void = () => {};
  const lateLive = new Promise<TravelOffer>((resolve) => {
    resolveLate = resolve;
  }).then((priced) => {
    // Real overlays write L1 (and L2 write-through) inside runXLiveIntoCache.
    setResultsLivePriceOverlay(priced.id, params, {
      price: priced.price,
      pricePerDay: priced.pricePerDay,
      livePriceStatus: 'proven',
      livePriceSource: 'upsales',
      liveTotalPrice: priced.liveTotalPrice,
      liveTotalPriceField: 'upsales.totalPrice',
    });
    return priced;
  });
  const overlays: PageSettleLiveOverlay[] = [
    { catalog: slotOffers[0]!, live: Promise.resolve(slotOffers[0]!), pending: false },
    { catalog: slotOffers[1]!, live: lateLive, pending: true },
    { catalog: slotOffers[2]!, live: Promise.resolve(slotOffers[2]!), pending: false },
  ];
  let fireDeadline: () => void = () => {};
  const controller = createPage1SettleController({
    slotOffers,
    overlays,
    pageSize: 10,
    scheduleDeadline: (onDeadline) => {
      fireDeadline = onDeadline;
      return () => {};
    },
  });

  // Section wiring (S7): register overlays as background work (waitUntil, no await).
  let backgroundDone = false;
  scheduleResultsMatchsetLivePricing(
    Promise.allSettled(overlays.map((overlay) => overlay.live)).then((settled) => {
      backgroundDone = true;
      return settled;
    }),
  );

  fireDeadline();
  const selection = await controller.selection;
  const lateOutcome = await controller.slotOutcome('late');
  const outputBefore = resolvePage1SettleOutput({ result: selection, browseTotal: 2, pageSize: 10 });
  const snapshot = JSON.stringify({ selection, outputBefore, lateOutcome });
  assert.equal(selection.status, 'DEADLINE');
  assert.deepEqual(selection.selectedIds, ['b1', 'b2']);
  assert.equal(lateOutcome, null, 'CUT: the late slot has no card in the sent response');
  assert.equal(backgroundDone, false, 'background still running after the response state is final');

  // Late live result arrives after the response: background finishes and warms L1.
  resolveLate(makeB('late'));
  await awaitPendingResultsMatchsetLivePricingForTests();
  assert.equal(backgroundDone, true, 'registered overlay work ran to completion');
  assert.equal(getResultsLivePriceOverlay('late', params)?.price, 717, 'cache warmed (L1)');

  // Response state never changes afterwards.
  const lateOutcomeAfter = await controller.slotOutcome('late');
  const outputAfter = resolvePage1SettleOutput({ result: await controller.selection, browseTotal: 2, pageSize: 10 });
  assert.equal(lateOutcomeAfter, null);
  assert.equal(controller.current(), selection, 'same final selection object');
  assert.equal(JSON.stringify({ selection: controller.current(), outputBefore: outputAfter, lateOutcome: lateOutcomeAfter }), snapshot);
});

test('S7: a rejected overlay never breaks the background registration (allSettled)', async () => {
  let done = false;
  scheduleResultsMatchsetLivePricing(
    Promise.allSettled([Promise.reject(new Error('provider down')), Promise.resolve(1)]).then(() => {
      done = true;
    }),
  );
  await awaitPendingResultsMatchsetLivePricingForTests();
  assert.equal(done, true);
});

test('S7 source: overlays registered via the existing waitUntil scheduler; no new UI after response', () => {
  const section = read('components/results/catalog-live-section.tsx');
  assert.match(
    section,
    /scheduleResultsMatchsetLivePricing\(Promise\.allSettled\(overlays\.map\(\(overlay\) => overlay\.live\)\)\);/,
  );
  // Registration is fire-and-forget: never awaited by the render.
  assert.doesNotMatch(section, /await scheduleResultsMatchsetLivePricing/);
  const scheduler = read('lib/search/schedule-results-matchset-live-pricing.ts');
  assert.match(scheduler, /waitUntil\(tracked\)/);
  assert.match(section, /scheduleCappedMatchsetLiveAfterPage\(filtered/);
});
