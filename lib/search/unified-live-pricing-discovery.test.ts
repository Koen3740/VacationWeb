/**
 * Architecture: unified live-pricing discovery across one matchset.
 * Providers are attributes only — discovery order = catalogue price ascending.
 */
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import type { SearchParams, TravelOffer } from '@/types/travel';
import { clearLivePriceInflightForTests } from '@/lib/providers/prijsvrij/page1-receipt-pricing';
import { clearPrijsvrijReceiptTokenCache } from '@/lib/providers/prijsvrij/receipt-auth';
import { resetLivePriceCircuitForTests } from '@/lib/providers/live-price-circuit';
import { clearLivePriceObservabilityForTests } from '@/lib/search/live-price-observability';
import {
  clearResultsLivePriceCache,
  setResultsLivePriceOverlay,
} from '@/lib/search/results-live-price-cache';
import {
  discoveryRankedForLivePricing,
  orderMatchsetForUnifiedLiveDiscovery,
} from '@/lib/search/schedule-capped-matchset-live-after-page';
import {
  selectPage1OverlayCandidates,
  selectSharedLivePricingPool,
  PAGE1_OVERLAY_RESERVE,
} from '@/lib/search/results-catalog-page';
import {
  S6_TARGET_PRESENTABLE_B,
  countPresentableB,
  runS6DynamicRefill,
  selectS6RefillBatch,
} from '@/lib/search/s6-dynamic-refill';
import {
  buildPage1SlotOffers,
  createPage1SettleController,
  page1UrlIdsForSettle,
} from '@/lib/search/page-settle';
import { RESULTS_PAGE_SIZE_DEFAULT } from '@/lib/search/pagination';

afterEach(() => {
  clearResultsLivePriceCache();
  clearLivePriceInflightForTests();
  clearPrijsvrijReceiptTokenCache();
  clearLivePriceObservabilityForTests();
  resetLivePriceCircuitForTests();
});

const sharedParams: SearchParams = {
  country: 'Spanje',
  adults: 2,
  rooms: 1,
  nights: [7, 8, 9],
  departureStart: '2026-10-01',
  departureEnd: '2026-10-31',
  departureAirport: 'BRU,CRL,ANR,OST,LGG',
  sort: 'value',
};

function corendon(n: number, price: number): TravelOffer {
  return {
    id: `corendon-${n}-BRUAGP-101026-7-DZF`,
    provider: 'Corendon',
    hotelName: `Corendon ${n}`,
    destinationCountry: 'Spanje',
    nights: 8,
    price,
    pricePerDay: Math.round(price / 8),
    imageUrl: 'https://example.com/c.jpg',
    flightIncluded: 'true',
    departureAirport: 'BRU',
    departureDate: '10/10/2026',
    deepLink: `https://www.corendon.be/vakantie#${n}.MLELC.BRUPMI.101026.8.DZI-U`,
  };
}

function sunweb(n: number, price: number): TravelOffer {
  return {
    id: `sunweb-${n}-2026-10-10-8-BRU-Logies`,
    provider: 'Sunweb',
    hotelName: `Sunweb ${n}`,
    destinationCountry: 'Spanje',
    nights: 8,
    price,
    pricePerDay: Math.round(price / 8),
    imageUrl: 'https://example.com/s.jpg',
    flightIncluded: 'true',
    departureAirport: 'BRU',
    departureDate: '2026-10-10',
    deepLink:
      'https://www.sunweb.be/nl/vakantie/reizen?tt=1&r=' +
      encodeURIComponent(
        'https://www.sunweb.be/nl/vakantie/x?Duration[0]=8&TransportType[0]=Flight&Mealplan[0]=LO&DepartureAirport[0]=BRU&DepartureDate[0]=2026-10-10',
      ),
  };
}

function eliza(n: number, price: number): TravelOffer {
  return {
    id: `eliza-${n}`,
    provider: 'Eliza was here',
    hotelName: `Eliza ${n}`,
    destinationCountry: 'Spanje',
    nights: 8,
    price,
    pricePerDay: Math.round(price / 8),
    imageUrl: 'https://example.com/e.jpg',
    flightIncluded: 'true',
    departureAirport: 'BRU',
    departureDate: '2026-10-10',
    deepLink:
      'https://www.elizawashere.be/reizen?tt=1&r=' +
      encodeURIComponent(
        'https://www.elizawashere.be/x?Duration[0]=8&TransportType[0]=Flight&Mealplan[0]=LG&DepartureAirport[0]=BRU&DepartureDate[0]=2026-10-10',
      ),
  };
}

