/**
 * D-v2 S4 (owner GO 25-09 16:49, option d): Page-1 settle wiring tests.
 * Controller + write policy + slot order + pagination output, plus source asserts
 * for the Results wiring. Deterministic: deadline via injected scheduler, no I/O.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import type { TravelOffer } from '@/types/travel';
import { paginateResults } from '@/lib/search/pagination';
import {
  buildPage1SlotOffers,
  createPage1SettleController,
  isPage1VisibleOffer,
  page1UrlIdsForSettle,
  PAGE1_DEADLINE_EMPTY_STATUS_TEXT,
  PAGE1_SETTLE_DEADLINE_MS,
  resolvePage1SettleOutput,
  settlePageSelection,
  type PageSettleLiveOverlay,
  type PageSettleResult,
} from '@/lib/search/page-settle';

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

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
const makeA = (id: string) =>
  makeCatalog(id, { livePriceStatus: 'unavailable', livePriceFailureReason: 'http_204' });
const makeC = (id: string) =>
  makeCatalog(id, { livePriceStatus: 'unavailable', livePriceFailureReason: 'timeout' });

type Harness = {
  offers: TravelOffer[];
  overlays: PageSettleLiveOverlay[];
  resolve: (id: string, outcome: TravelOffer) => void;
  reject: (id: string) => void;
};

/** Spec: 'B:x' settled B (no overlay), 'P:x' pending live slot. */
function harness(spec: string[]): Harness {
  const offers: TravelOffer[] = [];
  const overlays: PageSettleLiveOverlay[] = [];
  const resolvers = new Map<string, { ok: (o: TravelOffer) => void; ko: (e: unknown) => void }>();
  for (const entry of spec) {
    const [kind, id] = entry.split(':') as [string, string];
    if (kind === 'B') {
      const b = makeB(id);
      offers.push(b);
      overlays.push({ catalog: b, live: Promise.resolve(b), pending: false });
      continue;
    }
    const catalog = makeCatalog(id);
    offers.push(catalog);
    const live = new Promise<TravelOffer>((ok, ko) => resolvers.set(id, { ok, ko }));
    overlays.push({ catalog, live, pending: true });
  }
  return {
    offers,
    overlays,
    resolve: (id, outcome) => resolvers.get(id)!.ok(outcome),
    reject: (id) => resolvers.get(id)!.ko(new Error('live failed')),
  };
}

function manualDeadline() {
  let fire: (() => void) | undefined;
  let cancelled = false;
  let scheduledMs: number | undefined;
  return {
    schedule: (fn: () => void, ms: number) => {
      fire = fn;
      scheduledMs = ms;
      return () => {
        cancelled = true;
      };
    },
    fire: () => fire?.(),
    get cancelled() {
      return cancelled;
    },
    get scheduledMs() {
      return scheduledMs;
    },
  };
}

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
const seq = (prefix: string, n: number, kind = 'B') =>
  Array.from({ length: n }, (_, i) => `${kind}:${prefix}${i + 1}`);
