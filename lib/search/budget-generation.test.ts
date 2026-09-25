/**
 * Results budget generations + default-sort live budget (owner decision 25-09-2026 22:24).
 *
 * A-H: every committed budget change (either handle, any order) is a new generation; an
 *      older generation can never overwrite the newest one. The stale guard is the
 *      existing Next.js App Router action queue (latest navigation wins); the fix makes
 *      sure every generation is actually dispatched (not dropped while an older one is in
 *      flight) and never inherits page1Ids from an older generation.
 * I-K: default sort B membership applies the budget on the live p.p. price, so an
 *      out-of-budget live offer is not presentable, not in paginationTotal / hasMore and
 *      takes no slot; a frozen page-1 id that leaves the budget is dropped + refilled (GO10).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import Module, { createRequire } from 'node:module';
import type { SearchParams, TravelOffer } from '@/types/travel';
import {
  BUDGET_GENERATION_NAVIGATION,
  isNewBudgetGeneration,
  nextBudgetDraft,
  type BudgetHandle,
  type BudgetRange,
} from '@/lib/search/budget-generation';
import { writeBudgetParams } from '@/lib/search/budget-params';
import { applyFilterNavigationPaging } from '@/lib/search/filter-navigation';
import { bookableResultsMembership } from '@/lib/search/results-catalog-page';
import {
  isFrozenPage1StatusUnknown,
  repairPage1FreezeOrder,
  selectBrowsePageWithPage1Freeze,
} from '@/lib/search/page1-freeze-repair';
import { resultsHasMore } from '@/lib/search/pagination';
import { isPage1VisibleOffer } from '@/lib/search/page-settle';
import { clearResultsLivePriceCache } from '@/lib/search/results-live-price-cache';

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

/**
 * The REAL Next.js 14 App Router action queue (next/dist/shared/lib/router/action-queue.js).
 * Its router-reducer import needs the browser Flight client, so it is stubbed; the reducer
 * is replaced per test anyway. What is exercised is Next's own queue/discard logic.
 */
function loadNextActionQueue(): { createMutableActionQueue: () => unknown } {
  const req = createRequire(join(ROOT, 'package.json'));
  const reducerPath = req.resolve('next/dist/client/components/router-reducer/router-reducer');
  const cache = req.cache as Record<string, unknown>;
  if (!cache[reducerPath]) {
    const ModuleCtor = Module as unknown as new (id: string) => { exports: unknown; loaded: boolean; filename: string };
    const stub = new ModuleCtor(reducerPath);
    stub.exports = { reducer: () => { throw new Error('stub reducer not used'); } };
    stub.loaded = true;
    stub.filename = reducerPath;
    cache[reducerPath] = stub;
  }
  return req('next/dist/shared/lib/router/action-queue');
}
const { createMutableActionQueue } = loadNextActionQueue();

// ---------------------------------------------------------------------------------------
// Generation model: the real Next.js action queue with a controllable async reducer.
// ---------------------------------------------------------------------------------------
type Gen = { gen: string; budgetMin: number; budgetMax: number; page1Ids: string[] };
type Pending = { resolve: (state: Gen) => void; payload: { gen: Gen } };

function makeRouterQueue(initial: Gen) {
  const queue = createMutableActionQueue() as unknown as {
    state: Gen | null;
    action: (state: Gen, payload: { gen: Gen }) => Promise<Gen>;
    dispatch: (payload: unknown, setState: (value: unknown) => void) => void;
  };
  queue.state = initial;
  const pending = new Map<string, Pending>();
  queue.action = (_state, payload) =>
    new Promise<Gen>((resolve) => {
      pending.set(payload.gen.gen, { resolve, payload });
    });
  const navigate = (gen: Gen) =>
    queue.dispatch({ type: 'navigate', gen }, () => {
      /* React setState stand-in */
    });
  // Server response for a generation arrives (possibly late / out of order).
  const respond = async (genId: string) => {
    const p = pending.get(genId);
    assert.ok(p, `no pending navigation for ${genId}`);
    p.resolve(p.payload.gen);
    await new Promise((r) => setTimeout(r, 0));
  };
  return { queue, navigate, respond, current: () => queue.state as Gen };
}

