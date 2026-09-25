/**
 * D-v2 fix A-38 / A-43 (owner GO 25-09 18:02).
 * A-38: option d (DEADLINE, 10+ B behind an earlier pending rank, no page1Ids written)
 *   must never let Page 2 repeat a card Page 1 shows. Exclusion comes from existing rules:
 *   Package 1 (page 2+ = B pool minus page-1 ids), MP r.706 (cold page 2 = one page-1
 *   pipeline), GO10 amendment (pending anchors keep their place), deterministic
 *   recomputation of the same Page-1 selection. No URL write, no new status.
 * A-43: after a Page-1 slot joined the shared R2 read and it ended without a record, the
 *   gate reuses that outcome instead of a second GET (S2: one shared read per key).
 * Pure / in-process: injected deadline, fake R2 backend, no network, no server, no port.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';
import type { TravelOffer } from '@/types/travel';
import {
  repairPage1FreezeOrder,
  repairPage2Page1Membership,
  selectBrowsePageWithPage1Freeze,
} from '@/lib/search/page1-freeze-repair';
import {
  buildPage1SlotOffers,
  coldPage2FallbackPage1Ids,
  coldPage2RedirectPage1Ids,
  createPage1SettleController,
  pendingSlotIdsForSettle,
  resolvePage1SettleOutput,
  type PageSettleLiveOverlay,
} from '@/lib/search/page-settle';
import { paginateResults } from '@/lib/search/pagination';
import {
  getLivePriceL2JoinedOutcomeCountForTests,
  joinInflightLivePriceL2Read,
  readLivePriceL2RecordResult,
  resetLivePriceL2CircuitForTests,
  setLivePriceL2BackendForTests,
  setLivePriceL2EnabledForTests,
  withLivePriceL2ProviderGate,
  type LivePriceL2Backend,
} from '@/lib/search/live-price-l2-store';

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');
const CAP = 150;

afterEach(() => {
  setLivePriceL2EnabledForTests(null);
  setLivePriceL2BackendForTests(null);
  resetLivePriceL2CircuitForTests();
});

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
const ids = (offers: readonly TravelOffer[]) => offers.map((offer) => offer.id);
const Bs = (names: string[]) => names.map(makeB);
const seq = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`);

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

/** Page-1 pipeline with rank 0 pending (never settles before the deadline) + 15 B. */
function optionDColdPage1() {
  const p = makeCatalog('P');
  const bNames = seq('B', 15);
  const slotOffers = [p, ...Bs(bNames)];
  const overlays: PageSettleLiveOverlay[] = [
    { catalog: p, live: new Promise<TravelOffer>(() => {}), pending: true },
  ];
  const deadline = manualDeadline();
  const controller = createPage1SettleController({
    slotOffers,
    overlays,
    pageSize: 10,
    scheduleDeadline: deadline.schedule,
  });
  return { controller, deadline, bNames };
}

