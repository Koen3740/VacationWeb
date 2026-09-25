/**
 * D-v2 S6 (owner GO 25-09 17:10): 1 s Page-1 hydrate budget + slot join of the
 * in-flight R2 read before the provider limiter. Plan tests T16, T18, T19 (incl. the
 * page-budget part reserved for S6), T20. Real timers, memory-style delayed backend,
 * provider fetch mocked (no network, no server, no port).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';
import type { TravelOffer } from '@/types/travel';
import {
  RESULTS_LIVE_PRICE_TTL_MS,
  awaitInflightL2ReadsForOffer,
  clearResultsLivePriceCache,
  getResultsLivePriceOverlay,
  hydrateResultsLivePriceOverlaysFromL2,
  livePriceCacheKey,
} from '@/lib/search/results-live-price-cache';
import {
  LIVE_PRICE_L2_SCHEMA_VERSION,
  getLivePriceL2InflightReadCountForTests,
  livePriceL2ObjectKey,
  resetLivePriceL2CircuitForTests,
  setLivePriceL2BackendForTests,
  setLivePriceL2EnabledForTests,
  type LivePriceL2Backend,
} from '@/lib/search/live-price-l2-store';
import {
  clearLivePriceInflightForTests,
  startCatalogPageLiveOverlays,
} from '@/lib/providers/prijsvrij/page1-receipt-pricing';
import { resetContextItemIdCacheForTests } from '@/lib/providers/context-item-id-cache';
import { hasValidPresentablePrice } from '@/lib/search/presentable-price';

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');
const BUDGET_MS = 1000;
const params = { adults: 2 } as const;

afterEach(() => {
  clearResultsLivePriceCache();
  setLivePriceL2EnabledForTests(null);
  setLivePriceL2BackendForTests(null);
  resetLivePriceL2CircuitForTests();
  clearLivePriceInflightForTests();
  resetContextItemIdCacheForTests();
});

const SUNWEB_LANDING =
  'https://www.sunweb.be/nl/vakantie/griekenland/kos/kos-stad/appartementen-bristol-seaview' +
  '?Duration[0]=8&TransportType[0]=Flight&Mealplan[0]=LG' +
  '&DepartureAirport[0]=BRU&DepartureDate[0]=2026-09-26' +
  '&Participants[0][0]=1990-01-15&Participants[0][1]=1988-03-03';
const SUNWEB_PRODUCT_URL =
  'https://www.sunweb.be/nl/vakantie/reizen?tt=1393_1754875_511747_&r=' +
  encodeURIComponent(SUNWEB_LANDING);
const SUNWEB_LANDING_HTML =
  JSON.stringify({ template: 'AccommodationPage', contextItemId: 'c1440175-b6ef-4dd3-b7ea-96c7143d47ea' }) +
  '"PDP.bookingGateId":"D7AF6C79-A074-4724-8595-F0A5DE507A04"' +
  '"PDP.promotedPriceId":"D07B99C8-DFE0-4B7A-86C5-B4DE9A4C6077"';

function makeSunweb(id: string): TravelOffer {
  return {
    id,
    provider: 'Sunweb',
    hotelName: 'Appartementen Bristol Seaview',
    destinationCountry: 'Griekenland',
    departureDate: '2026-09-26',
    nights: 7,
    flightIncluded: 'true',
    price: 427,
    pricePerDay: 61,
    imageUrl: 'https://example.com/a.jpg',
    deepLink: SUNWEB_PRODUCT_URL,
    livePriceStatus: 'catalog',
    livePriceSource: 'feed',
  } as TravelOffer;
}

const R2_OVERLAY = {
  price: 410,
  pricePerDay: 51,
  livePriceStatus: 'proven' as const,
  livePriceSource: 'getPromotedPrice' as const,
  liveTotalPrice: 820,
  liveTotalPriceField: 'getPromotedPrice.totalPrice' as const,
};

function recordBody(cacheKey: string): string {
  return JSON.stringify({
    schemaVersion: LIVE_PRICE_L2_SCHEMA_VERSION,
    cacheKey,
    cachedAtMs: Date.now(),
    ttlMs: RESULTS_LIVE_PRICE_TTL_MS,
    overlay: R2_OVERLAY,
  });
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Delayed R2 backend: record GETs answer after `delayFor(offerId)` ms (null = 404);
 * lock ops immediate. Honors abort (an aborted GET never answers).
 */
