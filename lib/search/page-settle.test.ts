/**
 * D-v2 S3: pure page-settle helper tests (no timers, no I/O, no rendering).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TravelOffer } from '@/types/travel';
import type { Page1RenderSlot } from '@/lib/search/page1-visible-cards';
import {
  isPageSettleDeadlineReached,
  settlePageSelection,
  type PageSettleInput,
} from '@/lib/search/page-settle';

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

/** B: proven presentable live price (same fixture shape as page1-visible-cards.test.ts). */
function makeB(id: string, overrides: Partial<TravelOffer> = {}): TravelOffer {
  return makeCatalog(id, {
    livePriceStatus: 'proven',
    livePriceSource: 'upsales',
    price: 717,
    pricePerDay: 90,
    liveTotalPrice: 1434,
    liveTotalPriceField: 'upsales.totalPrice',
    ...overrides,
  });
}
/** A: provider-confirmed unavailable. */
const makeA = (id: string) =>
  makeCatalog(id, { livePriceStatus: 'unavailable', livePriceFailureReason: 'http_204' });
/** C: technical unresolved. */
const makeC = (id: string) =>
  makeCatalog(id, { livePriceStatus: 'unavailable', livePriceFailureReason: 'timeout' });
const makeUnpriced = (id: string) => makeCatalog(id, { livePriceStatus: 'unpriced' });

const settled = (offer: TravelOffer): Page1RenderSlot => ({
  kind: 'pending',
  settledOffer: offer,
  catalogOffer: makeCatalog(offer.id),
});
const immediate = (offer: TravelOffer): Page1RenderSlot => ({ kind: 'immediate', offer });
const pending = (id: string): Page1RenderSlot => ({ kind: 'pending', catalogOffer: makeCatalog(id) });
const settledEmpty = (id: string): Page1RenderSlot => ({
  kind: 'pending',
  settledOffer: null,
  catalogOffer: makeCatalog(id),
});

const bSlots = (prefix: string, n: number) =>
  Array.from({ length: n }, (_, i) => settled(makeB(`${prefix}${i + 1}`)));
const ids = (prefix: string, from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => `${prefix}${from + i}`);

