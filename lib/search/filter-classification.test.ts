import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FAST_FILTER_PARAMS,
  NEW_SEARCH_OCCUPANCY_PARAMS,
  occupancySearchParamsChanged,
  shouldPreservePage1Ids,
} from './filter-classification';
import { applyFilterNavigationPaging } from './filter-navigation';
import { presentCatalogPage1WithoutLivePricing, resolveResultsPageSlice } from '@/lib/providers/prijsvrij';
import type { TravelOffer } from '@/types/travel';
import type { Page1ReceiptPricingStats } from '@/lib/providers/prijsvrij';
import filterOptions from '@/data/filter-options.json';
import { formatDepartureAirportLabel } from './departure-airports';

function makeOffer(overrides: Partial<TravelOffer> = {}): TravelOffer {
  const provider = overrides.provider ?? 'Corendon';
  const sunwebLanding =
    'https://www.sunweb.be/nl/vakantie/x?Duration[0]=8&TransportType[0]=Flight&Mealplan[0]=LO&DepartureAirport[0]=BRU&DepartureDate[0]=2026-08-20';
  const deepLink =
    provider === 'Sunweb'
      ? `https://www.sunweb.be/nl/vakantie/reizen?tt=1&r=${encodeURIComponent(sunwebLanding)}`
      : provider === 'Prijsvrij'
        ? 'https://www.prijsvrij.be/vakantie/?r=' +
          encodeURIComponent('https://www.prijsvrij.be/vakanties/spanje?transport=vl')
        : 'https://www.corendon.be/vakantie#5007.MLELC.BRUPMI.200826.8.DZI-U';
  return {
    id: 'test-1',
    provider,
    hotelName: 'Test Hotel',
    destinationCountry: 'Spanje',
    nights: 8,
    price: 800,
    pricePerDay: 100,
    stars: 4,
    boardType: 'All Inclusive',
    imageUrl: 'https://example.com/a.jpg',
    flightIncluded: 'true',
    departureAirport: 'BRU',
    deepLink,
    ...overrides,
  };
}

function emptyStats(): Page1ReceiptPricingStats {
  return {
    receiptCalls: 0,
    receiptSuccesses: 0,
    receiptFailures: 0,
    prijsvrijSlotsFilled: 0,
    stoppedEarlyBecauseEnoughPv: false,
  };
}

test('classification: catalog params are FAST; occupancy is NEW SEARCH', () => {
  assert.ok(FAST_FILTER_PARAMS.includes('stars'));
  assert.ok(FAST_FILTER_PARAMS.includes('boardTypes'));
  assert.ok(FAST_FILTER_PARAMS.includes('amenities'));
  assert.ok(FAST_FILTER_PARAMS.includes('vacationTypes'));
  assert.ok(FAST_FILTER_PARAMS.includes('hasCarRental'));
  assert.ok(FAST_FILTER_PARAMS.includes('country'));
  assert.ok(FAST_FILTER_PARAMS.includes('departureAirport'));
  assert.ok(FAST_FILTER_PARAMS.includes('nights'));
  assert.ok(FAST_FILTER_PARAMS.includes('sort'));
  assert.ok(NEW_SEARCH_OCCUPANCY_PARAMS.includes('adults'));
  assert.ok(NEW_SEARCH_OCCUPANCY_PARAMS.includes('children'));
  assert.ok(NEW_SEARCH_OCCUPANCY_PARAMS.includes('dob'));
  assert.ok(NEW_SEARCH_OCCUPANCY_PARAMS.includes('partyRooms'));
});

test('fast filters preserve page1Ids; occupancy change wipes them', () => {
  const previous = new URLSearchParams('adults=2&page1Ids=a,b,c');

  for (const [key, value] of [
    ['stars', '4'],
    ['boardTypes', 'All Inclusive'],
    ['vacationTypes', 'Adults Only'],
    ['amenities', 'pool_outdoor'],
    ['hasCarRental', '1'],
    ['budgetMax', '1800'],
    ['country', 'Spanje'],
    ['departureAirport', 'BRU,CRL'],
    ['nights', '8,9,10'],
    ['sort', 'price'],
  ] as const) {
    const next = new URLSearchParams(previous);
    next.set(key, value);
    assert.equal(shouldPreservePage1Ids(previous, next), true, `${key} should be FAST`);
    applyFilterNavigationPaging(next, { preservePage1Ids: true });
    assert.equal(next.get('page1Ids'), 'a,b,c', `${key} keeps page1Ids`);
  }

  const occupancyNext = new URLSearchParams(previous);
  occupancyNext.set('children', '1');
  assert.equal(shouldPreservePage1Ids(previous, occupancyNext), false);
  applyFilterNavigationPaging(occupancyNext, {
    preservePage1Ids: shouldPreservePage1Ids(previous, occupancyNext),
  });
  assert.equal(occupancyNext.get('page1Ids'), null);
});

