/**
 * D-v2 hasMore (owner decision 25-09-2026 18:50, closes A-39):
 * hasMore = there are currently MORE presentable B offers available than can be shown on
 * the current page. B counts; A, C and Pending do NOT count. pageSize 10: 0-10 B -> false,
 * > 10 B -> true. Page 2+: same B-only semantics within the valid paginated presentable
 * pool (page1Ids exclusion/freeze respected). Pure; no I/O, no server.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import type { TravelOffer } from '@/types/travel';
import { resultsHasMore, RESULTS_MAX_BROWSE_PAGES } from '@/lib/search/pagination';
import { bookableResultsMembership } from '@/lib/search/results-catalog-page';
import { selectBrowsePageWithPage1Freeze } from '@/lib/search/page1-freeze-repair';
import {
  createPage1SettleController,
  page1HasMore,
  pendingSlotIdsForSettle,
  resolvePage1SettleOutput,
  settlePageSelection,
  type PageSettleResult,
} from '@/lib/search/page-settle';
import type { Page1RenderSlot } from '@/lib/search/page1-visible-cards';

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');
const CAP = 150;

function makeCatalog(id: string, overrides: Partial<TravelOffer> = {}): TravelOffer {
  return {
    id,
    provider: 'Corendon',
    hotelName: `Hotel ${id}`,
    destinationCountry: 'Spanje',
    destinationRegion: 'Mallorca',
    departureDate: '2026-08-27',
    nights: 8,
    flightIncluded: 'true',
    price: 458,
    pricePerDay: 57,
    imageUrl: 'https://example.com/a.jpg',
    deepLink: 'https://www.corendon.be/vakantie#9514.COSPY.BRUCFU.270826.3-4-3.SZ-U',
    livePriceStatus: 'catalog',
    livePriceSource: 'feed',
    ...overrides,
  };
}
const makeB = (id: string) =>
  makeCatalog(id, {
    livePriceStatus: 'proven',
    livePriceSource: 'upsales',
    price: 717,
    pricePerDay: 90,
    liveTotalPrice: 1434,
    liveTotalPriceField: 'upsales.totalPrice',
  });
const makeA = (id: string) =>
  makeCatalog(id, { livePriceStatus: 'unavailable', livePriceFailureReason: 'http_204' });
const makeC = (id: string) =>
  makeCatalog(id, { livePriceStatus: 'unavailable', livePriceFailureReason: 'timeout' });
const makePending = (id: string) => makeCatalog(id);
const seq = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`);
const ids = (offers: readonly TravelOffer[]) => offers.map((offer) => offer.id);

/** Page-1 settle output for a slot list, B pool counted with the production B predicate. */
function page1Output(slots: Page1RenderSlot[], pool: TravelOffer[], deadlineReached: boolean) {
  const result = settlePageSelection({ slots, deadlineReached, pageSize: 10 });
  const browseTotal = bookableResultsMembership(pool).length;
  return {
    result,
    output: resolvePage1SettleOutput({ result, browseTotal, pageSize: 10 }),
  };
}
const immediate = (offer: TravelOffer): Page1RenderSlot => ({ kind: 'immediate', offer });
const pendingSlot = (id: string): Page1RenderSlot => ({ kind: 'pending', catalogOffer: makePending(id) });

test('hasMore page 1: 0 / 9 / 10 B -> false, 11 B -> true (pageSize 10)', () => {
  for (const [n, expected] of [[0, false], [9, false], [10, false], [11, true]] as const) {
    assert.equal(resultsHasMore({ presentableCount: n, windowEnd: 10, page: 1 }), expected, `${n} B`);
    const pool = seq('B', n).map(makeB);
    const { result, output } = page1Output(pool.map(immediate), pool, false);
    assert.equal(page1HasMore(output, 10), expected, `settled page 1 with ${n} B (${result.status})`);
  }
});

