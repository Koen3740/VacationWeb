/**
 * D-v2 S5 (owner GO 25-09 17:10): Page 2+ exclusion (Package 1), frozen Page-1 repair
 * with unknown anchors (GO10 amendment, review C), cold Page 2 redirect (Master Plan
 * r.706), paginationTotal growth (GO11). Plan tests T7-T9 and review C F1-F4.
 * Pure: no I/O, no provider calls, deadline via injected scheduler.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import type { TravelOffer } from '@/types/travel';
import {
  isFrozenPage1StatusUnknown,
  repairPage1FreezeOrder,
  selectBrowsePageWithPage1Freeze,
} from '@/lib/search/page1-freeze-repair';
import {
  buildPage1SlotOffers,
  coldPage2RedirectPage1Ids,
  createPage1SettleController,
  pendingSlotIdsForSettle,
  resolvePage1SettleOutput,
  settlePageSelection,
  type PageSettleLiveOverlay,
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
function makeB(id: string): TravelOffer {
  return makeCatalog(id, {
    livePriceStatus: 'proven',
    livePriceSource: 'upsales',
    price: 717,
    pricePerDay: 90,
    liveTotalPrice: 1434,
    liveTotalPriceField: 'upsales.totalPrice',
  });
}
const makeA = (id: string) =>
  makeCatalog(id, { livePriceStatus: 'unavailable', livePriceFailureReason: 'http_204' });
const makeC = (id: string) =>
  makeCatalog(id, { livePriceStatus: 'unavailable', livePriceFailureReason: 'timeout' });
const ids = (offers: readonly TravelOffer[]) => offers.map((offer) => offer.id);
const Bs = (names: string[]) => names.map(makeB);
const letters = (from: string, to: string) => {
  const out: string[] = [];
  for (let c = from.charCodeAt(0); c <= to.charCodeAt(0); c += 1) out.push(String.fromCharCode(c));
  return out;
};
const zs = (n: number) => Array.from({ length: n }, (_, i) => `Z${i + 1}`);

function manualDeadline() {
  let fire: () => void = () => {};
  return {
    schedule: (onDeadline: () => void) => {
      fire = onDeadline;
      return () => {};
    },
    fire: () => fire(),
  };
}

test('S5 classifier: B / A / C known; catalog-only (no live outcome yet) = unknown', () => {
  assert.equal(isFrozenPage1StatusUnknown(makeB('b')), false);
  assert.equal(isFrozenPage1StatusUnknown(makeA('a')), false);
  assert.equal(isFrozenPage1StatusUnknown(makeC('c')), false);
  assert.equal(isFrozenPage1StatusUnknown(makeCatalog('p')), true);
});

test('T7 unknown frozen anchor stays pending at its place; known absent anchor is dropped', () => {
  const pool = Bs(['A', 'C', 'D', 'E', 'X', 'Y']);
  const frozen = ['A', 'B', 'C', 'D', 'E'];
  const pending = repairPage1FreezeOrder({
    presentableOrdered: pool,
    frozenIds: frozen,
    pageSize: 10,
    pendingFrozen: new Map([['B', makeCatalog('B')]]),
  });
  assert.deepEqual(pending.page1Ids, ['A', 'B', 'C', 'D', 'E', 'X', 'Y']);
  assert.equal(pending.page1Ids[1], 'B', 'unknown anchor keeps place 2');
  assert.equal(pending.page1Ids[2], 'C', 'C keeps place 3');
  assert.deepEqual(pending.pendingFrozenIds, ['B']);
  assert.equal(pending.usedFreeze, true);

  const knownAbsent = repairPage1FreezeOrder({ presentableOrdered: pool, frozenIds: frozen, pageSize: 10 });
  assert.deepEqual(knownAbsent.page1Ids, ['A', 'C', 'D', 'E', 'X', 'Y']);
  assert.equal(knownAbsent.pendingFrozenIds, undefined);
});

test('T7b pending anchors survive an empty B pool (cold process / R2 timeout)', () => {
  const repaired = repairPage1FreezeOrder({
    presentableOrdered: [],
    frozenIds: ['A', 'B'],
    pageSize: 10,
    pendingFrozen: new Map([['A', makeCatalog('A')], ['B', makeCatalog('B')]]),
  });
  assert.deepEqual(repaired.page1Ids, ['A', 'B']);
  assert.equal(repaired.usedFreeze, true);
});

test('T8 paginationTotal grows with the B pool (GO11), page-1 ids counted once', () => {
  const page1 = letters('A', 'J');
  const small = selectBrowsePageWithPage1Freeze({
    browsable: Bs([...page1, 'X']),
    page1Ids: page1,
    page: 2,
    pageSize: 10,
    browseCap: CAP,
  });
  const bigger = selectBrowsePageWithPage1Freeze({
    browsable: Bs([...page1, 'X', ...zs(12)]),
    page1Ids: page1,
    page: 2,
    pageSize: 10,
    browseCap: CAP,
  });
  assert.equal(small.paginationTotal, 11);
  assert.equal(bigger.paginationTotal, 23);
  assert.ok(bigger.paginationTotal > small.paginationTotal);
  const capped = selectBrowsePageWithPage1Freeze({
    browsable: Bs([...page1, ...zs(200)]).slice(0, CAP),
    page1Ids: page1,
    page: 2,
    pageSize: 10,
    browseCap: CAP,
  });
  assert.equal(capped.paginationTotal, CAP);
});

test('T9 freeze A..J, X ranked first: page 2 = X,Y,Z1..Z8 and never a page-1 id', () => {
  const page1 = letters('A', 'J');
  const pool = Bs(['X', ...page1, 'Y', ...zs(12)]);
  const repaired = repairPage1FreezeOrder({ presentableOrdered: pool, frozenIds: page1, pageSize: 10 });
  assert.deepEqual(repaired.page1Ids, page1);
  const page2 = selectBrowsePageWithPage1Freeze({
    browsable: pool,
    page1Ids: repaired.page1Ids,
    page: 2,
    pageSize: 10,
    browseCap: CAP,
  });
  assert.deepEqual(ids(page2.offers), ['X', 'Y', ...zs(8)]);
  assert.ok(!ids(page2.offers).includes('J'));
  const page3 = selectBrowsePageWithPage1Freeze({
    browsable: pool,
    page1Ids: repaired.page1Ids,
    page: 3,
    pageSize: 10,
    browseCap: CAP,
  });
  assert.deepEqual(ids(page3.offers), ['Z9', 'Z10', 'Z11', 'Z12']);
  for (const offer of [...page2.offers, ...page3.offers]) assert.ok(!page1.includes(offer.id));
});

const F_CASES: Array<{ n: number; poolAnchors: string[]; next: string[]; page2: string[] }> = [
  { n: 1, poolAnchors: letters('A', 'E'), next: ['A', 'X', 'B', 'C', 'D', 'E', 'Y', 'Z1', 'Z2', 'Z3'], page2: zs(12).slice(3) },
  { n: 5, poolAnchors: letters('A', 'E'), next: [...letters('A', 'E'), 'X', 'Y', 'Z1', 'Z2', 'Z3'], page2: zs(12).slice(3) },
  { n: 9, poolAnchors: letters('A', 'I'), next: [...letters('A', 'I'), 'X'], page2: ['Y', ...zs(9)] },
  { n: 10, poolAnchors: letters('A', 'J'), next: letters('A', 'J'), page2: ['X', 'Y', ...zs(8)] },
];

for (const fixture of F_CASES) {
  test(`F n=${fixture.n}: anchors kept in frozen order, fill in rank order, page 2 excludes page 1`, () => {
    const frozen = letters('A', 'J').slice(0, fixture.n);
    // First render: only the anchors are B.
    const first = repairPage1FreezeOrder({ presentableOrdered: Bs(frozen), frozenIds: frozen, pageSize: 10 });
    assert.deepEqual(first.page1Ids, frozen);
    // Later render: X ranks before the anchors, Y and Z1..Z12 after.
    const pool = Bs(['X', ...fixture.poolAnchors, 'Y', ...zs(12)]);
    const next = repairPage1FreezeOrder({ presentableOrdered: pool, frozenIds: frozen, pageSize: 10 });
    assert.deepEqual(next.page1Ids, fixture.next);
    const page2 = selectBrowsePageWithPage1Freeze({
      browsable: pool,
      page1Ids: next.page1Ids,
      page: 2,
      pageSize: 10,
      browseCap: CAP,
    });
    assert.deepEqual(ids(page2.offers), fixture.page2);
    for (const id of ids(page2.offers)) assert.ok(!next.page1Ids.includes(id));
  });
}

test('F emptyPool / allAnchorsStale: freeze dropped per GO10', () => {
  const empty = repairPage1FreezeOrder({ presentableOrdered: [], frozenIds: ['A', 'B'], pageSize: 10 });
  assert.deepEqual(empty.page1Ids, []);
  assert.equal(empty.usedFreeze, false);
  const stale = repairPage1FreezeOrder({ presentableOrdered: Bs(['X', 'Y']), frozenIds: ['A', 'B'], pageSize: 10 });
  assert.deepEqual(stale.page1Ids, ['X', 'Y']);
  assert.equal(stale.usedFreeze, false);
});

function pendingAnchorHarness(withReserve = true) {
  // URL freeze A..J; B (place 2) unknown -> pending overlay; the others are B.
  const frozen = letters('A', 'J');
  const pool = Bs(frozen.filter((id) => id !== 'B').concat(['K']));
  let resolveB: (offer: TravelOffer) => void = () => {};
  const bLive = new Promise<TravelOffer>((resolve) => {
    resolveB = resolve;
  });
  const slots = buildPage1SlotOffers({
    browsable: pool,
    overlayCandidates: withReserve ? [makeB('K')] : [],
    frozenIds: frozen,
    pageSize: 10,
    pendingFrozen: new Map([['B', makeCatalog('B')]]),
  });
  const overlays: PageSettleLiveOverlay[] = [
    { catalog: makeCatalog('B'), live: bLive, pending: true },
  ];
  const deadline = manualDeadline();
  const controller = createPage1SettleController({
    slotOffers: slots.slotOffers,
    overlays,
    pageSize: 10,
    scheduleDeadline: deadline.schedule,
  });
  return { frozen, slots, controller, deadline, resolveB };
}

test('S5 pending anchor settles B: kept at place 2, definitive A..J (no re-order)', async () => {
  const h = pendingAnchorHarness();
  assert.deepEqual(h.slots.pendingFrozenIds, ['B']);
  assert.deepEqual(ids(h.slots.slotOffers).slice(0, 10), h.frozen);
  assert.equal(h.controller.current().status, 'COLLECTING');
  h.resolveB(makeB('B'));
  const selection = await h.controller.selection;
  assert.equal(selection.status, 'READY');
  assert.deepEqual(selection.selectedIds, h.frozen);
});

test('S5 pending anchor settles C: dropped, next B fills (known non-B)', async () => {
  const h = pendingAnchorHarness();
  h.resolveB(makeC('B'));
  const selection = await h.controller.selection;
  assert.equal(selection.status, 'READY');
  assert.deepEqual(selection.selectedIds, ['A', ...letters('C', 'J'), 'K']);
});

test('S5 pending anchor still unknown at deadline: no shorter page1Ids rewrite', async () => {
  const h = pendingAnchorHarness(false);
  h.deadline.fire();
  const selection = await h.controller.selection;
  assert.equal(selection.status, 'DEADLINE');
  const pendingIds = pendingSlotIdsForSettle(selection, h.controller.slotOffers);
  assert.deepEqual(pendingIds, ['B']);
  const output = resolvePage1SettleOutput({
    result: selection,
    browseTotal: 10,
    existingPage1Ids: h.frozen,
    pageSize: 10,
    pendingIds,
  });
  assert.deepEqual(output.page1Ids, []);
  assert.equal(output.freeze, 'NONE');
  assert.deepEqual(output.paginationPage1Ids, h.frozen, 'links keep the unchanged URL ids');
  // Without the pending rule this 9-B DEADLINE would write a shorter 9-id anchor.
  const withoutRule = resolvePage1SettleOutput({ result: selection, browseTotal: 10, existingPage1Ids: h.frozen, pageSize: 10 });
  assert.equal(withoutRule.page1Ids.length, 9);
});

function slotsFrom(spec: string[]): Page1RenderSlot[] {
  return spec.map((entry) => {
    const [kind, id] = entry.split(':') as [string, string];
    if (kind === 'B') return { kind: 'immediate', offer: makeB(id) };
    return { kind: 'pending', catalogOffer: makeCatalog(id) };
  });
}

test('S5 cold page 2 redirect ids (Master Plan r.706): definitive or 1-9 anchor only', () => {
  const ten = slotsFrom(letters('A', 'J').map((id) => `B:${id}`));
  assert.deepEqual(
    coldPage2RedirectPage1Ids(settlePageSelection({ slots: ten, deadlineReached: false })),
    letters('A', 'J'),
  );
  const anchor = slotsFrom(['B:A', 'B:B', 'B:C', 'P:D']);
  assert.deepEqual(coldPage2RedirectPage1Ids(settlePageSelection({ slots: anchor, deadlineReached: true })), ['A', 'B', 'C']);
  const optionD = slotsFrom(['P:P', ...letters('A', 'J').map((id) => `B:${id}`)]);
  assert.deepEqual(coldPage2RedirectPage1Ids(settlePageSelection({ slots: optionD, deadlineReached: true })), []);
  const empty = slotsFrom(['P:P', 'P:Q']);
  assert.deepEqual(coldPage2RedirectPage1Ids(settlePageSelection({ slots: empty, deadlineReached: true })), []);
  assert.deepEqual(coldPage2RedirectPage1Ids(settlePageSelection({ slots: empty, deadlineReached: false })), []);
});

test('S5 source: page 2+ exclusion, pending anchors and cold redirect are wired', () => {
  const state = read('lib/search/catalog-live-page-state.ts');
  assert.match(state, /selectBrowsePageWithPage1Freeze\(/);
  assert.match(state, /isFrozenPage1StatusUnknown\(applyResultsLivePriceOverlay\(/);
  assert.match(state, /pendingFrozen,/);
  assert.match(state, /filter\(\(offer\) => !page2ExcludedIds\.has\(offer\.id\)\)/);
  assert.match(state, /coldPage2Page1Settle: isColdPage2 \? page1Settle : undefined/);
  assert.match(state, /repairPage1FreezeOrder/);
  const section = read('components/results/catalog-live-section.tsx');
  assert.match(section, /import \{ redirect \} from 'next\/navigation'/);
  assert.match(section, /redirect\(buildResultsPageHref\(\{ \.\.\.params, page1Ids: redirectIds \}, page\)\)/);
  assert.match(section, /await state\.coldPage2Page1Settle\.selection/);
  const stream = read('components/results/page1-receipt-stream.tsx');
  assert.match(stream, /pendingIds: pendingSlotIdsForSettle\(selection, page1Settle\.slotOffers\)/);
  // Page-1 freeze path (S4) untouched: still the settle controller on page 1.
  assert.match(state, /page1Settle: isPage1 \? page1Settle : undefined/);
});
