/**
 * Provider filter on the proven-B (effective) Results pool — not catalog matchset.
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import type { SearchParams, TravelOffer } from '@/types/travel';
import {
  CORENDON_PROVIDER_NAME,
  ELIZA_PROVIDER_NAME,
  PRIJSVRIJ_PROVIDER_NAME,
  SUNWEB_PROVIDER_NAME,
} from '@/lib/search/presentable-price';
import {
  countProvidersInEffectivePool,
  omitProviderFilter,
  offerMatchesProviderFilter,
  parseProviderParam,
  serializeProviderParam,
} from '@/lib/search/provider-filter';
import { parseSearchParams } from '@/lib/search/parse-search-params';
import {
  bookableResultsMembership,
  selectResultsBrowsePool,
  sliceRankedCatalogResultsPage,
} from '@/lib/search/results-catalog-page';
import { countResultsPool } from '@/lib/search/results-pool-count';
import { applyFilterNavigationPaging } from '@/lib/search/filter-navigation';
import { buildResultsSearchQuery } from '@/lib/search/pagination';
import {
  clearResultsLivePriceCache,
  setResultsLivePriceOverlay,
} from '@/lib/search/results-live-price-cache';

const baseParams: SearchParams = { adults: 2, countries: ['Spanje'] };

function makeOffer(
  id: string,
  price: number,
  provider: string,
): TravelOffer {
  return {
    id,
    provider,
    hotelName: `Hotel ${id}`,
    destinationCountry: 'Spanje',
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

function seedB(id: string, price: number, provider: string, params: SearchParams = baseParams): void {
  const source =
    provider === CORENDON_PROVIDER_NAME
      ? ('upsales' as const)
      : ('getPromotedPrice' as const);
  setResultsLivePriceOverlay(id, params, {
    price,
    pricePerDay: Math.round(price / 8),
    livePriceStatus: 'proven',
    livePriceSource: source,
    liveTotalPrice: price * 2,
    liveTotalPriceField:
      provider === CORENDON_PROVIDER_NAME
        ? 'upsales.totalPrice'
        : 'getPromotedPrice.totalPrice',
  });
}

function seedA(id: string, params: SearchParams = baseParams): void {
  setResultsLivePriceOverlay(id, params, {
    price: 999,
    pricePerDay: 125,
    livePriceStatus: 'unavailable',
    livePriceFailureReason: 'http_204',
  });
}

beforeEach(() => {
  clearResultsLivePriceCache();
});

describe('provider filter URL parse', () => {
  it('absent provider means all providers', () => {
    assert.equal(parseProviderParam(undefined), undefined);
    assert.equal(parseProviderParam(''), undefined);
    assert.equal(parseProviderParam('  '), undefined);
    assert.equal(parseSearchParams({}).provider, undefined);
  });

  it('parses exact TravelOffer.provider strings', () => {
    assert.equal(parseProviderParam(CORENDON_PROVIDER_NAME), CORENDON_PROVIDER_NAME);
    assert.equal(parseProviderParam(SUNWEB_PROVIDER_NAME), SUNWEB_PROVIDER_NAME);
    assert.equal(parseProviderParam(ELIZA_PROVIDER_NAME), ELIZA_PROVIDER_NAME);
    assert.equal(
      parseSearchParams({ provider: ELIZA_PROVIDER_NAME }).provider,
      ELIZA_PROVIDER_NAME,
    );
    assert.equal(serializeProviderParam(CORENDON_PROVIDER_NAME), CORENDON_PROVIDER_NAME);
  });
});

describe('provider filter on effective Results pool', () => {
  it('no provider filter keeps full proven-B count', () => {
    const catalog = [
      ...Array.from({ length: 100 }, (_, i) => makeOffer(`sun-${i}`, 400 + i, SUNWEB_PROVIDER_NAME)),
      ...Array.from({ length: 100 }, (_, i) => makeOffer(`eliza-${i}`, 500 + i, ELIZA_PROVIDER_NAME)),
      ...Array.from({ length: 150 }, (_, i) =>
        makeOffer(`cor-${i}`, 600 + i, CORENDON_PROVIDER_NAME),
      ),
      ...Array.from({ length: 50 }, (_, i) => makeOffer(`a-${i}`, 700 + i, SUNWEB_PROVIDER_NAME)),
    ];
    for (let i = 0; i < 100; i++) seedB(`sun-${i}`, 400 + i, SUNWEB_PROVIDER_NAME);
    for (let i = 0; i < 100; i++) seedB(`eliza-${i}`, 500 + i, ELIZA_PROVIDER_NAME);
    for (let i = 0; i < 150; i++) seedB(`cor-${i}`, 600 + i, CORENDON_PROVIDER_NAME);
    for (let i = 0; i < 50; i++) seedA(`a-${i}`);

    assert.equal(countResultsPool(catalog, baseParams), 350);
    assert.equal(countResultsPool(catalog, { ...baseParams, provider: undefined }), 350);
  });

  it('provider filter returns only that provider from the B pool', () => {
    const catalog = [
      makeOffer('sun-1', 400, SUNWEB_PROVIDER_NAME),
      makeOffer('eliza-1', 500, ELIZA_PROVIDER_NAME),
      makeOffer('cor-1', 600, CORENDON_PROVIDER_NAME),
      makeOffer('sun-a', 700, SUNWEB_PROVIDER_NAME),
    ];
    seedB('sun-1', 400, SUNWEB_PROVIDER_NAME);
    seedB('eliza-1', 500, ELIZA_PROVIDER_NAME);
    seedB('cor-1', 600, CORENDON_PROVIDER_NAME);
    seedA('sun-a');

    const corendon = bookableResultsMembership(catalog, {
      ...baseParams,
      provider: CORENDON_PROVIDER_NAME,
    });
    assert.deepEqual(
      corendon.map((o) => o.id),
      ['cor-1'],
    );
    assert.equal(
      countResultsPool(catalog, { ...baseParams, provider: SUNWEB_PROVIDER_NAME }),
      1,
    );
    assert.equal(
      countResultsPool(catalog, { ...baseParams, provider: ELIZA_PROVIDER_NAME }),
      1,
    );
  });

  it('example: 350 B → counts 100 Sunweb / 100 Eliza / 150 Corendon (not catalog)', () => {
    const catalog: TravelOffer[] = [];
    // Catalog larger than effective pool (extra A + parked).
    for (let i = 0; i < 100; i++) {
      catalog.push(makeOffer(`sun-${i}`, 400 + i, SUNWEB_PROVIDER_NAME));
      seedB(`sun-${i}`, 400 + i, SUNWEB_PROVIDER_NAME);
    }
    for (let i = 0; i < 100; i++) {
      catalog.push(makeOffer(`eliza-${i}`, 500 + i, ELIZA_PROVIDER_NAME));
      seedB(`eliza-${i}`, 500 + i, ELIZA_PROVIDER_NAME);
    }
    for (let i = 0; i < 150; i++) {
      catalog.push(makeOffer(`cor-${i}`, 600 + i, CORENDON_PROVIDER_NAME));
      seedB(`cor-${i}`, 600 + i, CORENDON_PROVIDER_NAME);
    }
    for (let i = 0; i < 80; i++) {
      catalog.push(makeOffer(`fail-${i}`, 900 + i, CORENDON_PROVIDER_NAME));
      seedA(`fail-${i}`);
    }
    for (let i = 0; i < 20; i++) {
      catalog.push(makeOffer(`pv-${i}`, 300 + i, PRIJSVRIJ_PROVIDER_NAME));
      seedB(`pv-${i}`, 300 + i, PRIJSVRIJ_PROVIDER_NAME);
    }

    assert.ok(catalog.length > 350);

    const effective = bookableResultsMembership(catalog, baseParams);
    // Prijsvrij is parked from listable Results → not in effective pool.
    assert.equal(effective.length, 350);
    assert.ok(!effective.some((o) => o.provider === PRIJSVRIJ_PROVIDER_NAME));

    const counts = countProvidersInEffectivePool(effective);
    assert.equal(counts.total, 350);
    assert.deepEqual(
      Object.fromEntries(counts.providers.map((p) => [p.provider, p.count])),
      {
        [CORENDON_PROVIDER_NAME]: 150,
        [ELIZA_PROVIDER_NAME]: 100,
        [SUNWEB_PROVIDER_NAME]: 100,
      },
    );
    assert.equal(
      counts.providers.reduce((sum, p) => sum + p.count, 0),
      350,
    );

    // Must not derive counts from raw catalog (would include A + parked).
    const wrongCatalogCounts = countProvidersInEffectivePool(catalog);
    assert.notEqual(wrongCatalogCounts.total, 350);
  });

  it('parked / non-effective providers do not appear in options', () => {
    const catalog = [
      makeOffer('sun-1', 400, SUNWEB_PROVIDER_NAME),
      makeOffer('pv-1', 300, PRIJSVRIJ_PROVIDER_NAME),
    ];
    seedB('sun-1', 400, SUNWEB_PROVIDER_NAME);
    seedB('pv-1', 300, PRIJSVRIJ_PROVIDER_NAME);

    const counts = countProvidersInEffectivePool(
      bookableResultsMembership(catalog, baseParams),
    );
    assert.deepEqual(
      counts.providers.map((p) => p.provider),
      [SUNWEB_PROVIDER_NAME],
    );
  });
});

describe('provider filter + sort / pagination', () => {
  it('Default / Low→High / High→Low stay within the provider subset', () => {
    const catalog = [
      makeOffer('sun-cheap', 300, SUNWEB_PROVIDER_NAME),
      makeOffer('sun-mid', 500, SUNWEB_PROVIDER_NAME),
      makeOffer('sun-high', 900, SUNWEB_PROVIDER_NAME),
      makeOffer('cor-cheap', 200, CORENDON_PROVIDER_NAME),
      makeOffer('cor-high', 800, CORENDON_PROVIDER_NAME),
    ];
    for (const offer of catalog) {
      seedB(offer.id, offer.price, offer.provider);
    }

    const sunParams: SearchParams = {
      ...baseParams,
      provider: SUNWEB_PROVIDER_NAME,
    };
    const defaultBrowse = selectResultsBrowsePool(catalog, sunParams, 150);
    assert.equal(defaultBrowse.length, 3);
    assert.ok(defaultBrowse.every((o) => o.provider === SUNWEB_PROVIDER_NAME));

    const lowHigh = selectResultsBrowsePool(
      catalog,
      { ...sunParams, sort: 'price' },
      150,
    );
    assert.deepEqual(
      lowHigh.map((o) => o.id),
      ['sun-cheap', 'sun-mid', 'sun-high'],
    );

    const highLowMembership = bookableResultsMembership(catalog, {
      ...sunParams,
      sort: 'price-desc',
    });
    assert.equal(highLowMembership.length, 3);
    assert.ok(highLowMembership.every((o) => o.provider === SUNWEB_PROVIDER_NAME));
    // price-desc browse uses ranked input order; production ranks before browse.
    const rankedDesc = [...highLowMembership].sort((a, b) => b.price - a.price);
    const highLow = selectResultsBrowsePool(rankedDesc, { ...sunParams, sort: 'price-desc' }, 150);
    assert.deepEqual(
      highLow.map((o) => o.id),
      ['sun-high', 'sun-mid', 'sun-cheap'],
    );
  });

  it('pagination page 2 only contains the selected provider', () => {
    const catalog = Array.from({ length: 25 }, (_, i) => {
      const provider = i < 20 ? CORENDON_PROVIDER_NAME : SUNWEB_PROVIDER_NAME;
      return makeOffer(`${provider}-${i}`, 400 + i, provider);
    });
    for (const offer of catalog) {
      seedB(offer.id, offer.price, offer.provider);
    }

    const page2 = sliceRankedCatalogResultsPage(
      catalog,
      2,
      10,
      { ...baseParams, provider: CORENDON_PROVIDER_NAME, sort: 'price' },
    );
    assert.equal(page2.offers.length, 10);
    assert.ok(page2.offers.every((o) => o.provider === CORENDON_PROVIDER_NAME));
    assert.equal(page2.paginationTotal, 20);
  });

  it('provider switch clears page1Ids via filter navigation', () => {
    const params = new URLSearchParams(
      'country=Spanje&provider=Corendon&page=2&page1Ids=a,b,c',
    );
    applyFilterNavigationPaging(params, { preservePage1Ids: false });
    assert.equal(params.get('page'), null);
    assert.equal(params.get('page1Ids'), null);
  });

  it('pagination href carries provider', () => {
    const query = buildResultsSearchQuery(
      { ...baseParams, provider: CORENDON_PROVIDER_NAME },
      2,
    );
    assert.equal(query.get('provider'), CORENDON_PROVIDER_NAME);
    assert.equal(query.get('page'), '2');
  });
});

describe('provider filter helpers', () => {
  it('omitProviderFilter removes only provider', () => {
    const withProvider: SearchParams = {
      ...baseParams,
      provider: CORENDON_PROVIDER_NAME,
      hasCarRental: true,
    };
    const omitted = omitProviderFilter(withProvider);
    assert.equal(omitted.provider, undefined);
    assert.equal(omitted.hasCarRental, true);
    assert.equal(omitted.countries?.[0], 'Spanje');
  });

  it('offerMatchesProviderFilter uses exact provider equality', () => {
    assert.equal(
      offerMatchesProviderFilter({ provider: ELIZA_PROVIDER_NAME }, ELIZA_PROVIDER_NAME),
      true,
    );
    assert.equal(
      offerMatchesProviderFilter({ provider: ELIZA_PROVIDER_NAME }, 'eliza'),
      false,
    );
    assert.equal(offerMatchesProviderFilter({ provider: SUNWEB_PROVIDER_NAME }, undefined), true);
  });
});