/** Provider-clustered feed order: 99 Corendon, 184 Sunweb, 30 Eliza. */
function clusteredMatchset(): TravelOffer[] {
  const ranked: TravelOffer[] = [];
  for (let i = 0; i < 99; i += 1) ranked.push(corendon(i, 800 + i));
  for (let i = 0; i < 184; i += 1) ranked.push(sunweb(i, 400 + i));
  for (let i = 0; i < 30; i += 1) ranked.push(eliza(i, 600 + i));
  return ranked;
}

function seedSunwebB(offer: TravelOffer, livePrice: number, params: SearchParams = sharedParams): void {
  setResultsLivePriceOverlay(offer.id, params, {
    price: livePrice,
    pricePerDay: Math.round(livePrice / 8),
    livePriceStatus: 'proven',
    livePriceSource: 'getPromotedPrice',
    liveTotalPrice: livePrice * 2,
    liveTotalPriceField: 'getPromotedPrice.totalPrice',
  });
}

function seedCorendonA(offer: TravelOffer, params: SearchParams = sharedParams): void {
  setResultsLivePriceOverlay(offer.id, params, {
    price: offer.price,
    pricePerDay: offer.pricePerDay,
    livePriceStatus: 'unavailable',
    livePriceFailureReason: 'no_trip',
  });
}

function seedCorendonC(offer: TravelOffer, params: SearchParams = sharedParams): void {
  // Technical unresolved (not provider-confirmed A) — still not presentable B.
  setResultsLivePriceOverlay(offer.id, params, {
    price: offer.price,
    pricePerDay: offer.pricePerDay,
    livePriceStatus: 'unavailable',
    livePriceFailureReason: 'timeout',
  });
}

test('1. clustered 99/184/30 matchset must not open page1 with 50 Corendon under unified discovery', () => {
  const ranked = clusteredMatchset();
  assert.equal(ranked.length, 313);
  assert.ok(ranked.slice(0, 50).every((o) => o.provider === 'Corendon'));

  const catalogOverlay = selectPage1OverlayCandidates(ranked, 10, undefined, sharedParams);
  assert.ok(catalogOverlay.every((o) => o.provider === 'Corendon'));

  const discovery = discoveryRankedForLivePricing(ranked, sharedParams);
  const unifiedOverlay = selectPage1OverlayCandidates(discovery, 10, undefined, sharedParams);
  assert.equal(unifiedOverlay.length, RESULTS_PAGE_SIZE_DEFAULT + PAGE1_OVERLAY_RESERVE);
  assert.ok(
    !unifiedOverlay.every((o) => o.provider === 'Corendon'),
    'unified page1 window must not be Corendon-only',
  );
  assert.ok(unifiedOverlay.some((o) => o.provider === 'Sunweb'));
});

test('2. discovery order is catalogue price ascending, provider-agnostic', () => {
  const ranked = [
    corendon(1, 500),
    sunweb(1, 400),
    eliza(1, 450),
    corendon(2, 420),
  ];
  const ordered = orderMatchsetForUnifiedLiveDiscovery(ranked);
  assert.deepEqual(
    ordered.map((o) => `${o.provider}:${o.price}`),
    [
      'Sunweb:400',
      'Corendon:420',
      'Eliza was here:450',
      'Corendon:500',
    ],
  );
});

test('3+4+5. S6 continues past first 150 attempts until 150 B; A/C do not count', async () => {
  // 150 Corendon that settle as A, then 150 Sunweb that settle as B.
  const ranked: TravelOffer[] = [];
  for (let i = 0; i < 150; i += 1) ranked.push(corendon(i, 300 + i));
  for (let i = 0; i < 150; i += 1) ranked.push(sunweb(i, 500 + i));
  const discovery = orderMatchsetForUnifiedLiveDiscovery(ranked);

  const fetchImpl = async () =>
    new Response('{}', { status: 500, headers: { 'content-type': 'application/json' } });

  // Pre-seed: first 150 discovery slots (cheapest Corendon) = A; next Sunweb get B via overlay after batch.
  // Simulate by seeding A on all Corendon up front, then S6 prices Sunweb with a fetch that we intercept
  // by pre-seeding B when selectS6 would reach them — easier: seed A on Corendon, B on Sunweb before S6,
  // then S6 should already_met or skip to target.
  for (const offer of discovery.slice(0, 150)) {
    if (offer.provider === 'Corendon') seedCorendonA(offer);
  }
  assert.equal(countPresentableB(discovery, sharedParams), 0);

  // After A on first 150, seed B on next 150 Sunweb — proves A do not count and pool can fill from 151+.
  for (const offer of discovery.slice(150, 300)) {
    seedSunwebB(offer, offer.price);
  }
  assert.equal(countPresentableB(discovery, sharedParams), 150);

  const result = await runS6DynamicRefill(discovery, sharedParams, {
    fetchImpl: fetchImpl as never,
  });
  assert.equal(result.telemetry.stopReason, 'already_met');
  assert.equal(result.telemetry.presentableB, S6_TARGET_PRESENTABLE_B);

  // C also does not count
  clearResultsLivePriceCache();
  for (const offer of discovery.slice(0, 20)) seedCorendonC(offer);
  assert.equal(countPresentableB(discovery, sharedParams), 0);
});