function delayedBackend(delayFor: (cacheKey: string) => { ms: number; found: boolean }) {
  const gets: Array<{ key: string; at: number }> = [];
  const t0 = Date.now();
  const backend: LivePriceL2Backend = {
    get(key, signal) {
      if (key.includes('/lock/')) return Promise.resolve(null);
      gets.push({ key, at: Date.now() - t0 });
      const plan = delayFor(key);
      return new Promise((resolve) => {
        const timer = setTimeout(() => resolve(plan.found ? recordBodyForObject(key) : null), plan.ms);
        signal?.addEventListener('abort', () => clearTimeout(timer));
      });
    },
    put: () => Promise.resolve(),
    putIfAbsent: () => Promise.resolve('created'),
    delete: () => Promise.resolve(),
  };
  // object key -> cache key mapping (object keys are hashed).
  const byObject = new Map<string, string>();
  function recordBodyForObject(objectKey: string): string {
    return recordBody(byObject.get(objectKey) ?? objectKey);
  }
  return { backend, gets, byObject };
}

function providerFetch() {
  const calls = { promoted: 0, total: 0, promotedAt: [] as number[] };
  const t0 = Date.now();
  const fetchImpl = (async (input: unknown) => {
    await sleep(20);
    const url = String(input);
    calls.total += 1;
    if (url.includes('GetPromotedPriceApi')) {
      calls.promoted += 1;
      calls.promotedAt.push(Date.now() - t0);
      return new Response(
        JSON.stringify({
          accommodationId: 84012,
          duration: 8,
          price: { totalPrice: 1010, averagePrice: 505, value: 505, legend: 'Vanafprijs p.p.' },
          departureDate: { raw: '2026-09-26' },
          acmInformation: { mealplanCode: 'LG' },
        }),
        { status: 200 },
      );
    }
    if (url.includes('GetPricesGroupedByDurationApi')) {
      const parsed = new URL(url);
      return new Response(
        JSON.stringify({
          errors: [],
          data: {
            isEmptyResponse: false,
            prices: [
              {
                minPricePerPerson: 505,
                averagePrice: 505,
                totalPrice: 1010,
                duration: parsed.searchParams.get('Duration[0]') ?? '8',
                transportType: 'Flight',
                mealplan: 'LG',
                departureDate: '2026-09-26',
              },
            ],
          },
        }),
        { status: 200 },
      );
    }
    if (url.includes('sunweb.be')) {
      return new Response(SUNWEB_LANDING_HTML, { status: 200 });
    }
    return new Response('unexpected', { status: 404 });
  }) as typeof fetch;
  return { fetchImpl, calls };
}

/** Same composition as catalog-live-page-state: budgeted hydrate, then overlays. */
async function pageState(offers: TravelOffer[], budgetMs: number | undefined, fetchImpl: typeof fetch) {
  const t0 = Date.now();
  const stats = await hydrateResultsLivePriceOverlaysFromL2(
    offers.map((offer) => offer.id),
    params,
    { offers, budgetMs },
  );
  const hydrateMs = Date.now() - t0;
  const overlays = startCatalogPageLiveOverlays(offers, params as never, { fetchImpl });
  return { stats, hydrateMs, overlays, t0 };
}

function keyedBackend(plan: Record<string, { ms: number; found: boolean }>) {
  const ids = Object.keys(plan);
  const h = delayedBackend((objectKey) => {
    for (const id of ids) {
      if (objectKey === objectKeyFor(id)) return plan[id]!;
    }
    return { ms: 5, found: false };
  });
  for (const id of ids) h.byObject.set(objectKeyFor(id), livePriceCacheKey(id, params));
  return h;
}

const objectKeyFor = (id: string) => livePriceL2ObjectKey(livePriceCacheKey(id, params));