test('missing adults defaults to 2 so a no-op search does not look like occupancy change', () => {
  const previous = new URLSearchParams('page1Ids=a,b');
  const next = new URLSearchParams('adults=2&page1Ids=a,b');
  assert.equal(occupancySearchParamsChanged(previous, next), false);
  assert.equal(shouldPreservePage1Ids(previous, next), true);
});

test('fast catalog refine with page1Ids does 0 live HTTP for stars / board / vacation / amenity', async () => {
  const stats = emptyStats();
  let httpCalls = 0;
  const fetchImpl: typeof fetch = async () => {
    httpCalls += 1;
    throw new Error('live pricing must not run on fast catalog refine');
  };

  const offers = [
    makeOffer({
      id: 'ai-4',
      provider: 'Sunweb',
      boardType: 'All Inclusive',
      stars: 4,
      hotelName: 'Adults Only Resort',
      livePriceStatus: 'proven',
      livePriceSource: 'getPromotedPrice',
      hasCarRental: true,
    }),
    makeOffer({
      id: 'lo-3',
      provider: 'Sunweb',
      boardType: 'Logies',
      stars: 3,
      hotelName: 'Family Hotel',
      livePriceStatus: 'proven',
      livePriceSource: 'getPromotedPrice',
    }),
    ...Array.from({ length: 12 }, (_, index) =>
      makeOffer({
        id: `extra-${index}`,
        provider: 'Sunweb',
        stars: 5,
        boardType: 'All Inclusive',
        hotelName: 'Adults Only Aqua',
        feedDescription: 'Buitenzwembad en adults only',
        livePriceStatus: 'catalog',
        livePriceSource: 'feed',
      }),
    ),
  ];

  for (const params of [
    { adults: 2, page: 1, page1Ids: ['ai-4'], stars: [4, 5] },
    { adults: 2, page: 1, page1Ids: ['ai-4'], boardTypes: ['All Inclusive'] },
    { adults: 2, page: 1, page1Ids: ['ai-4'], vacationTypes: ['Adults Only'] },
    { adults: 2, page: 1, page1Ids: ['ai-4'], amenities: ['pool_outdoor'] },
    { adults: 2, page: 1, page1Ids: ['ai-4'], hasCarRental: true },
  ]) {
    httpCalls = 0;
    stats.receiptCalls = 0;
    const slice = await resolveResultsPageSlice(offers, params, { fetchImpl, stats });
    assert.equal(httpCalls, 0, `http for ${JSON.stringify(params)}`);
    assert.equal(stats.receiptCalls, 0);
    assert.ok((slice.page1Ids?.length ?? 0) > 0);
  }
});

test('dob or partyRooms change is a new occupancy search', () => {
  const previous = new URLSearchParams('adults=4&dob=1980-03-12,1982-08-07,,&page1Ids=a,b');
  const nextDob = new URLSearchParams(previous);
  nextDob.set('dob', '1980-03-12,1982-08-07,2011-06-14,2022-01-22');
  assert.equal(shouldPreservePage1Ids(previous, nextDob), false);

  const nextRooms = new URLSearchParams(previous);
  nextRooms.set('rooms', '2');
  nextRooms.set('partyRooms', '1,1,1,2');
  assert.equal(shouldPreservePage1Ids(previous, nextRooms), false);
});

test('new occupancy search without page1Ids still uses the live-pricing entry (page1Ids absent)', () => {
  const previous = new URLSearchParams('adults=2&page1Ids=a,b');
  const next = new URLSearchParams('adults=2&children=1');
  assert.equal(shouldPreservePage1Ids(previous, next), false);
});

test('presentCatalogPage1WithoutLivePricing re-filters the full catalog, not only 10 cards', () => {
  const offers = Array.from({ length: 30 }, (_, index) =>
    makeOffer({
      id: `offer-${index}`,
      provider: 'Sunweb',
      stars: index < 5 ? 3 : 5,
      price: 400 + index,
      livePriceStatus: 'proven',
      livePriceSource: 'getPromotedPrice',
    }),
  );
  const fiveStar = offers.filter((offer) => offer.stars === 5);
  const presented = presentCatalogPage1WithoutLivePricing(fiveStar, 10);
  assert.equal(presented.visibleOffers.length, 10);
  assert.equal(presented.visibleOffers.every((offer) => offer.stars === 5), true);
  assert.equal(presented.remaining.length, fiveStar.length - 10);
  assert.ok(presented.visibleOffers.every((offer) => offer.livePriceStatus !== 'unavailable'));
});

test('filter-options airports are IATA identities with VacationWeb labels', () => {
  assert.equal(formatDepartureAirportLabel('LGG'), 'Luik');
  assert.equal(formatDepartureAirportLabel('BRU'), 'Brussel');
  assert.ok(filterOptions.departureAirports.length > 0);
  for (const code of filterOptions.departureAirports) {
    assert.match(code, /^[A-Z]{3}$/);
    assert.notEqual(code, 'BE');
    assert.notEqual(formatDepartureAirportLabel(code), code);
  }
});