const gen = (id: string, budgetMin: number, budgetMax: number, page1Ids: string[] = []): Gen => ({
  gen: id,
  budgetMin,
  budgetMax,
  page1Ids,
});

test('A: G1 500/1500 -> G2 700/1500: a late G1 response cannot overwrite G2', async () => {
  const r = makeRouterQueue(gen('G0', 500, 2000, ['g0-a']));
  r.navigate(gen('G1', 500, 1500));
  r.navigate(gen('G2', 700, 1500));
  await r.respond('G2');
  assert.equal(r.current().gen, 'G2');
  await r.respond('G1'); // G1 finishes its work later
  assert.equal(r.current().gen, 'G2');
  assert.equal(r.current().budgetMin, 700);
});

test('B: G1 -> G2 -> G3 with responses G2, G1, G3: only G3 is applied', async () => {
  const r = makeRouterQueue(gen('G0', 500, 2000));
  r.navigate(gen('G1', 700, 1500));
  r.navigate(gen('G2', 700, 1300));
  r.navigate(gen('G3', 700, 1100));
  await r.respond('G2');
  await r.respond('G1');
  assert.equal(r.current().gen, 'G0', 'discarded generations never become current');
  await r.respond('G3');
  assert.equal(r.current().gen, 'G3');
});

test('C: G1 -> G2 -> G3 -> G4: G4 authoritative even when older ones answer after it', async () => {
  const r = makeRouterQueue(gen('G0', 500, 2000));
  for (const g of [gen('G1', 700, 1500), gen('G2', 700, 1300), gen('G3', 700, 1100), gen('G4', 800, 1100)]) {
    r.navigate(g);
  }
  await r.respond('G4');
  await r.respond('G3');
  await r.respond('G1');
  await r.respond('G2');
  assert.deepEqual(
    { gen: r.current().gen, min: r.current().budgetMin, max: r.current().budgetMax },
    { gen: 'G4', min: 800, max: 1100 },
  );
});

test('H: an old generation delivering late (after the newest was applied) changes nothing', async () => {
  const r = makeRouterQueue(gen('G0', 500, 2000));
  r.navigate(gen('G1', 500, 1500, ['old-1']));
  r.navigate(gen('G2', 764, 1500));
  await r.respond('G2');
  const before = JSON.stringify(r.current());
  await r.respond('G1');
  assert.equal(JSON.stringify(r.current()), before);
});

// ---------------------------------------------------------------------------------------
// Slider handles -> generations -> URL of each generation.
// ---------------------------------------------------------------------------------------
type Move = [BudgetHandle, number];

/** Replays handle releases like FilterSidebar: each changed release = new generation URL. */
function replay(start: BudgetRange, moves: Move[], liveQueryWithOldPage1Ids: string) {
  let committed = start;
  let draft = start;
  const generations: Array<{ range: BudgetRange; query: string }> = [];
  for (const [handle, value] of moves) {
    draft = nextBudgetDraft(draft, handle, value);
    if (!isNewBudgetGeneration(committed, draft)) continue;
    committed = draft;
    // Same composition as FilterSidebar.updateFilters for a budget commit.
    const params = new URLSearchParams(liveQueryWithOldPage1Ids);
    applyFilterNavigationPaging(params, {
      preservePage1Ids: BUDGET_GENERATION_NAVIGATION.preservePage1Ids,
      liveQuery: liveQueryWithOldPage1Ids,
    });
    writeBudgetParams(params, draft.min, draft.max, 500, 2000);
    generations.push({ range: draft, query: params.toString() });
  }
  return generations;
}

const LIVE = 'adults=2&dob=%2C&country=Spanje&budgetMax=1500&page1Ids=old-1%2Cold-2&page=3';

