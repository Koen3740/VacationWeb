import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  buildResultsHref,
  createDefaultSharedSearchState,
} from '../../components/search/shared-search-state';
import { createDefaultTravelersState } from '../../components/search/travelers-popup/travelers-popup-utils';
import { affiliateHref } from '../offers/offer-detail-view';
import { sortOffers } from './filtering';
import {
  buildOfferDetailHref,
  buildResultsPageHref,
  getResultsTotalPages,
  limitRankedResultsForPagination,
  RESULTS_PAGE_SIZE_DEFAULT,
  RESULTS_USER_PAGINATION_CAP,
} from './pagination';
import { parseSearchParams } from './parse-search-params';
import { hasValidPresentablePrice } from './presentable-price';
import type { TravelOffer } from '../feeds/canonical/travel-offer';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

function hrefQuery(href: string): Record<string, string | string[] | undefined> {
  const url = new URL(href, 'https://vacationweb.test');
  const record: Record<string, string | string[] | undefined> = {};
  for (const [key, value] of url.searchParams.entries()) {
    record[key] = value;
  }
  return record;
}

test('homepage 2 adults with real DOBs reach Results party unchanged', () => {
  const href = buildResultsHref({
    ...createDefaultSharedSearchState(),
    travelers: {
      travellers: [
        { id: 't-1', dateOfBirth: '1980-03-12' },
        { id: 't-2', dateOfBirth: '1982-08-07' },
      ],
      roomCount: 1,
      roomAssignments: [0, 0],
    },
  });
  const query = hrefQuery(href);
  assert.equal(query.dob, '1980-03-12,1982-08-07');
  const params = parseSearchParams(query);
  assert.deepEqual(params.party, [
    { dateOfBirth: '1980-03-12', roomIndex: 0 },
    { dateOfBirth: '1982-08-07', roomIndex: 0 },
  ]);
});

test('homepage default search carries 2 adults into Results params', () => {
  const href = buildResultsHref(createDefaultSharedSearchState());
  assert.match(href, /^\/results\?/);
  const params = parseSearchParams(hrefQuery(href));
  assert.equal(params.adults, 2);
  assert.equal(params.children, undefined);
  assert.deepEqual(params.party, [
    { dateOfBirth: null, roomIndex: 0 },
    { dateOfBirth: null, roomIndex: 0 },
  ]);
  assert.equal(params.sort, 'value');
  assert.equal(params.page, 1);
  assert.equal(params.pageSize, RESULTS_PAGE_SIZE_DEFAULT);
});

test('homepage search with destination, dates, nights and airports round-trips', () => {
  const href = buildResultsHref({
    selectedCountries: ['Spanje', 'Griekenland'],
    departureStart: '2026-09-01',
    departureEnd: '2026-09-15',
    flexibilityDays: 1,
    selectedDurations: [8, 10, 7],
    selectedDepartureAirports: ['AMS', 'BRU'],
    travelers: createDefaultTravelersState(),
  });
  const params = parseSearchParams(hrefQuery(href));
  assert.deepEqual(params.countries, ['Spanje', 'Griekenland']);
  assert.equal(params.country, undefined);
  assert.equal(params.departureStart, '2026-09-01');
  assert.equal(params.departureEnd, '2026-09-15');
  assert.equal(params.flexibilityDays, 1);
  assert.deepEqual(params.nights, [7, 8, 10]);
  assert.equal(params.departureAirport, 'AMS,BRU');
  assert.equal(params.adults, 2);
});