test('hasMore: A, C and Pending are not counted (only B in the presentable pool)', () => {
  const mixed10 = [
    ...seq('B', 10).map(makeB),
    ...seq('A', 5).map(makeA),
    ...seq('C', 5).map(makeC),
    ...seq('P', 5).map(makePending),
  ];
  assert.equal(bookableResultsMembership(mixed10).length, 10, 'B-only pool');
  const r10 = page1Output(mixed10.map(immediate), mixed10, false);
  assert.equal(r10.result.status, 'READY');
  assert.equal(page1HasMore(r10.output, 10), false, '10 B + 15 A/C/Pending -> false');

  const mixed11 = [...mixed10, makeB('B11')];
  const r11 = page1Output(mixed11.map(immediate), mixed11, false);
  assert.equal(page1HasMore(r11.output, 10), true, '11 B -> true');

  // Pending slots behind 10 B never make hasMore true by themselves.
  const withPending = [...seq('B', 10).map(makeB).map(immediate), ...seq('P', 30).map(pendingSlot)];
  const rp = page1Output(withPending, seq('B', 10).map(makeB), false);
  assert.equal(rp.result.status, 'READY');
  assert.equal(page1HasMore(rp.output, 10), false, '10 B + 30 pending -> false');
});

test('hasMore page 2+: B beyond the current window within the page1Ids-excluded pool', () => {
  const page1 = seq('F', 10);
  const hasMoreFor = (remainingN: number, page: number) => {
    const browsable = [...page1, ...seq('R', remainingN)].map(makeB);
    const sel = selectBrowsePageWithPage1Freeze({ browsable, page1Ids: page1, page, pageSize: 10, browseCap: CAP });
    // Same composition as catalog-live-page-state (page N shows remaining[(N-2)*10, (N-1)*10)).
    return {
      offers: ids(sel.offers),
      hasMore: resultsHasMore({ presentableCount: sel.remaining.length, windowEnd: (page - 1) * 10, page }),
    };
  };
  assert.equal(hasMoreFor(11, 2).hasMore, true, 'page 2, 11 remaining B -> true');
  assert.equal(hasMoreFor(10, 2).hasMore, false, 'page 2, exactly 10 remaining B -> false');
  assert.equal(hasMoreFor(5, 2).hasMore, false, 'page 2, 5 remaining B -> false');
  assert.equal(hasMoreFor(21, 3).hasMore, true, 'page 3, 21 remaining -> true');
  assert.equal(hasMoreFor(20, 3).hasMore, false, 'page 3, 20 remaining -> false');
  assert.ok(!hasMoreFor(11, 2).offers.some((id) => page1.includes(id)), 'page-1 ids excluded');
  // Page-1 ids that are no longer B do not count; A/C/Pending never enter the pool.
  const pool = bookableResultsMembership([
    ...page1.map(makeB), ...seq('R', 10).map(makeB), ...seq('C', 8).map(makeC), ...seq('P', 8).map(makePending),
  ]);
  const sel = selectBrowsePageWithPage1Freeze({ browsable: pool, page1Ids: page1, page: 2, pageSize: 10, browseCap: CAP });
  assert.equal(resultsHasMore({ presentableCount: sel.remaining.length, windowEnd: 10, page: 2 }), false);
  // Browse cap: last browsable page never reports more.
  assert.equal(resultsHasMore({ presentableCount: 1000, windowEnd: 150, page: RESULTS_MAX_BROWSE_PAGES }), false);
});