test('A-38 cold page 2, option d: page 2 never repeats the recomputed page-1 cards (pending rank settles B later)', async () => {
  const h = optionDColdPage1();
  h.deadline.fire();
  const selection = await h.controller.selection;
  assert.equal(selection.status, 'DEADLINE');
  assert.deepEqual(selection.selectedIds, seq('B', 10));
  assert.deepEqual(selection.pendingRanksBeforeLastSelected, [0]);
  assert.deepEqual(coldPage2RedirectPage1Ids(selection, 10), [], 'option d: no redirect, no page1Ids');

  // Meanwhile the pending rank settled B (e.g. S7 background) -> B pool now starts with P.
  const nowBrowsable = Bs(['P', ...h.bNames]);
  const before = paginateResults(nowBrowsable, 2, 10);
  assert.ok(
    ids(before).some((id) => selection.selectedIds.includes(id)),
    'pre-fix slice repeats a page-1 card (B10) on page 2',
  );

  const excluded = coldPage2FallbackPage1Ids(selection, h.controller.slotOffers);
  assert.deepEqual(excluded, [...seq('B', 10), 'P']);
  const poolIds = new Set(ids(nowBrowsable));
  const page2 = selectBrowsePageWithPage1Freeze({
    browsable: nowBrowsable,
    page1Ids: excluded.filter((id) => poolIds.has(id)),
    page: 2,
    pageSize: 10,
    browseCap: CAP,
  });
  assert.deepEqual(ids(page2.offers), ['B11', 'B12', 'B13', 'B14', 'B15']);
  assert.ok(!ids(page2.offers).some((id) => selection.selectedIds.includes(id)), 'no page-1 card on page 2');
  assert.equal(page2.paginationTotal, 16, 'total = current B pool (GO11 may grow)');

  // Pending rank still unknown (not in the pool): same result, total = 15.
  const stillPending = Bs(h.bNames);
  const stillIds = new Set(ids(stillPending));
  const page2b = selectBrowsePageWithPage1Freeze({
    browsable: stillPending,
    page1Ids: excluded.filter((id) => stillIds.has(id)),
    page: 2,
    pageSize: 10,
    browseCap: CAP,
  });
  assert.deepEqual(ids(page2b.offers), ['B11', 'B12', 'B13', 'B14', 'B15']);
  assert.equal(page2b.paginationTotal, 15);
});

test('A-38 DEADLINE_EMPTY / not final: no exclusion ids -> existing browse slice', async () => {
  const p = makeCatalog('P');
  const deadline = manualDeadline();
  const controller = createPage1SettleController({
    slotOffers: [p],
    overlays: [{ catalog: p, live: new Promise<TravelOffer>(() => {}), pending: true }],
    pageSize: 10,
    scheduleDeadline: deadline.schedule,
  });
  assert.deepEqual(coldPage2FallbackPage1Ids(controller.current(), controller.slotOffers), [], 'COLLECTING');
  deadline.fire();
  const selection = await controller.selection;
  assert.equal(selection.status, 'DEADLINE_EMPTY');
  assert.deepEqual(coldPage2FallbackPage1Ids(selection, controller.slotOffers), []);
});

test('A-38 page 2 with a pending URL anchor (option d / no rewrite): page 2 excludes the extra B page 1 shows', async () => {
  const bNames = seq('b', 9);
  const cNames = seq('c', 6);
  const pool = Bs([...bNames, ...cNames]);
  const frozen = ['P', ...bNames];
  const pendingFrozen = new Map([['P', makeCatalog('P')]]);
  const slots = buildPage1SlotOffers({
    browsable: pool,
    overlayCandidates: pool,
    frozenIds: frozen,
    pageSize: 10,
    pendingFrozen,
  });
  assert.deepEqual(ids(slots.slotOffers), [...frozen, ...cNames]);
  const deadline = manualDeadline();
  const controller = createPage1SettleController({
    slotOffers: slots.slotOffers,
    overlays: [{ catalog: makeCatalog('P'), live: new Promise<TravelOffer>(() => {}), pending: true }],
    pageSize: 10,
    scheduleDeadline: deadline.schedule,
  });
  deadline.fire();
  const selection = await controller.selection;
  assert.equal(selection.status, 'DEADLINE');
  assert.deepEqual(selection.selectedIds, [...bNames, 'c1'], 'page 1 shows 10 B: b1..b9 + c1');
  const output = resolvePage1SettleOutput({
    result: selection,
    browseTotal: pool.length,
    existingPage1Ids: frozen,
    pageSize: 10,
    pendingIds: pendingSlotIdsForSettle(selection, controller.slotOffers),
  });
  assert.deepEqual(output.page1Ids, [], 'nothing written');
  assert.deepEqual(output.paginationPage1Ids, frozen, 'page-2 link carries the unchanged URL ids');

  // Page 2 request with those URL ids (anchor P still unknown there).
  const pre = repairPage1FreezeOrder({ presentableOrdered: pool, frozenIds: frozen, pageSize: 10, pendingFrozen });
  const prePage2 = selectBrowsePageWithPage1Freeze({ browsable: pool, page1Ids: pre.page1Ids, page: 2, pageSize: 10, browseCap: CAP });
  assert.equal(prePage2.offers[0]?.id, 'c1', 'pre-fix: c1 (shown on page 1) repeated on page 2');

  const membership = repairPage2Page1Membership({ presentableOrdered: pool, frozenIds: frozen, pageSize: 10, pendingFrozen });
  assert.deepEqual(membership.page1Ids, [...frozen, 'c1']);
  const page2 = selectBrowsePageWithPage1Freeze({ browsable: pool, page1Ids: membership.page1Ids, page: 2, pageSize: 10, browseCap: CAP });
  assert.deepEqual(ids(page2.offers), ['c2', 'c3', 'c4', 'c5', 'c6']);
  assert.ok(!ids(page2.offers).some((id) => selection.selectedIds.includes(id)), 'no page-1 card on page 2');

  // Without pending anchors the membership equals the existing GO10 repair (unchanged path).
  const plain = { presentableOrdered: pool, frozenIds: bNames, pageSize: 10 };
  assert.deepEqual(repairPage2Page1Membership(plain), repairPage1FreezeOrder(plain));
  assert.deepEqual(
    repairPage2Page1Membership({ ...plain, pendingFrozen }),
    repairPage1FreezeOrder({ ...plain, pendingFrozen }),
  );
});