test('S3-1: 10 B before the end -> READY with exactly 10 ids', () => {
  const slots = [...bSlots('b', 10), settled(makeA('a1')), pending('p1'), settled(makeB('late'))];
  const r = settlePageSelection({ slots, deadlineReached: false });
  assert.equal(r.status, 'READY');
  assert.equal(r.final, true);
  assert.deepEqual(r.selectedIds, ids('b', 1, 10));
  assert.deepEqual(r.selectedRanks, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(r.pendingRanks, [11], 'pending after the cut does not block');
  assert.deepEqual(r.pendingRanksBeforeLastSelected, []);
});

test('S3-2: fewer than 10 B and all settled -> EXHAUSTED', () => {
  const slots = [settled(makeB('b1')), settled(makeA('a1')), settled(makeC('c1')), immediate(makeB('b2'))];
  const r = settlePageSelection({ slots, deadlineReached: false });
  assert.equal(r.status, 'EXHAUSTED');
  assert.equal(r.final, true);
  assert.deepEqual(r.selectedIds, ['b1', 'b2']);
});

test('S3-3: 0 B and all settled -> EXHAUSTED, not READY', () => {
  const slots = [settled(makeA('a1')), settled(makeC('c1')), settledEmpty('x'), immediate(makeCatalog('cat'))];
  const r = settlePageSelection({ slots, deadlineReached: false });
  assert.equal(r.status, 'EXHAUSTED');
  assert.deepEqual(r.selectedIds, []);
  assert.equal(r.settledPresentableCount, 0);
});

test('S3-4: A / C / unpriced / catalog / null / pending are never selected', () => {
  const slots = [
    settled(makeA('a1')),
    settled(makeC('c1')),
    settled(makeUnpriced('u1')),
    immediate(makeCatalog('cat1')),
    settledEmpty('n1'),
    pending('p1'),
    settled(makeB('b1')),
  ];
  for (const deadlineReached of [false, true]) {
    const r = settlePageSelection({ slots, deadlineReached });
    assert.ok(!r.selectedIds.some((id) => id !== 'b1'), `only B selected (deadline=${deadlineReached})`);
    assert.deepEqual(r.rankStates, [
      'NOT_PRESENTABLE',
      'NOT_PRESENTABLE',
      'NOT_PRESENTABLE',
      'NOT_PRESENTABLE',
      'NOT_PRESENTABLE',
      'PENDING',
      'B',
    ]);
  }
  assert.deepEqual(settlePageSelection({ slots, deadlineReached: true }).selectedIds, ['b1']);
});

test('S3-5: B selected in existing catalog/rank order (never re-sorted, e.g. by price)', () => {
  const slots = [
    settled(makeB('expensive', { price: 1999, pricePerDay: 250, liveTotalPrice: 3998 })),
    settled(makeB('cheap', { price: 199, pricePerDay: 25, liveTotalPrice: 398 })),
    settled(makeB('mid', { price: 599, pricePerDay: 75, liveTotalPrice: 1198 })),
  ];
  const r = settlePageSelection({ slots, deadlineReached: false });
  assert.deepEqual(r.selectedIds, ['expensive', 'cheap', 'mid']);
  assert.deepEqual(r.selectedRanks, [0, 1, 2]);
});

test('S3-6: A/C/pending before a B keep the final B rank order; earlier pending blocks until settled', () => {
  const before: Page1RenderSlot[] = [
    settled(makeA('a1')),
    pending('r1'),
    settled(makeC('c1')),
    settled(makeB('b1')),
    settled(makeB('b2')),
  ];
  const collecting = settlePageSelection({ slots: before, deadlineReached: false });
  assert.equal(collecting.status, 'COLLECTING');
  assert.deepEqual(collecting.selectedIds, [], 'definitive prefix stops at the pending rank');

  const afterB = before.map((s, i) => (i === 1 ? settled(makeB('r1')) : s));
  const r1 = settlePageSelection({ slots: afterB, deadlineReached: false });
  assert.equal(r1.status, 'EXHAUSTED');
  assert.deepEqual(r1.selectedIds, ['r1', 'b1', 'b2']);
  assert.deepEqual(r1.selectedRanks, [1, 3, 4]);

  const afterA = before.map((s, i) => (i === 1 ? settled(makeA('r1')) : s));
  assert.deepEqual(settlePageSelection({ slots: afterA, deadlineReached: false }).selectedIds, ['b1', 'b2']);
});

test('S3-7: deadline before 10 B -> DEADLINE', () => {
  const slots = [...bSlots('b', 3), pending('p1'), pending('p2')];
  const r = settlePageSelection({ slots, deadlineReached: true });
  assert.equal(r.status, 'DEADLINE');
  assert.equal(r.final, true);
  assert.deepEqual(r.selectedIds, ids('b', 1, 3));
  assert.deepEqual(r.pendingRanks, [3, 4]);
  assert.equal(settlePageSelection({ slots, deadlineReached: false }).status, 'COLLECTING');
});

test('S3-8: deadline with 0 B -> DEADLINE_EMPTY', () => {
  const slots = [settled(makeA('a1')), pending('p1'), settled(makeC('c1'))];
  const r = settlePageSelection({ slots, deadlineReached: true });
  assert.equal(r.status, 'DEADLINE_EMPTY');
  assert.equal(r.final, true);
  assert.deepEqual(r.selectedIds, []);
  assert.deepEqual(r.pendingRanks, [1]);
});

for (const k of [1, 5, 9]) {
  test(`S3-${k === 1 ? 9 : k === 5 ? 10 : 11}: deadline with ${k} B -> DEADLINE with exactly those ${k} (anchor info)`, () => {
    // rank 0 pending (never settles), B spread after it, trailing pending
    const slots: Page1RenderSlot[] = [pending('p0')];
    for (let i = 1; i <= k; i += 1) {
      slots.push(settled(makeB(`b${i}`)));
      slots.push(settled(makeC(`c${i}`)));
    }
    slots.push(pending('pz'));
    const r = settlePageSelection({ slots, deadlineReached: true });
    assert.equal(r.status, 'DEADLINE');
    assert.deepEqual(r.selectedIds, ids('b', 1, k));
    assert.deepEqual(
      r.selectedRanks,
      Array.from({ length: k }, (_, i) => 1 + 2 * i),
    );
    assert.deepEqual(r.pendingRanks, [0, slots.length - 1]);
    assert.deepEqual(r.pendingRanksBeforeLastSelected, [0], 'unsettled rank inside the selection');
    const before = settlePageSelection({ slots, deadlineReached: false });
    assert.equal(before.status, 'COLLECTING');
    assert.deepEqual(before.selectedIds, [], 'no definitive prefix while rank 0 is pending');
  });
}

test('S3-12: exactly 10 B (no earlier pending) -> READY, also at the deadline', () => {
  const slots = [...bSlots('b', 10), pending('p1')];
  for (const deadlineReached of [false, true]) {
    const r = settlePageSelection({ slots, deadlineReached });
    assert.equal(r.status, 'READY', `deadline=${deadlineReached}`);
    assert.deepEqual(r.selectedIds, ids('b', 1, 10));
  }
});

test('S4-fix (A-19 withdrawn): 10+ B behind an earlier pending rank -> COLLECTING, at deadline DEADLINE not READY', () => {
  const gap = [...bSlots('b', 3), pending('gap'), ...bSlots('x', 9)];
  const waiting = settlePageSelection({ slots: gap, deadlineReached: false });
  assert.equal(waiting.status, 'COLLECTING', '10 B but an earlier rank unsettled -> NOT READY');
  assert.deepEqual(waiting.selectedIds, ids('b', 1, 3), 'definitive prefix only');
  const atDeadline = settlePageSelection({ slots: gap, deadlineReached: true });
  assert.equal(atDeadline.status, 'DEADLINE');
  assert.equal(atDeadline.final, true);
  assert.equal(atDeadline.settledPresentableCount, 12);
  assert.deepEqual(atDeadline.pendingRanks, [3]);
  // Which ids S4 shows/anchors in this case is an open owner question: only invariants here.
  assert.ok(atDeadline.selectedIds.length <= 10);
  const settledOrder = [...ids('b', 1, 3), ...ids('x', 1, 9)];
  assert.deepEqual(
    atDeadline.selectedIds,
    settledOrder.filter((id) => atDeadline.selectedIds.includes(id)),
    'rank order kept, only settled B',
  );
});

test('S4-fix: all settled with >= 10 B -> READY; 10 B with pending only after them -> READY', () => {
  const allSettled = [settled(makeA('a1')), ...bSlots('b', 11), settled(makeC('c1'))];
  const r = settlePageSelection({ slots: allSettled, deadlineReached: false });
  assert.equal(r.status, 'READY');
  assert.deepEqual(r.selectedIds, ids('b', 1, 10));
  const trailingPending = [...bSlots('b', 10), pending('after')];
  for (const deadlineReached of [false, true]) {
    assert.equal(
      settlePageSelection({ slots: trailingPending, deadlineReached }).status,
      'READY',
    );
  }
});

test('S3-13: more than 10 B -> only the first 10 by rank', () => {
  const slots = bSlots('b', 14);
  const r = settlePageSelection({ slots, deadlineReached: false });
  assert.equal(r.status, 'READY');
  assert.deepEqual(r.selectedIds, ids('b', 1, 10));
  assert.equal(r.settledPresentableCount, 14);
});

test('S3-14: empty input -> EXHAUSTED with 0 ids, with or without deadline', () => {
  for (const deadlineReached of [false, true]) {
    const r = settlePageSelection({ slots: [], deadlineReached });
    assert.equal(r.status, 'EXHAUSTED');
    assert.equal(r.final, true);
    assert.deepEqual(r.selectedIds, []);
    assert.deepEqual(r.pendingRanks, []);
  }
});

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value as object)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}

