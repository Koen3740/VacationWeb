import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { CORENDON_PROVIDER_NAME } from '@/lib/providers/corendon/constants';
import { isResultsListableOffer } from '@/lib/search/presentable-price';
import {
  orderCatalogPageCandidates,
  selectPage1OverlayCandidates,
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

test('count/pagination keep full matchset; cards skip settled via listability', () => {
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

  const ordered = orderCatalogPageCandidates(ranked, params);
  assert.equal(ordered.length, 35);
  assert.equal(ordered.filter(isResultsListableOffer).length, 5);

  const pageSize = 10;
  const page = sliceRankedCatalogResultsPage(ranked, 1, pageSize, params);
  assert.equal(page.paginationTotal, 35);
  // Sort-order page may include settled shells; card layer filters them.
  assert.equal(page.offers.filter(isResultsListableOffer).length, 5);

  // Overlay window skips settled shells and still reaches the presentable offers.
  const overlayWindow = selectPage1OverlayCandidates(ordered, pageSize, undefined, params);
  assert.equal(overlayWindow.length, 5);
  assert.ok(overlayWindow.every(isResultsListableOffer));
});

test('results page uses filter matchset length for the user-facing count', () => {
  const pageSource = readFileSync(join(ROOT, 'app/results/page.tsx'), 'utf8');
  assert.match(pageSource, /matchCount = filtered\.length/);
  assert.doesNotMatch(pageSource, /matchCount = orderedPool\.length/);
});