test('A-38 source: page 2 uses the membership helper; cold fallback excludes the recomputed selection; no page1Ids write', () => {
  const state = read('lib/search/catalog-live-page-state.ts');
  assert.match(state, /const repaired = repairPage2Page1Membership\(\{/);
  assert.match(state, /\(excludedPage1Ids: readonly string\[\] = \[\]\) =>/);
  assert.match(state, /page1Ids: excludedPage1Ids\.filter\(\(id\) => poolIds\.has\(id\)\)/);
  const section = read('components/results/catalog-live-section.tsx');
  assert.match(section, /coldPage2FallbackPage1Ids\(coldSelection, state\.coldPage2Page1Settle\.slotOffers\)/);
  assert.match(section, /page1Ids=\{\[\]\}/, 'fallback still writes no page1Ids');
});

// ---------------------------------------------------------------------------
// A-43
// ---------------------------------------------------------------------------

type BackendPlan = { recordMs: number; record: 'none' | 'error' };

function countingBackend(plan: BackendPlan) {
  const counts = { recordGets: 0, lockGets: 0, putIfAbsent: 0 };
  const backend: LivePriceL2Backend = {
    get(key, signal) {
      if (key.includes('/lock/')) {
        counts.lockGets += 1;
        return Promise.resolve(null);
      }
      counts.recordGets += 1;
      if (plan.record === 'error') return Promise.reject(new Error('r2 down'));
      return new Promise((resolve) => {
        const timer = setTimeout(() => resolve(null), plan.recordMs);
        signal?.addEventListener('abort', () => clearTimeout(timer));
      });
    },
    put: () => Promise.resolve(),
    putIfAbsent: () => {
      counts.putIfAbsent += 1;
      return Promise.resolve('created');
    },
    delete: () => Promise.resolve(),
  };
  return { backend, counts };
}

test('A-43 join ends in timeout: the gate reuses it -> 1 GET, no lock, exactly 1 provider call', async () => {
  setLivePriceL2EnabledForTests(true);
  const h = countingBackend({ recordMs: 2100, record: 'none' });
  setLivePriceL2BackendForTests(h.backend);
  const key = 'a43-timeout';
  const t0 = Date.now();
  void readLivePriceL2RecordResult(key); // page-state hydrate read (S2 single-flight entry)
  const joined = joinInflightLivePriceL2Read(key);
  assert.ok(joined, 'slot joins the in-flight read');
  const outcome = await joined!;
  const joinedAt = Date.now() - t0;
  assert.equal(outcome.status, 'timeout');
  assert.ok(joinedAt >= 1990 && joinedAt < 2150, `timeout at ${joinedAt} ms`);
  assert.equal(getLivePriceL2JoinedOutcomeCountForTests(), 1);
  let work = 0;
  const mode = await withLivePriceL2ProviderGate(key, async () => {
    work += 1;
  });
  assert.equal(mode, 'ran_without_lock', 'S2: timeout -> no lock attempt');
  assert.equal(work, 1, 'DEC-011: exactly 1 provider call');
  assert.equal(h.counts.recordGets, 1, 'no second GET for the shared read');
  assert.equal(h.counts.putIfAbsent, 0);
  assert.equal(getLivePriceL2JoinedOutcomeCountForTests(), 0, 'consumed once');
});

test('A-43 handoff is one-shot and valid for one read bound only', async () => {
  setLivePriceL2EnabledForTests(true);
  const h = countingBackend({ recordMs: 0, record: 'error' });
  setLivePriceL2BackendForTests(h.backend);
  const key = 'a43-once';
  void readLivePriceL2RecordResult(key);
  assert.equal((await joinInflightLivePriceL2Read(key)!).status, 'error');
  let work = 0;
  const run = () => withLivePriceL2ProviderGate(key, async () => { work += 1; });
  assert.equal(await run(), 'ran_without_lock');
  assert.equal(h.counts.recordGets, 1, 'first gate reuses the joined outcome');
  assert.equal(await run(), 'ran_without_lock');
  assert.equal(h.counts.recordGets, 2, 'second gate reads again (handoff consumed)');
  assert.equal(work, 2);

  resetLivePriceL2CircuitForTests();
  void readLivePriceL2RecordResult(key);
  assert.equal((await joinInflightLivePriceL2Read(key)!).status, 'error');
  const getsBefore = h.counts.recordGets;
  await new Promise((resolve) => setTimeout(resolve, 2050));
  assert.equal(await run(), 'ran_without_lock');
  assert.equal(h.counts.recordGets, getsBefore + 1, 'expired handoff (> 2000 ms): gate reads itself');
});

test('A-43 joined not_found: gate skips its first read and goes to the lock path (1 re-check read after claim)', async () => {
  setLivePriceL2EnabledForTests(true);
  const h = countingBackend({ recordMs: 30, record: 'none' });
  setLivePriceL2BackendForTests(h.backend);
  const key = 'a43-miss';
  void readLivePriceL2RecordResult(key);
  assert.equal((await joinInflightLivePriceL2Read(key)!).status, 'not_found');
  let work = 0;
  const mode = await withLivePriceL2ProviderGate(key, async () => { work += 1; });
  assert.equal(mode, 'ran');
  assert.equal(work, 1);
  assert.equal(h.counts.putIfAbsent, 1, 'lock claimed (not_found path unchanged)');
  assert.equal(h.counts.recordGets, 2, 'shared read + existing post-claim re-check; no extra first read');
});

test('A-43 without a join: gate behaviour unchanged (own first read)', async () => {
  setLivePriceL2EnabledForTests(true);
  const h = countingBackend({ recordMs: 10, record: 'none' });
  setLivePriceL2BackendForTests(h.backend);
  void (await readLivePriceL2RecordResult('a43-plain')); // settled read, nobody joined
  assert.equal(getLivePriceL2JoinedOutcomeCountForTests(), 0, 'plain reads never hand off');
  let work = 0;
  const mode = await withLivePriceL2ProviderGate('a43-plain', async () => { work += 1; });
  assert.equal(mode, 'ran');
  assert.equal(work, 1);
  assert.equal(h.counts.recordGets, 3, 'earlier read + gate first read + post-claim re-check');
});