test('hasMore consistency with option d / DEADLINE / DEADLINE_EMPTY (DEADLINE_EMPTY: no pagination)', async () => {
  // DEADLINE_EMPTY: 0 B shown, even with B elsewhere in the pool -> no pagination, hasMore false.
  const empty = settlePageSelection({ slots: seq('P', 5).map(pendingSlot), deadlineReached: true, pageSize: 10 });
  assert.equal(empty.status, 'DEADLINE_EMPTY');
  const emptyOut = resolvePage1SettleOutput({ result: empty, browseTotal: 25, pageSize: 10 });
  assert.equal(emptyOut.showPagination, false);
  assert.equal(page1HasMore(emptyOut, 10), false);

  // DEADLINE with 1-9 B (anchor): hasMore follows the B pool only.
  const anchorSlots = [...seq('B', 7).map(makeB).map(immediate), pendingSlot('P1')];
  const anchor = settlePageSelection({ slots: [pendingSlot('P0'), ...anchorSlots], deadlineReached: true, pageSize: 10 });
  assert.equal(anchor.status, 'DEADLINE');
  assert.equal(page1HasMore(resolvePage1SettleOutput({ result: anchor, browseTotal: 7, pageSize: 10 }), 10), false);
  assert.equal(page1HasMore(resolvePage1SettleOutput({ result: anchor, browseTotal: 12, pageSize: 10 }), 10), true);

  // Option d: 10+ B behind an earlier pending rank; no page1Ids written; hasMore = B pool > 10.
  const optD: Page1RenderSlot[] = [pendingSlot('P0'), ...seq('B', 12).map(makeB).map(immediate)];
  const d = settlePageSelection({ slots: optD, deadlineReached: true, pageSize: 10 });
  assert.equal(d.status, 'DEADLINE');
  const dOut = resolvePage1SettleOutput({ result: d, browseTotal: 12, pageSize: 10 });
  assert.deepEqual(dOut.page1Ids, [], 'option d writes no page1Ids');
  assert.equal(page1HasMore(dOut, 10), true, '12 B -> true');
  const d10: Page1RenderSlot[] = [pendingSlot('P0'), ...seq('B', 10).map(makeB).map(immediate)];
  const d10r = settlePageSelection({ slots: d10, deadlineReached: true, pageSize: 10 });
  assert.equal(page1HasMore(resolvePage1SettleOutput({ result: d10r, browseTotal: 10, pageSize: 10 }), 10), false, '10 B + pending -> false');

  // COLLECTING (not final): no pagination yet.
  const collecting: PageSettleResult = settlePageSelection({ slots: optD, deadlineReached: false, pageSize: 10 });
  assert.equal(collecting.final, false);
  assert.equal(page1HasMore(resolvePage1SettleOutput({ result: collecting, browseTotal: 12, pageSize: 10 }), 10), false);

  // Controller path (as rendered): pending anchor output keeps the B-only rule.
  const p = makePending('PX');
  const controller = createPage1SettleController({
    slotOffers: [p, ...seq('B', 11).map(makeB)],
    overlays: [{ catalog: p, live: new Promise<TravelOffer>(() => {}), pending: true }],
    pageSize: 10,
    scheduleDeadline: (fire) => { setTimeout(fire, 0); return () => {}; },
  });
  const sel = await controller.selection;
  const out = resolvePage1SettleOutput({
    result: sel, browseTotal: 11, pageSize: 10, pendingIds: pendingSlotIdsForSettle(sel, controller.slotOffers),
  });
  assert.equal(page1HasMore(out, 10), true);
});

test('hasMore source: wired through page state, section, stream and pagination UI only', () => {
  const ui = read('components/results/results-pagination.tsx');
  // Page count is browse-cap stable (1–15); hasMore is data attribute only (not page growth).
  assert.match(ui, /getResultsBrowsePageCount/);
  assert.match(ui, /data-has-more=\{hasMore \? 'true' : 'false'\}/);
  assert.match(ui, /const hasNext = currentPage < totalPages;/);
  const stream = read('components/results/page1-receipt-stream.tsx');
  assert.match(stream, /hasMore=\{page1HasMore\(output, page1Settle\.pageSize\)\}/);
  const section = read('components/results/catalog-live-section.tsx');
  assert.match(section, /hasMore=\{state\.hasMore\}/);
  const state = read('lib/search/catalog-live-page-state.ts');
  assert.match(state, /presentableCount: remainingPage\.remaining\.length/);
  for (const forbidden of [/pendingRanks\.length/, /matchset\b.*hasMore/]) {
    assert.doesNotMatch(read('lib/search/pagination.ts').split('export function resultsHasMore')[1]!.slice(0, 600), forbidden);
  }
});