test('F. homepage → Results keeps party, rooms, dates, nights and airport', () => {
  const href = buildResultsHref({
    selectedCountries: ['Spanje'],
    departureStart: '2026-09-01',
    departureEnd: '2026-09-15',
    flexibilityDays: 1,
    selectedDurations: [7, 8],
    selectedDepartureAirports: ['BRU'],
    travelers: {
      travellers: [
        { id: 't-1', dateOfBirth: '1980-03-12' },
        { id: 't-2', dateOfBirth: '1982-08-07' },
        { id: 't-3', dateOfBirth: '2011-06-14' },
        { id: 't-4', dateOfBirth: '2022-01-22' },
      ],
      roomCount: 2,
      roomAssignments: [0, 0, 0, 1],
    },
  });

  const query = hrefQuery(href);
  assert.equal(query.adults, '4');
  assert.equal(query.dob, '1980-03-12,1982-08-07,2011-06-14,2022-01-22');
  assert.equal(query.rooms, '2');
  assert.equal(query.partyRooms, '1,1,1,2');
  assert.equal(query.departureStart, '2026-09-01');
  assert.equal(query.nights, '7,8');
  assert.equal(query.departureAirport, 'BRU');
  assert.equal(query.children, undefined);
  assert.equal(query.babies, undefined);

  const params = parseSearchParams(query);
  assert.equal(params.adults, 4);
  assert.equal(params.rooms, 2);
  assert.deepEqual(params.party, [
    { dateOfBirth: '1980-03-12', roomIndex: 0 },
    { dateOfBirth: '1982-08-07', roomIndex: 0 },
    { dateOfBirth: '2011-06-14', roomIndex: 0 },
    { dateOfBirth: '2022-01-22', roomIndex: 1 },
  ]);
  assert.equal(params.departureStart, '2026-09-01');
  assert.deepEqual(params.nights, [7, 8]);
  assert.equal(params.departureAirport, 'BRU');

  const pageHref = buildResultsPageHref(params, 2);
  const pageParams = parseSearchParams(hrefQuery(pageHref));
  assert.deepEqual(pageParams.party, params.party);
  assert.equal(pageParams.adults, 4);
  assert.equal(pageParams.rooms, 2);
  assert.equal(pageParams.departureStart, '2026-09-01');
  assert.deepEqual(pageParams.nights, [7, 8]);
  assert.equal(pageParams.departureAirport, 'BRU');
  assert.equal(pageParams.page, 2);
});

test('G. Results URL without new party params stays readable', () => {
  const params = parseSearchParams({
    adults: '2',
    country: 'Spanje',
    departureStart: '2026-09-01',
    nights: '7',
    departureAirport: 'AMS',
  });
  assert.equal(params.adults, 2);
  assert.equal(params.party, undefined);
  assert.equal(params.country, 'Spanje');
  assert.equal(params.departureAirport, 'AMS');
});

test('card → detail → back keeps occupancy and dates', () => {
  const resultsParams = parseSearchParams(
    hrefQuery(
      buildResultsHref({
        selectedCountries: ['Spanje'],
        departureStart: '2026-09-01',
        departureEnd: '2026-09-08',
        flexibilityDays: 0,
        selectedDurations: [7],
        selectedDepartureAirports: [],
        travelers: createDefaultTravelersState(),
      }),
    ),
  );
  resultsParams.page = 2;
  resultsParams.sort = 'value';

  const detailHref = buildOfferDetailHref('sunweb-hotel-1', resultsParams);
  const detailParams = parseSearchParams(hrefQuery(detailHref));
  assert.equal(detailParams.adults, 2);
  assert.deepEqual(detailParams.party, [
    { dateOfBirth: null, roomIndex: 0 },
    { dateOfBirth: null, roomIndex: 0 },
  ]);
  assert.equal(detailParams.departureStart, '2026-09-01');
  assert.equal(detailParams.country, 'Spanje');
  assert.equal(detailParams.nights?.[0], 7);
  assert.deepEqual(detailParams.nights, [7]);

  const backHref = buildResultsPageHref(detailParams, detailParams.page ?? 1);
  assert.match(backHref, /^\/results\?/);
  const backParams = parseSearchParams(hrefQuery(backHref));
  assert.equal(backParams.adults, 2);
  assert.deepEqual(backParams.party, detailParams.party);
  assert.equal(backParams.departureStart, '2026-09-01');
  assert.equal(backParams.country, 'Spanje');
});