test('S3-15: no side effects: inputs unchanged, frozen inputs work, repeat calls deterministic', () => {
  const slots: Page1RenderSlot[] = [
    settled(makeA('a1')),
    immediate(makeB('b1')),
    pending('p1'),
    settled(makeB('b2')),
    settledEmpty('n1'),
  ];
  const input: PageSettleInput = { slots, deadlineReached: true };
  const snapshot = structuredClone(input);
  deepFreeze(input);
  const first = settlePageSelection(input);
  const second = settlePageSelection(input);
  assert.deepEqual(input, snapshot);
  assert.deepEqual(first, second);
  assert.notEqual(first.selectedIds, second.selectedIds, 'fresh arrays per call');
  assert.equal(first.status, 'DEADLINE');
  assert.equal(first.selectedOffers[0], slots[1]!.kind === 'immediate' ? slots[1]!.offer : null);
});

test('S3 T1 (helper): L2 cold, B arrive later in rank order -> COLLECTING, then READY with rank 1-10', () => {
  const ids12 = ids('r', 1, 12);
  const cold = ids12.map((id) => pending(id));
  assert.equal(settlePageSelection({ slots: cold, deadlineReached: false }).status, 'COLLECTING');
  // ranks settle out of order: 12..3 first, then 2, then 1
  const partial = ids12.map((id, i) => (i < 2 ? pending(id) : settled(makeB(id))));
  const mid = settlePageSelection({ slots: partial, deadlineReached: false });
  assert.equal(mid.status, 'COLLECTING', 'rank 1 and 2 still unsettled');
  assert.equal(mid.settledPresentableCount, 10);
  const all = ids12.map((id) => settled(makeB(id)));
  const done = settlePageSelection({ slots: all, deadlineReached: false });
  assert.equal(done.status, 'READY');
  assert.deepEqual(done.selectedIds, ids('r', 1, 10));
});

