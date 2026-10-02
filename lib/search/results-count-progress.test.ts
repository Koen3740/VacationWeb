/**
 * t334u regression: Results count / pagination / provider list under progressive live pricing.
 *
 * Proven root causes (t334u): the heading, the provider select and the page-1 pagination
 * were one-shot server snapshots of the proven-B pool (first B, or after an unbudgeted
 * full-matchset L2 hydrate); the provider list was built from that same pool, so with 0 B
 * it only held "Alle aanbieders"; the browse total was frozen at page-1 settle (~10-12).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, it } from 'node:test';
import { loadOffers } from '@/lib/offers/load-offers';
import { formatPoolCountStep } from '@/lib/search/results-count-labels';
import { listProvidersInMatchset } from '@/lib/search/provider-filter';
import { excludeParkedResultsProviders } from '@/lib/search/presentable-price';
import { parseSearchParams } from '@/lib/search/parse-search-params';
import { prepareResultsOffers } from '@/lib/search/prepare-results-offers';
import {
  clearResultsLivePriceCache,
  getResultsLivePriceCacheVersion,
  setResultsLivePriceOverlay,
} from '@/lib/search/results-live-price-cache';
import { createPoolProgressTracker } from '@/lib/search/results-pool-progress';
import { createResultsPoolReader, memoizeByCacheVersion } from '@/lib/search/results-pool-reading';
import type { SearchParams, TravelOffer } from '@/types/travel';

const params: SearchParams = { adults: 2, countries: ['Griekenland'] };

function makeOffer(id: string, provider: TravelOffer['provider'], price = 800): TravelOffer {
  return {
    id,
    provider,
    hotelName: `Hotel ${id}`,
    destinationCountry: 'Griekenland',
    departureDate: '2026-10-10',
    departureAirport: 'BRU',
    nights: 8,
    flightIncluded: 'true',
    price,
    pricePerDay: Math.round(price / 8),
    currency: 'EUR',
    imageUrl: '/images/results-card-placeholder.png',
    deepLink: `https://example.com/${id}`,
    livePriceStatus: 'catalog',
  };
}

function seedB(offer: TravelOffer, forParams: SearchParams = params): void {
  setResultsLivePriceOverlay(offer.id, forParams, {
    price: offer.price,
    pricePerDay: offer.pricePerDay,
    livePriceStatus: 'proven',
    livePriceSource: offer.provider === 'Corendon' ? 'upsales' : 'getPromotedPrice',
    liveTotalPrice: offer.price * 2,
    liveTotalPriceField:
      offer.provider === 'Corendon' ? 'upsales.totalPrice' : 'getPromotedPrice.totalPrice',
  });
}

function seedA(offer: TravelOffer, forParams: SearchParams = params): void {
  setResultsLivePriceOverlay(offer.id, forParams, {
    price: 999,
    pricePerDay: 125,
    livePriceStatus: 'unavailable',
    livePriceFailureReason: 'http_204',
  });
}

beforeEach(() => {
  clearResultsLivePriceCache();
});

describe('t334u progressive count: labels', () => {
  const hero = { variant: 'hero' as const, summaryLine: 'Griekenland \u2022 8 nachten', matchsetEmpty: false };
  const section = { variant: 'section' as const, summaryLine: '', matchsetEmpty: false };

  it('0 proven B with a non-empty matchset: count-less, never "Geen", never a fake count', () => {
    assert.equal(formatPoolCountStep({ count: 0, checking: false }, hero), 'Vakanties in Griekenland');
    assert.equal(formatPoolCountStep({ count: 0, checking: false }, section), 'Vakanties');
    assert.equal(
      formatPoolCountStep({ count: 0, checking: true }, section),
      'Vakanties worden gecontroleerd',
    );
  });

  it('count > 0: hero is a plain count, the section adds "meer worden gecontroleerd" only while checking', () => {
    assert.equal(formatPoolCountStep({ count: 311, checking: true }, hero), '311 vakanties in Griekenland');
    assert.equal(
      formatPoolCountStep({ count: 311, checking: true }, section),
      '311 vakanties gevonden, meer worden gecontroleerd',
    );
    assert.equal(formatPoolCountStep({ count: 311, checking: false }, section), '311 vakanties gevonden');
    assert.equal(
      formatPoolCountStep({ count: 29, checking: false }, { ...section, provider: 'Eliza was here' }),
      '29 vakanties gevonden bij Eliza was here',
    );
  });

  it('empty matchset is the only definitive "Geen vakanties gevonden"', () => {
    assert.equal(
      formatPoolCountStep({ count: 0, checking: false }, { ...section, matchsetEmpty: true }),
      'Geen vakanties gevonden',
    );
  });
});

describe('t334u progressive count: reader + tracker on the real L1 pool', () => {
  it('heading follows live pricing 0 -> N and ends definitive at the proven B count (A excluded) - real catalog, Agia Marina', async () => {
    const catalog = excludeParkedResultsProviders(await loadOffers());
    const search = parseSearchParams({ country: 'Griekenland', city: 'Agia Marina', adults: '2', dob: ',' });
    const matchset = await (await prepareResultsOffers(catalog, search)).exactOffers;
    assert.ok(matchset.length >= 10, `Agia Marina matchset: ${matchset.length}`);
    clearResultsLivePriceCache();

    let clock = 0;
    const reader = createResultsPoolReader(matchset, search, { now: () => clock, reuseMs: 0 });
    const initial = reader();
    assert.equal(initial.count, 0);
    assert.ok((initial.pending ?? 0) > 0, 'eligible offers are unsettled');
    assert.equal(initial.complete, false);

    // "live pricing": one offer settles per poll; every 4th is A (never counted).
    let settledSoFar = 0;
    let provenB = 0;
    const tracker = createPoolProgressTracker({
      read: reader,
      now: () => clock,
      sleep: async (ms) => {
        clock += ms;
        const offer = matchset[settledSoFar];
        if (offer) {
          if (settledSoFar % 4 === 3) {
            seedA(offer, search);
          } else {
            seedB(offer, search);
            provenB += 1;
          }
          settledSoFar += 1;
        }
      },
    });
    const counts: number[] = [];
    let last = await tracker.next();
    counts.push(last.count);
    while (!last.final && counts.length < 500) {
      last = await tracker.next();
      if (last.changed) counts.push(last.count);
    }
    assert.equal(counts[0], 0, 'first step is immediate and count-less');
    assert.ok(counts.length > 3, `several progressive steps, not one snapshot: ${counts.join(',')}`);
    assert.ok(counts.every((c, i) => i === 0 || c >= counts[i - 1]!));
    assert.equal(last.final, true);
    assert.equal(last.complete, true, 'every eligible offer settled -> definitive');
    assert.equal(last.checking, false);
    assert.equal(last.count, provenB, 'final count = proven B only (A excluded)');
    assert.ok(provenB > 0 && provenB < matchset.length);
  });

  it('memoizeByCacheVersion skips recomputation while nothing changed and recomputes after a write', () => {
    let computed = 0;
    let clock = 0;
    const read = memoizeByCacheVersion(() => ++computed, { now: () => clock, reuseMs: 300 });
    assert.equal(read(), 1);
    clock += 5000;
    assert.equal(read(), 1, 'same L1 version -> no recompute, however much time passed');
    const before = getResultsLivePriceCacheVersion();
    seedB(makeOffer('x1', 'Sunweb'));
    assert.notEqual(getResultsLivePriceCacheVersion(), before);
    assert.equal(read(), 2, 'L1 changed -> recompute');
    clock += 100;
    seedB(makeOffer('x2', 'Sunweb'));
    assert.equal(read(), 2, 'a read < reuseMs old is reused');
  });

  it('the poll never waits less than 40x the cost of the previous read (bounded CPU)', async () => {
    let clock = 0;
    const sleeps: number[] = [];
    const tracker = createPoolProgressTracker({
      read: () => {
        clock += 50; // a 50 ms read
        return { count: 3, pending: 10, complete: false };
      },
      now: () => clock,
      sleep: async (ms) => {
        sleeps.push(ms);
        clock += ms;
      },
    });
    await tracker.next();
    await tracker.next();
    assert.ok(sleeps.length > 0);
    assert.ok(sleeps.every((ms) => ms >= 50 * 40));
  });
});

describe('t334u provider list comes from the matchset, not from live pricing', () => {
  it('listProvidersInMatchset: distinct, trimmed, sorted; independent of any overlay', () => {
    const matchset = [
      makeOffer('1', 'Sunweb'),
      makeOffer('2', 'Corendon'),
      makeOffer('3', 'Sunweb'),
      makeOffer('4', 'Eliza was here'),
    ];
    assert.deepEqual(listProvidersInMatchset(matchset), ['Corendon', 'Eliza was here', 'Sunweb']);
    assert.deepEqual(listProvidersInMatchset([]), []);
  });

  it('real catalog (Griekenland, 8-11 nachten, 2 pers., BE+AMS): Corendon, Eliza was here and Sunweb are listed with 0 proven B', async () => {
    const catalog = excludeParkedResultsProviders(await loadOffers());
    const search = parseSearchParams({
      country: 'Griekenland',
      departureStart: '2026-10-03',
      departureEnd: '2026-12-31',
      nights: '8,9,10,11',
      adults: '2',
      dob: ',',
      departureAirport: 'BRU,CRL,ANR,OST,LGG,AMS',
    });
    const prepared = await prepareResultsOffers(catalog, search);
    const matchset = await prepared.exactOffers;
    assert.ok(matchset.length > 0);
    clearResultsLivePriceCache();
    const providers = listProvidersInMatchset(matchset);
    for (const name of ['Corendon', 'Eliza was here', 'Sunweb']) {
      assert.ok(providers.includes(name), `${name} missing: ${providers.join(', ')}`);
    }
    // ... while the proven-B pool is still empty (nothing priced yet)
    assert.equal(createResultsPoolReader(matchset, search)().count, 0);
  });

  it('source guards: provider list is built from the matchset, "Alle aanbieders" stays, no B/hydrate dependency', () => {
    const fromPool = readFileSync('components/results/provider-filter-from-pool.tsx', 'utf8');
    assert.match(fromPool, /listProvidersInMatchset/);
    assert.doesNotMatch(fromPool, /bookableResultsMembership|countProvidersInEffectivePool/);
    assert.doesNotMatch(fromPool, /hydrateResultsLivePriceOverlaysFromL2/);
    const select = readFileSync('components/results/provider-filter-select.tsx', 'utf8');
    assert.match(select, /<option value="">Alle aanbieders<\/option>/);
    assert.match(select, /typeof entry\.count === 'number'/);
  });
});

describe('t334u source guards: no fixed wait loop, no blocking hydrate, progressive pagination', () => {
  it('the heading never awaits the full-matchset L2 hydrate and has no fixed wait loop', () => {
    const heading = readFileSync('components/results/presentable-results-count.tsx', 'utf8');
    assert.doesNotMatch(heading, /await\s+hydrateResultsLivePriceOverlaysFromL2/);
    assert.doesNotMatch(heading, /settleHeadingCount|heading-count-settle|PAGE1_SETTLE_DEADLINE_MS/);
    assert.match(heading, /startResultsPoolL2Hydrate/);
    assert.match(heading, /PoolProgressStream/);
    const hydrate = readFileSync('lib/search/results-pool-hydrate.ts', 'utf8');
    assert.match(hydrate, /void hydrateResultsLivePriceOverlaysFromL2/);
  });

  it('page-1 pagination follows the browse total as streamed steps; the page1Ids freeze is untouched', () => {
    const stream = readFileSync('components/results/page1-receipt-stream.tsx', 'utf8');
    assert.match(stream, /PoolProgressStream/);
    assert.match(stream, /resolvePage1SettleOutput\(\{\s*\.\.\.settleArgs,\s*browseTotal: step\.count/);
    assert.match(stream, /<SyncPage1IdsToUrl/);
    assert.match(stream, /page1Ids=\{output\.page1Ids\}/);
  });

  it('live-pricing admission / S6 / schedule files are not part of this change', () => {
    for (const file of [
      'lib/search/live-pricing-admission.ts',
      'lib/search/s6-dynamic-refill.ts',
      'lib/search/schedule-capped-matchset-live-after-page.ts',
    ]) {
      const src = readFileSync(file, 'utf8');
      assert.doesNotMatch(src, /results-pool-progress|PoolProgress/);
    }
  });
});