test('D: only the left handle changed -> new generation with its own Page 1 (no page1Ids)', () => {
  const g = replay({ min: 500, max: 1500 }, [['min', 700]], LIVE);
  assert.equal(g.length, 1);
  const q = new URLSearchParams(g[0]!.query);
  assert.equal(q.get('budgetMin'), '700');
  assert.equal(q.get('budgetMax'), '1500');
  assert.equal(q.get('page1Ids'), null);
  assert.equal(q.get('page'), null);
});

test('E: only the right handle changed -> new generation', () => {
  const g = replay({ min: 500, max: 1500 }, [['max', 700]], LIVE);
  assert.equal(g.length, 1);
  const q = new URLSearchParams(g[0]!.query);
  assert.equal(q.get('budgetMin'), null);
  assert.equal(q.get('budgetMax'), '700');
  assert.equal(q.get('page1Ids'), null);
});

test('F: right handle moved several times -> one generation per move, last one wins', () => {
  const g = replay({ min: 500, max: 1500 }, [['max', 1300], ['max', 1100]], LIVE);
  assert.deepEqual(g.map((x) => x.range), [{ min: 500, max: 1300 }, { min: 500, max: 1100 }]);
  assert.ok(g.every((x) => new URLSearchParams(x.query).get('page1Ids') === null));
  // releasing without a change is not a generation
  assert.equal(replay({ min: 500, max: 1500 }, [['max', 1500]], LIVE).length, 0);
});

test('G: left -> right -> right -> left keeps order; generations G1..G4 are distinct', () => {
  const g = replay(
    { min: 500, max: 1500 },
    [['min', 700], ['max', 1300], ['max', 1100], ['min', 800]],
    LIVE,
  );
  assert.deepEqual(g.map((x) => x.range), [
    { min: 700, max: 1500 },
    { min: 700, max: 1300 },
    { min: 700, max: 1100 },
    { min: 800, max: 1100 },
  ]);
  assert.equal(new Set(g.map((x) => x.query)).size, 4);
  // handles never cross: pushing min past max moves max too
  assert.deepEqual(nextBudgetDraft({ min: 700, max: 1100 }, 'min', 1200), { min: 1200, max: 1200 });
  assert.deepEqual(nextBudgetDraft({ min: 700, max: 1100 }, 'max', 600), { min: 600, max: 600 });
});