const idList = (prefix: string, n: number) =>
  Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`);

async function isResolved<T>(p: Promise<T>): Promise<boolean> {
  let done = false;
  void p.then(() => {
    done = true;
  });
  await flush();
  return done;
}

test('S4-1 READY: 10 B with the preceding rank settled -> exactly 10 ids, definitive', async () => {
  const h = harness(['P:p0', ...seq('b', 10), 'P:tail']);
  const dl = manualDeadline();
  const c = createPage1SettleController({ slotOffers: h.offers, overlays: h.overlays, scheduleDeadline: dl.schedule });
  assert.equal(c.current().status, 'COLLECTING', 'earlier pending rank blocks READY');
  h.resolve('p0', makeA('p0'));
  const r = await c.selection;
  assert.equal(r.status, 'READY');
  assert.deepEqual(r.selectedIds, idList('b', 10));
  assert.equal(dl.cancelled, true, 'deadline timer cleared on final');
  assert.deepEqual(page1UrlIdsForSettle(r), { ids: idList('b', 10), freeze: 'DEFINITIVE' });
  assert.equal(await c.slotOutcome('tail'), null, 'tail slot CUT after final');
});

test('S4-2 DEADLINE 10+ B behind an earlier pending rank (option d): max 10 shown, NO page1Ids', async () => {
  const h = harness(['B:b1', 'P:p2', ...seq('c', 11)]);
  const dl = manualDeadline();
  const c = createPage1SettleController({ slotOffers: h.offers, overlays: h.overlays, scheduleDeadline: dl.schedule });
  assert.equal(c.current().status, 'COLLECTING');
  dl.fire();
  const r = await c.selection;
  assert.equal(r.status, 'DEADLINE');
  assert.deepEqual(r.selectedIds, ['b1', ...idList('c', 9)], 'max 10 settled B in rank order');
  assert.deepEqual(r.pendingRanksBeforeLastSelected, [1]);
  const out = resolvePage1SettleOutput({ result: r, browseTotal: 12 });
  assert.deepEqual(out.page1Ids, [], 'option d: nothing written');
  assert.equal(out.freeze, 'NONE');
  assert.equal(out.showStatusLine, false);
  assert.equal(out.showPagination, true);
  assert.equal(await c.slotOutcome('p2'), null, 'pending rank CUT at deadline');
  // Late settle after final never changes the selection.
  h.resolve('p2', makeB('p2'));
  await flush();
  assert.deepEqual(c.current().selectedIds, r.selectedIds);
});

test('S4-3 DEADLINE 9 B + pending -> 9-id anchor', async () => {
  const h = harness(['P:p0', ...seq('b', 9), 'P:p10']);
  const dl = manualDeadline();
  const c = createPage1SettleController({ slotOffers: h.offers, overlays: h.overlays, scheduleDeadline: dl.schedule });
  dl.fire();
  const r = await c.selection;
  assert.equal(r.status, 'DEADLINE');
  assert.deepEqual(page1UrlIdsForSettle(r), { ids: idList('b', 9), freeze: 'ANCHOR' });
});

test('S4-4 DEADLINE 1 B + pending -> 1-id anchor', async () => {
  const h = harness(['P:p0', 'B:b1', 'P:p2', 'P:p3']);
  const dl = manualDeadline();
  const c = createPage1SettleController({ slotOffers: h.offers, overlays: h.overlays, scheduleDeadline: dl.schedule });
  h.resolve('p2', makeC('p2'));
  await flush();
  dl.fire();
  const r = await c.selection;
  assert.equal(r.status, 'DEADLINE');
  assert.deepEqual(page1UrlIdsForSettle(r), { ids: ['b1'], freeze: 'ANCHOR' });
});

test('S4-5 DEADLINE_EMPTY 0 B + pending -> no ids, no pagination, plan status line', async () => {
  const h = harness(['P:p0', 'P:p1', 'P:p2']);
  const dl = manualDeadline();
  const c = createPage1SettleController({ slotOffers: h.offers, overlays: h.overlays, scheduleDeadline: dl.schedule });
  h.resolve('p1', makeA('p1'));
  await flush();
  dl.fire();
  const r = await c.selection;
  assert.equal(r.status, 'DEADLINE_EMPTY');
  const out = resolvePage1SettleOutput({ result: r, browseTotal: 40 });
  assert.deepEqual(out.page1Ids, []);
  assert.equal(out.showPagination, false);
  assert.equal(out.paginationTotal, 0, 'no fictitious pagination');
  assert.equal(out.showStatusLine, true);
  assert.equal(PAGE1_DEADLINE_EMPTY_STATUS_TEXT, 'We halen nog actuele prijzen op');
  assert.doesNotMatch(PAGE1_DEADLINE_EMPTY_STATUS_TEXT, /Geen vakanties gevonden/);
});

test('S4-6 EXHAUSTED: all settled, fewer than 10 B -> all B definitive', async () => {
  const h = harness(['P:p0', 'B:b1', 'P:p2', 'B:b3', 'P:p4']);
  const dl = manualDeadline();
  const c = createPage1SettleController({ slotOffers: h.offers, overlays: h.overlays, scheduleDeadline: dl.schedule });
  h.resolve('p0', makeB('p0'));
  h.resolve('p2', makeA('p2'));
  h.resolve('p4', makeC('p4'));
  const r = await c.selection;
  assert.equal(r.status, 'EXHAUSTED');
  assert.deepEqual(r.selectedIds, ['p0', 'b1', 'b3']);
  assert.deepEqual(page1UrlIdsForSettle(r), { ids: ['p0', 'b1', 'b3'], freeze: 'DEFINITIVE' });
});

test('S4-7 all settled with >= 10 B -> READY (rule table; owner listed it under EXHAUSTED)', async () => {
  const h = harness([...seq('b', 12)]);
  const dl = manualDeadline();
  const c = createPage1SettleController({ slotOffers: h.offers, overlays: h.overlays, scheduleDeadline: dl.schedule });
  const r = await c.selection;
  assert.equal(r.status, 'READY');
  assert.deepEqual(r.selectedIds, idList('b', 10));
  assert.equal(dl.scheduledMs, undefined, 'final at creation: no deadline timer');
});

test('S4-8 pending after the 10th B does not block READY (A-25)', async () => {
  const h = harness([...seq('b', 10), 'P:p11', 'P:p12']);
  const dl = manualDeadline();
  const c = createPage1SettleController({ slotOffers: h.offers, overlays: h.overlays, scheduleDeadline: dl.schedule });
  assert.equal(await isResolved(c.selection), true);
  const r = await c.selection;
  assert.equal(r.status, 'READY');
  assert.deepEqual(r.pendingRanks, [10, 11]);
});

test('S4-9 catalogue rank order kept: live arrival order and snapshot B never re-rank', async () => {
  const h = harness(seq('p', 10, 'P'));
  const dl = manualDeadline();
  const c = createPage1SettleController({ slotOffers: h.offers, overlays: h.overlays, scheduleDeadline: dl.schedule });
  for (let i = 10; i >= 1; i -= 1) {
    h.resolve(`p${i}`, makeB(`p${i}`));
    await flush();
  }
  const r = await c.selection;
  assert.deepEqual(r.selectedIds, idList('p', 10), 'rank order, not arrival order');

  // Unfrozen slots: overlay window in rank order; snapshot B not put first.
  const window = [makeCatalog('w1'), makeB('w2'), makeCatalog('w3')];
  const beyond = [makeB('x1'), makeB('x2')];
  const browsable = [makeB('w2'), ...beyond];
  const slots = buildPage1SlotOffers({ browsable, overlayCandidates: window, frozenIds: undefined, pageSize: 10 });
  assert.equal(slots.usedFreeze, false);
  assert.deepEqual(slots.slotOffers.map((o) => o.id), ['w1', 'w2', 'w3', 'x1', 'x2']);
});

test('S4-10 temporary cold B=0 never yields a definitive empty page1Ids / paginationTotal=0', async () => {
  // Request start: B snapshot empty, every slot pending (cold L2).
  let liveB = 0;
  const h = harness(seq('p', 12, 'P'));
  const dl = manualDeadline();
  const c = createPage1SettleController({ slotOffers: h.offers, overlays: h.overlays, scheduleDeadline: dl.schedule });
  assert.equal(c.current().status, 'COLLECTING');
  assert.equal(await isResolved(c.selection), false, 'no selection (so no ids/total) while B can still arrive');
  for (let i = 1; i <= 12; i += 1) {
    h.resolve(`p${i}`, makeB(`p${i}`));
    liveB += 1;
  }
  const r = await c.selection;
  assert.equal(r.status, 'READY');
  const out = resolvePage1SettleOutput({ result: r, browseTotal: liveB });
  assert.deepEqual(out.page1Ids, idList('p', 10));
  assert.equal(out.paginationTotal, 10 <= liveB ? liveB : 10);
  assert.ok(out.paginationTotal > 0);
});

test('S4-11 page1Ids only written when the existing freeze rules allow', () => {
  const b = (n: number) => Array.from({ length: n }, (_, i) => makeB(`b${i + 1}`));
  const settledSlots = (offers: TravelOffer[]) => offers.map((offer) => ({ kind: 'immediate' as const, offer }));
  const pendingSlot = { kind: 'pending' as const, catalogOffer: makeCatalog('p') };
  const cases: Array<[string, PageSettleResult, string]> = [
    ['collecting', settlePageSelection({ slots: [pendingSlot, ...settledSlots(b(3))], deadlineReached: false }), 'NONE'],
    ['ready', settlePageSelection({ slots: settledSlots(b(10)), deadlineReached: false }), 'DEFINITIVE'],
    ['exhausted', settlePageSelection({ slots: settledSlots(b(4)), deadlineReached: false }), 'DEFINITIVE'],
    ['exhausted-0', settlePageSelection({ slots: [], deadlineReached: false }), 'NONE'],
    ['deadline-9', settlePageSelection({ slots: [pendingSlot, ...settledSlots(b(9))], deadlineReached: true }), 'ANCHOR'],
    ['deadline-10', settlePageSelection({ slots: [pendingSlot, ...settledSlots(b(10))], deadlineReached: true }), 'NONE'],
    ['deadline-empty', settlePageSelection({ slots: [pendingSlot], deadlineReached: true }), 'NONE'],
  ];
  for (const [name, result, freeze] of cases) {
    const policy = page1UrlIdsForSettle(result);
    assert.equal(policy.freeze, freeze, name);
    assert.equal(policy.ids.length > 0, freeze !== 'NONE', name);
    if (freeze !== 'NONE') assert.ok(policy.ids.length <= 10, name);
  }
  const collecting = resolvePage1SettleOutput({ result: cases[0]![1], browseTotal: 30 });
  assert.equal(collecting.showPagination, false, 'never paginate a non-final selection');
});

test('S4-12 definitive page1Ids are not re-ordered by later live updates', async () => {
  const frozen = ['f3', 'f1', 'f2', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10'];
  // Later live data: a new earlier-ranked B (x0) and a pending candidate (p0) appeared.
  const browsable = [makeB('x0'), ...idList('f', 10).map((id) => makeB(id))];
  const window = [makeCatalog('p0'), makeB('x0'), ...idList('f', 10).map((id) => makeB(id))];
  const slots = buildPage1SlotOffers({ browsable, overlayCandidates: window, frozenIds: frozen, pageSize: 10 });
  assert.equal(slots.usedFreeze, true);
  assert.deepEqual(slots.slotOffers.slice(0, 10).map((o) => o.id), frozen);
  const overlays: PageSettleLiveOverlay[] = [
    { catalog: makeCatalog('p0'), live: new Promise<TravelOffer>(() => {}), pending: true },
  ];
  const dl = manualDeadline();
  const c = createPage1SettleController({ slotOffers: slots.slotOffers, overlays, scheduleDeadline: dl.schedule });
  const r = await c.selection;
  assert.equal(r.status, 'READY');
  assert.deepEqual(r.selectedIds, frozen, 'frozen order kept; x0/p0 do not enter');
});

test('S4-13 pagination links carry exactly the written page1Ids (Page 2+ exclusion input)', async () => {
  const browsable = idList('b', 25).map((id) => makeB(id));
  const r = settlePageSelection({
    slots: browsable.map((offer) => ({ kind: 'immediate' as const, offer })),
    deadlineReached: false,
  });
  const out = resolvePage1SettleOutput({ result: r, browseTotal: browsable.length });
  assert.deepEqual(out.paginationPage1Ids, idList('b', 10));
  // Unchanged Page 2+ selection (S5 scope): with this READY page 1, page 2 has no page-1 id.
  const page2 = paginateResults(browsable, 2, 10).map((o) => o.id);
  assert.equal(page2.some((id) => out.paginationPage1Ids.includes(id)), false);
  // Option d: nothing written -> links keep the existing URL ids (URL unchanged).
  const d = settlePageSelection({
    slots: [{ kind: 'pending', catalogOffer: makeCatalog('p') }, ...browsable.slice(0, 12).map((offer) => ({ kind: 'immediate' as const, offer }))],
    deadlineReached: true,
  });
  const outD = resolvePage1SettleOutput({ result: d, browseTotal: 12, existingPage1Ids: ['b1', 'b2'] });
  assert.deepEqual(outD.page1Ids, []);
  assert.deepEqual(outD.paginationPage1Ids, ['b1', 'b2']);
});

test('S4-14 paginationTotal comes from the B state at settle time', async () => {
  let calls = 0;
  const h = harness(['P:p1', ...seq('b', 3)]);
  const dl = manualDeadline();
  const c = createPage1SettleController({ slotOffers: h.offers, overlays: h.overlays, scheduleDeadline: dl.schedule });
  const computeBrowseTotal = () => {
    calls += 1;
    return 17;
  };
  h.resolve('p1', makeB('p1'));
  const r = await c.selection;
  const out = resolvePage1SettleOutput({ result: r, browseTotal: computeBrowseTotal() });
  assert.equal(calls, 1);
  assert.equal(out.paginationTotal, 17);
  // Total never below the cards shown.
  assert.equal(resolvePage1SettleOutput({ result: r, browseTotal: 0 }).paginationTotal, 4);
});

test('S4-15 paginationTotal may grow between renders (GO11)', () => {
  const r = settlePageSelection({
    slots: idList('b', 10).map((id) => ({ kind: 'immediate' as const, offer: makeB(id) })),
    deadlineReached: false,
  });
  const first = resolvePage1SettleOutput({ result: r, browseTotal: 23 });
  const next = resolvePage1SettleOutput({ result: r, browseTotal: 61 });
  assert.equal(first.paginationTotal, 23);
  assert.equal(next.paginationTotal, 61);
  assert.deepEqual(next.page1Ids, first.page1Ids, 'growth does not touch page 1');
});

test('S4-16 A / C / Pending / rejected / out-of-budget never enter the B-only pool', async () => {
  const h = harness(['P:a', 'P:c', 'P:rej', 'P:exp', 'B:b1', 'P:stay']);
  const dl = manualDeadline();
  const params = { budgetMax: 700 } as never;
  const c = createPage1SettleController({
    slotOffers: h.offers,
    overlays: h.overlays,
    scheduleDeadline: dl.schedule,
    isPresentable: (offer) => isPage1VisibleOffer(offer, params),
  });
  h.resolve('a', makeA('a'));
  h.resolve('c', makeC('c'));
  h.reject('rej');
  h.resolve('exp', makeB('exp', { price: 900 }));
  await flush();
  dl.fire();
  const r = await c.selection;
  assert.deepEqual(r.selectedIds, [], 'b1 at 717 is also above budget 700');
  assert.equal(r.status, 'DEADLINE_EMPTY');
  assert.equal(await c.slotOutcome('rej'), null, 'rejection = settled without card');
  assert.equal(isPage1VisibleOffer(makeB('ok', { price: 600 }), params), true);
  assert.equal(isPage1VisibleOffer(makeA('a2')), false);
  assert.equal(isPage1VisibleOffer(makeC('c2')), false);
  assert.equal(isPage1VisibleOffer(makeCatalog('pending')), false);
});

test('S4-17 slot outcomes stream before final; deadline constant = plan 8000 ms', async () => {
  assert.equal(PAGE1_SETTLE_DEADLINE_MS, 8000);
  const h = harness(['P:p0', 'P:p1']);
  const dl = manualDeadline();
  const c = createPage1SettleController({ slotOffers: h.offers, overlays: h.overlays, scheduleDeadline: dl.schedule });
  assert.equal(dl.scheduledMs, 8000);
  h.resolve('p1', makeB('p1'));
  const early = await c.slotOutcome('p1');
  assert.equal(early?.id, 'p1', 'B behind a pending rank may stream before the deadline');
  assert.equal(c.current().status, 'COLLECTING');
});

test('S4-18 source: Results page 1 is wired through the settle controller', () => {
  const state = read('lib/search/catalog-live-page-state.ts');
  assert.match(state, /buildPage1SlotOffers\(/);
  assert.match(state, /createPage1SettleController\(/);
  assert.match(state, /isPage1VisibleOffer\(offer, visibleParams\)/);
  assert.match(state, /computeBrowseTotal/);
  assert.ok(state.includes('repairPage1FreezeOrder'), 'GO10 repair kept');
  const stream = read('components/results/page1-receipt-stream.tsx');
  assert.match(stream, /await page1Settle\.selection/);
  assert.match(stream, /resolvePage1SettleOutput\(/);
  assert.match(stream, /page1Settle\.slotOutcome\(offer\.id\)/);
  assert.match(stream, /PAGE1_DEADLINE_EMPTY_STATUS_TEXT/);
  assert.ok(stream.includes('replaceExisting={true}'));
  assert.doesNotMatch(stream, /Geen vakanties gevonden/);
  const section = read('components/results/catalog-live-section.tsx');
  assert.match(section, /page1Settle=\{page1Settle\}/);
  assert.match(section, /computeBrowseTotal=\{state\.computeBrowseTotal\}/);
  assert.match(section, /<Suspense fallback=\{null\}>\s*<Page1PaginationStream/);
  assert.match(section, /const showEmpty = false/);
});
