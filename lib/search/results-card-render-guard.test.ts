import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { CORENDON_PROVIDER_NAME } from '@/lib/providers/corendon/constants';
import { isResultsListableOffer } from '@/lib/search/presentable-price';
import {
  orderCatalogPageCandidates,
  sliceRankedCatalogResultsPage,
} from '@/lib/search/results-catalog-page';
import {
  clearResultsLivePriceCache,
  setResultsLivePriceOverlay,
} from '@/lib/search/results-live-price-cache';
import type { SearchParams, TravelOffer } from '@/types/travel';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

function makeOffer(
  overrides: Partial<TravelOffer> & Pick<TravelOffer, 'id' | 'price'>,
): TravelOffer {
  return {
    provider: CORENDON_PROVIDER_NAME,
    hotelName: 'Test Hotel',
    destinationCountry: 'Turkije',
    destinationRegion: 'Antalya',
    departureDate: '2026-09-10',
    nights: 8,
    flightIncluded: 'true',
    pricePerDay: Math.round(overrides.price / 8),
    currency: 'EUR',
    imageUrl: '/images/results-card-placeholder.png',
    deepLink: 'https://www.corendon.be/vakantie#9514.COSPY.BRUAYT.100926.8.SZ-U',
    livePriceStatus: 'catalog',
    ...overrides,
  };
}

const params: SearchParams = {
  adults: 2,
  countries: ['Turkije'],
  nights: [8],
};

test('count>0 never paginates a page of only settled failures (empty cards)', () => {
  clearResultsLivePriceCache();
  const proven = {
    livePriceStatus: 'proven' as const,
    livePriceSource: 'upsales' as const,
    liveTotalPrice: 1600,
    liveTotalPriceField: 'upsales.totalPrice' as const,
  };
  const ranked = [
    ...Array.from({ length: 5 }, (_, index) =>
      makeOffer({ id: `ok-${index}`, price: 800 + index, ...proven }),
    ),
    ...Array.from({ length: 30 }, (_, index) =>
      makeOffer({
        id: `fail-${index}`,
        price: 900 + index,
        livePriceStatus: 'unavailable',
        livePriceFailureReason: 'unavailable_trip',
      }),
    ),
  ];

  for (const offer of ranked) {
    if (offer.livePriceStatus === 'unavailable') {
      setResultsLivePriceOverlay(offer.id, params, {
        price: offer.price,
        pricePerDay: offer.pricePerDay,
        livePriceStatus: 'unavailable',
        livePriceSource: 'lowestpricesacco',
        livePriceFailureReason: 'unavailable_trip',
      });
    } else {
      setResultsLivePriceOverlay(offer.id, params, {
        price: offer.price,
        pricePerDay: offer.pricePerDay,
        livePriceStatus: 'proven',
        livePriceSource: 'upsales',
        liveTotalPrice: 1600,
        liveTotalPriceField: 'upsales.totalPrice',
      });
    }
  }

  const browseable = orderCatalogPageCandidates(ranked, params);
  assert.equal(browseable.length, 5);
  assert.ok(browseable.every(isResultsListableOffer));

  const pageSize = 10;
  const page = sliceRankedCatalogResultsPage(ranked, 1, pageSize, params);
  assert.equal(page.paginationTotal, 5);
  assert.ok(page.offers.length > 0);
  assert.ok(page.offers.every(isResultsListableOffer));

  // No later page of only settled shells — previously caused count>0 + empty cards.
  const emptyTail = sliceRankedCatalogResultsPage(ranked, 2, pageSize, params);
  assert.equal(emptyTail.offers.length, 0);
});

test('results page uses browseable pool length for the user-facing count', () => {
  const pageSource = readFileSync(join(ROOT, 'app/results/page.tsx'), 'utf8');
  assert.match(pageSource, /matchCount = orderedPool\.length/);
  assert.doesNotMatch(pageSource, /matchCount = filtered\.length/);
});