test('S3 T2 (helper): 6 B at ranks 3,5,7,9,11,13 among settled non-B -> rank order', () => {
  const slots = Array.from({ length: 14 }, (_, i) => {
    const rank = i + 1;
    return [3, 5, 7, 9, 11, 13].includes(rank) ? settled(makeB(`r${rank}`)) : settled(makeC(`r${rank}`));
  });
  const r = settlePageSelection({ slots, deadlineReached: false });
  assert.equal(r.status, 'EXHAUSTED');
  assert.deepEqual(r.selectedIds, ['r3', 'r5', 'r7', 'r9', 'r11', 'r13']);
});

test('S3 T4 (helper): selectedIds == selectedOffers ids; injected predicate (e.g. budget) is applied', () => {
  const slots = [
    settled(makeB('in1', { price: 500, liveTotalPrice: 1000 })),
    settled(makeB('over', { price: 900, liveTotalPrice: 1800 })),
    settled(makeB('in2', { price: 600, liveTotalPrice: 1200 })),
  ];
  const r = settlePageSelection({
    slots,
    deadlineReached: false,
    isPresentable: (offer) => offer.price <= 700,
  });
  assert.deepEqual(r.selectedIds, ['in1', 'in2']);
  assert.deepEqual(
    r.selectedOffers.map((o) => o.id),
    r.selectedIds,
  );
  assert.deepEqual(r.rankStates, ['B', 'NOT_PRESENTABLE', 'B']);
});

test('S3 T13 (helper): 50 candidates, 10 B settled, 40 reserve pending -> READY with exactly those 10', () => {
  const slots = [...bSlots('b', 10), ...Array.from({ length: 40 }, (_, i) => pending(`res${i}`))];
  const r = settlePageSelection({ slots, deadlineReached: false });
  assert.equal(r.status, 'READY');
  assert.deepEqual(r.selectedIds, ids('b', 1, 10));
  assert.equal(r.pendingRanks.length, 40);
  assert.deepEqual(r.pendingRanksBeforeLastSelected, []);
});

test('S3: duplicate ids count once (first rank wins); pageSize validation; deadline helper', () => {
  const slots = [settled(makeB('dup')), settled(makeB('dup')), settled(makeB('b2'))];
  const r = settlePageSelection({ slots, deadlineReached: false, pageSize: 2 });
  assert.equal(r.status, 'READY');
  assert.deepEqual(r.selectedIds, ['dup', 'b2']);
  assert.deepEqual(r.rankStates, ['B', 'NOT_PRESENTABLE', 'B']);
  assert.throws(() => settlePageSelection({ slots, deadlineReached: false, pageSize: 0 }), RangeError);
  assert.throws(() => settlePageSelection({ slots, deadlineReached: false, pageSize: 2.5 }), RangeError);
  assert.equal(isPageSettleDeadlineReached(7_999, 8_000), false);
  assert.equal(isPageSettleDeadlineReached(8_000, 8_000), true);
});