test('T18 R2 at 800 ms: before the 1 s budget -> L1 seeded, slot not pending, 0 provider calls, 1 GET', async () => {
  setLivePriceL2EnabledForTests(true);
  const h = keyedBackend({ 'sunweb-18018': { ms: 800, found: true } });
  setLivePriceL2BackendForTests(h.backend);
  const { fetchImpl, calls } = providerFetch();
  const offer = makeSunweb('sunweb-18018');
  const state = await pageState([offer], BUDGET_MS, fetchImpl);
  assert.equal(state.stats.budgetHit, false);
  assert.equal(state.stats.hydrated, 1);
  assert.ok(state.hydrateMs >= 790 && state.hydrateMs < 1000, `hydrate ${state.hydrateMs} ms`);
  assert.equal(state.overlays[0]!.pending, false, 'seeded before overlays start');
  assert.equal((await state.overlays[0]!.live).price, 410);
  assert.equal(calls.total, 0, '0 provider calls');
  assert.equal(h.gets.length, 1, '1 GET');
});

test('T19 R2 at 1100 ms: page state continues at 1 s, slot joins the same read -> B with R2 price, 0 provider calls, 1 GET', async () => {
  setLivePriceL2EnabledForTests(true);
  const h = keyedBackend({ 'sunweb-19019': { ms: 1100, found: true } });
  setLivePriceL2BackendForTests(h.backend);
  const { fetchImpl, calls } = providerFetch();
  const offer = makeSunweb('sunweb-19019');
  const state = await pageState([offer], BUDGET_MS, fetchImpl);
  // Page-budget part (reserved for S6): the page state waits max ~1 s.
  assert.equal(state.stats.budgetHit, true);
  assert.equal(state.stats.hydrated, 0);
  assert.equal(state.stats.timedOut, 1);
  assert.ok(state.hydrateMs >= 990 && state.hydrateMs < 1090, `page state waited ${state.hydrateMs} ms`);
  assert.equal(getLivePriceL2InflightReadCountForTests(), 1, 'read keeps running after the budget');
  assert.equal(state.overlays[0]!.pending, true);
  const settled = await state.overlays[0]!.live;
  const settledAt = Date.now() - state.t0;
  assert.ok(hasValidPresentablePrice(settled), 'B');
  assert.equal(settled.price, 410, 'R2 price used (answer at 1.1 s is not discarded)');
  assert.ok(settledAt >= 1090 && settledAt < 1600, `slot settled at ${settledAt} ms`);
  assert.equal(calls.total, 0, '0 provider calls');
  assert.equal(h.gets.length, 1, '1 GET (joined, no second read)');
});

test('T19 limiter: waiting slots join before the limiter and hold no Sunweb slot (concurrency 5 unchanged)', async () => {
  setLivePriceL2EnabledForTests(true);
  const plan: Record<string, { ms: number; found: boolean }> = {};
  const slow = ['s1', 's2', 's3', 's4', 's5'].map((id) => `sunweb-9000${id.slice(1)}`);
  for (const id of slow) plan[id] = { ms: 1900, found: true };
  plan['sunweb-84012'] = { ms: 5, found: false };
  const h = keyedBackend(plan);
  setLivePriceL2BackendForTests(h.backend);
  const { fetchImpl, calls } = providerFetch();
  const offers = [...slow, 'sunweb-84012'].map(makeSunweb);
  const state = await pageState(offers, BUDGET_MS, fetchImpl);
  const results = await Promise.all(state.overlays.map((overlay) => overlay.live));
  for (const result of results.slice(0, 5)) assert.equal(result.price, 410, 'R2 price for joined slots');
  assert.equal(calls.promoted, 1, 'only the R2 miss calls the provider (DEC-011: 1 call)');
  // Without the join the 6th slot would wait for a limiter slot until the 5 reads end (~1.9 s).
  assert.ok(calls.promotedAt[0]! < 1600, `provider call for the miss at ${calls.promotedAt[0]} ms`);
});

test('T20 R2 at 2100 ms: timeout at 2000 ms, late answer not used/seeded, exactly 1 provider call', async () => {
  setLivePriceL2EnabledForTests(true);
  const h = keyedBackend({ 'sunweb-84012': { ms: 2100, found: true } });
  setLivePriceL2BackendForTests(h.backend);
  const { fetchImpl, calls } = providerFetch();
  const offer = makeSunweb('sunweb-84012');
  const joinStart = Date.now();
  const state = await pageState([offer], BUDGET_MS, fetchImpl);
  assert.equal(state.stats.budgetHit, true);
  const joinedOnly = await awaitInflightL2ReadsForOffer(offer, params);
  const joinedAt = Date.now() - joinStart;
  assert.equal(joinedOnly, 0, 'join sees timeout, seeds nothing');
  assert.ok(joinedAt >= 1990 && joinedAt < 2090, `shared read ended (timeout) at ${joinedAt} ms`);
  const settled = await state.overlays[0]!.live;
  assert.equal(calls.promoted, 1, 'exactly 1 provider call (DEC-011)');
  assert.notEqual(settled.price, 410, 'late R2 answer not used');
  assert.ok(hasValidPresentablePrice(settled), 'provider price after the timeout');
  await sleep(300);
  assert.notEqual(getResultsLivePriceOverlay('sunweb-84012', params)?.price, 410, 'late R2 answer not seeded');
  // A-43 fix: the gate reuses the joined (timed-out) outcome -> no second GET (S2).
  assert.equal(h.gets.length, 1, `GETs ${h.gets.length}`);
});