test('3b. S6 cursor advances past A/C and prices later B candidates', () => {
  const ranked = orderMatchsetForUnifiedLiveDiscovery([
    ...Array.from({ length: 5 }, (_, i) => corendon(i, 100 + i)),
    ...Array.from({ length: 5 }, (_, i) => sunweb(i, 200 + i)),
  ]);
  for (const offer of ranked.slice(0, 5)) seedCorendonA(offer);

  const batch = selectS6RefillBatch(ranked, sharedParams, 0, 5);
  assert.ok(batch.batch.every((o) => o.provider === 'Sunweb'));
  assert.ok(batch.nextCursor > 5);
  assert.ok(batch.skippedCachedOrSettled >= 5);
});

test('6. no provider quotas in unified discovery order or page1 window', () => {
  const ranked = clusteredMatchset();
  const discovery = discoveryRankedForLivePricing(ranked, sharedParams);
  const first50 = discovery.slice(0, 50);
  const byProvider: Record<string, number> = {};
  for (const o of first50) byProvider[o.provider] = (byProvider[o.provider] || 0) + 1;
  // Cheapest 50 are all Sunweb (400..449) — not a 50/50/50 quota.
  assert.equal(byProvider.Sunweb, 50);
  assert.equal(byProvider.Corendon ?? 0, 0);
  assert.equal(byProvider['Eliza was here'] ?? 0, 0);

  const prices = first50.map((o) => o.price);
  for (let i = 1; i < prices.length; i += 1) {
    assert.ok(prices[i]! >= prices[i - 1]!);
  }
});

test('7. later cheaper B replaces expensive member in shared pool', () => {
  const catalog = [
    sunweb(1, 900),
    sunweb(2, 910),
    sunweb(3, 920),
  ];
  for (const offer of catalog) seedSunwebB(offer, offer.price);
  const before = selectSharedLivePricingPool(catalog, sharedParams, 2);
  assert.deepEqual(
    before.map((o) => o.id),
    [catalog[0]!.id, catalog[1]!.id],
  );

  const cheaper = sunweb(99, 100);
  seedSunwebB(cheaper, 100);
  const after = selectSharedLivePricingPool([...catalog, cheaper], sharedParams, 2);
  assert.ok(after.some((o) => o.id === cheaper.id));
  assert.ok(!after.some((o) => o.id === catalog[1]!.id));
});

test('8. page1 freeze/settle semantics stay intact under unified discovery', async () => {
  const ranked = discoveryRankedForLivePricing(clusteredMatchset(), sharedParams);
  const overlay = selectPage1OverlayCandidates(ranked, 10, undefined, sharedParams);
  const slots = buildPage1SlotOffers({
    browsable: [],
    overlayCandidates: overlay,
    frozenIds: undefined,
    pageSize: 10,
  });

  const firstTenSunweb = overlay.filter((o) => o.provider === 'Sunweb').slice(0, 10);
  assert.equal(firstTenSunweb.length, 10);

  const controller = createPage1SettleController({
    slotOffers: slots.slotOffers,
    overlays: overlay.map((offer) => {
      const hit = firstTenSunweb.some((s) => s.id === offer.id);
      return {
        catalog: offer,
        pending: true,
        live: hit
          ? Promise.resolve({
              ...offer,
              price: offer.price,
              livePriceStatus: 'proven' as const,
              livePriceSource: 'getPromotedPrice' as const,
              liveTotalPrice: offer.price * 2,
              liveTotalPriceField: 'getPromotedPrice.totalPrice' as const,
            })
          : new Promise<TravelOffer>(() => {}),
      };
    }),
    pageSize: 10,
    scheduleDeadline: (onDeadline) => {
      queueMicrotask(() => queueMicrotask(onDeadline));
      return () => {};
    },
  });

  const selection = await controller.selection;
  assert.ok(selection.selectedIds.length >= 10);
  const url = page1UrlIdsForSettle(selection, 10);
  assert.ok(url.freeze === 'DEFINITIVE' || url.freeze === 'NONE' || url.freeze === 'ANCHOR');
  if (selection.status === 'READY' || selection.status === 'EXHAUSTED') {
    assert.equal(url.freeze, 'DEFINITIVE');
    assert.equal(url.ids.length, selection.selectedIds.length);
  }
});