test('card → detail → back keeps hasCarRental=1', () => {
  const resultsParams = parseSearchParams({
    adults: '2',
    country: 'Spanje',
    hasCarRental: '1',
    page: '2',
  });
  assert.equal(resultsParams.hasCarRental, true);
  const detailHref = buildOfferDetailHref('sunweb-car-1', resultsParams);
  const detailParams = parseSearchParams(hrefQuery(detailHref));
  assert.equal(detailParams.hasCarRental, true);
  const backHref = buildResultsPageHref(detailParams, detailParams.page ?? 1);
  const backParams = parseSearchParams(hrefQuery(backHref));
  assert.equal(backParams.hasCarRental, true);
  assert.match(backHref, /hasCarRental=1/);
});

test('affiliate href stays the stored deepLink', () => {
  const offer: TravelOffer = {
    id: 'sunweb-1',
    provider: 'Sunweb',
    hotelName: 'Hotel',
    destinationCountry: 'Spanje',
    nights: 7,
    price: 499,
    pricePerDay: 71,
    imageUrl: 'https://example.com/a.jpg',
    deepLink: 'https://www.sunweb.nl/hotel-don-pancho?foo=1',
  };
  assert.equal(affiliateHref(offer), 'https://www.sunweb.nl/hotel-don-pancho?foo=1');
});

test('product page size is 10; live-pricing window is 150 (not a user browse cap)', () => {
  assert.equal(RESULTS_PAGE_SIZE_DEFAULT, 10);
  assert.equal(RESULTS_USER_PAGINATION_CAP, 150);
  const liveWindow = limitRankedResultsForPagination(Array.from({ length: 400 }, (_, i) => i));
  assert.equal(liveWindow.length, 150);
  assert.equal(getResultsTotalPages(400, RESULTS_PAGE_SIZE_DEFAULT), 40);
});

test('Sunweb catalog is not presentable; Corendon/Eliza/Prijsvrij catalog is not', () => {
  const base = {
    hotelName: 'Hotel',
    destinationCountry: 'Spanje',
    nights: 7,
    price: 400,
    pricePerDay: 57,
    imageUrl: 'https://example.com/a.jpg',
    deepLink: 'https://example.com',
  };
  assert.equal(
    hasValidPresentablePrice({ ...base, id: 'sunweb-1', provider: 'Sunweb' }),
    false,
  );
  assert.equal(
    hasValidPresentablePrice({ ...base, id: 'corendon-1', provider: 'Corendon' }),
    false,
  );
  assert.equal(
    hasValidPresentablePrice({
      ...base,
      id: 'eliza-1',
      provider: 'Eliza was here',
    }),
    false,
  );
  assert.equal(
    hasValidPresentablePrice({ ...base, id: 'pv-1', provider: 'Prijsvrij' }),
    false,
  );
});

test('Aanbevolen is not a Results sort option', () => {
  const src = readFileSync(join(ROOT, 'components/results/sort-selector.tsx'), 'utf8');
  assert.equal(src.includes('Aanbevolen'), false);
  assert.equal(src.includes("value: 'value'"), false);
});

test('default / legacy sort=value keeps filtered catalog order', () => {
  const offers: TravelOffer[] = [
    {
      id: 'a',
      provider: 'Sunweb',
      hotelName: 'A',
      destinationCountry: 'Spanje',
      nights: 7,
      price: 900,
      pricePerDay: 128,
      rating: 9,
      stars: 5,
      imageUrl: 'https://example.com/a.jpg',
      deepLink: 'https://example.com',
    },
    {
      id: 'b',
      provider: 'Sunweb',
      hotelName: 'B',
      destinationCountry: 'Spanje',
      nights: 7,
      price: 200,
      pricePerDay: 28,
      rating: 6,
      stars: 3,
      imageUrl: 'https://example.com/b.jpg',
      deepLink: 'https://example.com',
    },
  ];
  assert.deepEqual(sortOffers(offers, 'value').map((offer) => offer.id), ['a', 'b']);
  assert.deepEqual(sortOffers(offers).map((offer) => offer.id), ['a', 'b']);
});