test('T16 budget scope: unfrozen page 1 only; frozen page 1 / page 2+ await the full (bounded) hydrate', async () => {
  const { resultsPageL2HydrateBudgetMs, RESULTS_PAGE_L2_HYDRATE_BUDGET_MS } = await import(
    '@/lib/search/results-live-price-cache'
  );
  assert.equal(RESULTS_PAGE_L2_HYDRATE_BUDGET_MS, 1000);
  assert.equal(resultsPageL2HydrateBudgetMs(true, undefined), 1000);
  assert.equal(resultsPageL2HydrateBudgetMs(true, []), 1000);
  assert.equal(resultsPageL2HydrateBudgetMs(true, ['a']), undefined, 'frozen page 1: no budget');
  assert.equal(resultsPageL2HydrateBudgetMs(false, undefined), undefined, 'page 2+: no budget');
  assert.equal(resultsPageL2HydrateBudgetMs(false, ['a']), undefined);

  setLivePriceL2EnabledForTests(true);
  const h = keyedBackend({ 't16-late': { ms: 1500, found: true }, 't16-hang': { ms: 60_000, found: true } });
  setLivePriceL2BackendForTests(h.backend);
  const t0 = Date.now();
  const late = await hydrateResultsLivePriceOverlaysFromL2(['t16-late'], params, { budgetMs: undefined });
  const lateMs = Date.now() - t0;
  assert.equal(late.hydrated, 1);
  assert.equal(late.budgetHit, false);
  assert.ok(lateMs >= 1490 && lateMs < 1900, `no budget: waited ${lateMs} ms for the 1.5 s read`);
  const t1 = Date.now();
  const hang = await hydrateResultsLivePriceOverlaysFromL2(['t16-hang'], params, {});
  const hangMs = Date.now() - t1;
  assert.equal(hang.hydrated, 0);
  assert.equal(hang.getTimeouts, 1);
  assert.ok(hangMs >= 1990 && hangMs < 2300, `reads bounded: ${hangMs} ms`);
});

test('S6 source: join before each limiter; budget only unfrozen page 1; frozen ids hydrated', () => {
  const pricing = read('lib/providers/prijsvrij/page1-receipt-pricing.ts');
  for (const limiter of ['limitCorendon', 'limitEliza', 'limitSunweb']) {
    assert.match(
      pricing,
      new RegExp(`await awaitInflightL2ReadsForOffer\\(catalog, params\\);\\r?\\n\\s+await ${limiter}\\(`),
    );
  }
  assert.match(pricing, /createPage1LiveLimiter\(CORENDON_LIVE_PAGE1_CONCURRENCY\)/);
  assert.match(pricing, /createPage1LiveLimiter\(ELIZA_LIVE_PAGE1_CONCURRENCY\)/);
  assert.match(pricing, /createPage1LiveLimiter\(SUNWEB_LIVE_PAGE1_CONCURRENCY\)/);
  const state = read('lib/search/catalog-live-page-state.ts');
  assert.match(state, /budgetMs: hydrateBudgetMs/);
  assert.match(state, /resultsPageL2HydrateBudgetMs\(isPage1, params\.page1Ids\)/);
  assert.match(state, /\.\.\.\(params\.page1Ids \?\? \[\]\)/);
  const cache = read('lib/search/results-live-price-cache.ts');
  assert.match(cache, /joinInflightLivePriceL2Read\(/);
  assert.doesNotMatch(cache.split('export async function awaitInflightL2ReadsForOffer')[1] ?? '', /readLivePriceL2RecordResult\(/, 'join never starts a read');
});