test('FilterSidebar budget commit uses the generation navigation (not dropped while navigating, no page1Ids)', () => {
  const src = read('components/results/filter-sidebar.tsx');
  const commit = src.split('const commitBudget = () => {')[1]!.slice(0, 900);
  assert.match(commit, /BUDGET_GENERATION_NAVIGATION/);
  assert.doesNotMatch(commit, /preservePage1Ids:\s*true/);
  assert.equal(BUDGET_GENERATION_NAVIGATION.allowWhileNavigating, true);
  assert.equal(BUDGET_GENERATION_NAVIGATION.preservePage1Ids, false);
  // An old tree's page1Ids write keeps Next's internal history state (__NA), so Next's
  // patched replaceState does NOT dispatch ACTION_RESTORE (which would discard a pending
  // newer navigation); it only touches the URL of the tree that is still current.
  assert.match(read('components/results/sync-page1-ids-to-url.tsx'), /replaceState\(window\.history\.state,/);
});

// ---------------------------------------------------------------------------------------
// I-K: default sort membership with the live p.p. price.
// ---------------------------------------------------------------------------------------
function makeLiveB(id: string, livePricePp: number): TravelOffer {
  return {
    id,
    provider: 'Corendon',
    hotelName: `Hotel ${id}`,
    destinationCountry: 'Spanje',
    destinationRegion: 'Mallorca',
    departureDate: '2026-11-24',
    nights: 8,
    flightIncluded: 'true',
    imageUrl: 'https://example.com/a.jpg',
    deepLink: 'https://www.corendon.be/vakantie#9514.COSPY.BRUPMI.241126.3-4-3.SZ-U',
    livePriceStatus: 'proven',
    livePriceSource: 'upsales',
    price: livePricePp,
    pricePerDay: Math.round(livePricePp / 8),
    liveTotalPrice: livePricePp,
    liveTotalPriceField: 'upsales.totalPrice',
  };
}
const BUDGET = { adults: 1, budgetMin: 764, budgetMax: 1560 } as SearchParams;

test('I/J/K: default-sort membership: 622 out, 764 in, 1560 in, 1561 out (same predicate as render)', () => {
  clearResultsLivePriceCache();
  const pool = [makeLiveB('p622', 622), makeLiveB('p764', 764), makeLiveB('p1560', 1560), makeLiveB('p1561', 1561)];
  const ids = bookableResultsMembership(pool, BUDGET).map((o) => o.id);
  assert.deepEqual(ids, ['p764', 'p1560']);
  for (const offer of pool) {
    assert.equal(ids.includes(offer.id), isPage1VisibleOffer(offer, BUDGET), offer.id);
  }
  // without a budget nothing is removed
  assert.equal(bookableResultsMembership(pool, { adults: 1 } as SearchParams).length, 4);
});

test('default sort: out-of-budget live B not in paginationTotal, hasMore or page slots', () => {
  clearResultsLivePriceCache();
  const below = Array.from({ length: 6 }, (_, i) => makeLiveB(`low-${i}`, 600 + i));
  const inside = Array.from({ length: 10 }, (_, i) => makeLiveB(`in-${i}`, 800 + i));
  const above = Array.from({ length: 4 }, (_, i) => makeLiveB(`high-${i}`, 1561 + i));
  const ranked = [...below.slice(0, 3), ...inside.slice(0, 5), ...above, ...below.slice(3), ...inside.slice(5)];
  const browsable = bookableResultsMembership(ranked, BUDGET);
  assert.equal(browsable.length, 10);
  assert.ok(browsable.every((o) => o.id.startsWith('in-')));
  // exactly 10 presentable B: page 1 is full, hasMore false (DEC-013 amendment unchanged)
  assert.equal(resultsHasMore({ presentableCount: browsable.length, windowEnd: 10, page: 1 }), false);
  const page1 = repairPage1FreezeOrder({ presentableOrdered: browsable, frozenIds: undefined, pageSize: 10 });
  const page2 = selectBrowsePageWithPage1Freeze({ browsable, page1Ids: page1.page1Ids, page: 2, pageSize: 10, browseCap: 150 });
  assert.equal(page2.paginationTotal, 10);
  assert.equal(page2.offers.length, 0);
});

test('frozen page-1 id whose live price leaves the budget (same generation): dropped + GO10 refill', () => {
  clearResultsLivePriceCache();
  const frozen = ['f1', 'f2', 'f3'];
  const now = [makeLiveB('f1', 900), makeLiveB('f2', 700 /* was 900, now below 764 */), makeLiveB('f3', 910), makeLiveB('n1', 920)];
  const browsable = bookableResultsMembership(now, BUDGET);
  // known B (not an unknown/pending anchor) -> not kept as a pending freeze anchor
  assert.equal(isFrozenPage1StatusUnknown(now[1]!), false);
  const repaired = repairPage1FreezeOrder({ presentableOrdered: browsable, frozenIds: frozen, pageSize: 3 });
  assert.deepEqual(repaired.page1Ids, ['f1', 'f3', 'n1']);
  assert.equal(repaired.usedFreeze, true);
  assert.equal(repaired.filledCount, 1);
});

test('H (server side): a late live price from an older generation is judged by the current budget', () => {
  clearResultsLivePriceCache();
  // G1 (no min) priced this offer at 622; G2 has budgetMin 764.
  const late = makeLiveB('late', 622);
  assert.equal(bookableResultsMembership([late], { adults: 1, budgetMax: 1500 } as SearchParams).length, 1);
  assert.equal(bookableResultsMembership([late], BUDGET).length, 0);
  assert.equal(isPage1VisibleOffer(late, BUDGET), false);
});