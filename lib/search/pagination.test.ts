import assert from 'node:assert/strict';
import test from 'node:test';
import { sortOffers } from './filtering';
import {
  getResultsTotalPages,
  limitRankedResultsForPagination,
  paginateResults,
  RESULTS_PAGE_SIZE_DEFAULT,
  RESULTS_USER_PAGINATION_CAP,
  buildOfferDetailHref,
  buildResultsPageHref,
} from './pagination';
import type { TravelOffer } from '../feeds/canonical/travel-offer';

function makeOffer(
  overrides: Partial<TravelOffer> & Pick<TravelOffer, 'id' | 'price'>,
): TravelOffer {
  return {
    provider: 'Sunweb',
    hotelName: 'Hotel',
    destinationCountry: 'Spanje',
    nights: 8,
    pricePerDay: Math.round(overrides.price / 8),
    imageUrl: 'https://example.com/a.jpg',
    deepLink: 'https://example.com',
    livePriceStatus: 'catalog',
    livePriceSource: 'feed',
    stars: 3,
    ...overrides,
  };
}

function ranked921(): TravelOffer[] {
  return Array.from({ length: 921 }, (_, index) =>
    makeOffer({
      id: `offer-${index}`,
      price: 100 + index,
      stars: (index % 5) + 1,
    }),
  );
}

test('K. pagination slices ignore hasCarRental', () => {
  const ranked = sortOffers(ranked921(), 'price');
  const flagged = ranked.map((offer, index) => ({
    ...offer,
    hasCarRental: index % 2 === 0 ? true : undefined,
  }));
  assert.deepEqual(
    sortOffers(flagged, 'price').map((offer) => offer.id),
    ranked.map((offer) => offer.id),
  );
  assert.deepEqual(
    paginateResults(flagged, 2, 10).map((offer) => offer.id),
    paginateResults(ranked, 2, 10).map((offer) => offer.id),
  );
});

test('A. 921 matches: ranking stays complete; user pagination is 150 / 15 pages', () => {
  const matchset = ranked921();
  const ranked = sortOffers(matchset, 'price');
  assert.equal(ranked.length, 921);
  const userPool = limitRankedResultsForPagination(ranked);
  assert.equal(userPool.length, RESULTS_USER_PAGINATION_CAP);
  assert.equal(getResultsTotalPages(userPool.length, RESULTS_PAGE_SIZE_DEFAULT), 15);
  assert.equal(paginateResults(userPool, 16, RESULTS_PAGE_SIZE_DEFAULT).length, 0);
});

test('B. price low→high: top 150 come from the full 921', () => {
  const ranked = sortOffers(ranked921(), 'price');
  const userPool = limitRankedResultsForPagination(ranked);
  assert.equal(userPool[0].id, 'offer-0');
  assert.equal(userPool[149].id, 'offer-149');
  assert.ok(!userPool.some((offer) => offer.id === 'offer-920'));
  assert.equal(ranked[920].id, 'offer-920');
});

test('C. price high→low: top 150 come from the full 921', () => {
  const ranked = sortOffers(ranked921(), 'price-desc');
  const userPool = limitRankedResultsForPagination(ranked);
  assert.equal(userPool[0].id, 'offer-920');
  assert.equal(userPool[149].id, 'offer-771');
  assert.ok(!userPool.some((offer) => offer.id === 'offer-0'));
  assert.equal(ranked[920].id, 'offer-0');
});

test('D. stars: top 150 after existing ranking of all 921', () => {
  const ranked = sortOffers(ranked921(), 'stars');
  assert.equal(ranked.length, 921);
  const userPool = limitRankedResultsForPagination(ranked);
  assert.equal(userPool.length, 150);
  assert.ok(userPool.every((offer) => (offer.stars ?? 0) === 5));
  assert.ok(ranked.slice(150).some((offer) => (offer.stars ?? 0) < 5));
});

test('M. page 16 does not exist; 150-cap is after sort', () => {
  const ranked = sortOffers(ranked921(), 'price');
  const userPool = limitRankedResultsForPagination(ranked);
  assert.equal(getResultsTotalPages(921, 10), 93, 'raw match count must not be used as pagination');
  assert.equal(getResultsTotalPages(userPool.length, 10), 15);
  assert.deepEqual(paginateResults(userPool, 15, 10).map((offer) => offer.id), [
    'offer-140',
    'offer-141',
    'offer-142',
    'offer-143',
    'offer-144',
    'offer-145',
    'offer-146',
    'offer-147',
    'offer-148',
    'offer-149',
  ]);
  assert.deepEqual(paginateResults(userPool, 16, 10), []);
});

test('offer detail href keeps occupancy and dates from Results params', () => {
  const href = buildOfferDetailHref('corendon-9514', {
    adults: 2,
    children: 0,
    rooms: 1,
    departureStart: '2026-08-27',
    departureEnd: '2026-08-27',
    country: 'Spanje',
    sort: 'value',
    page: 2,
    pageSize: 10,
  });

  assert.match(href, /^\/offers\/corendon-9514\?/);
  const query = new URLSearchParams(href.split('?')[1]);
  assert.equal(query.get('adults'), '2');
  assert.equal(query.get('departureStart'), '2026-08-27');
  assert.equal(query.get('country'), 'Spanje');
  assert.equal(query.get('page'), '2');
});

test('offer detail href keeps selected catalog room without putting it on Results', () => {
  const detailHref = buildOfferDetailHref('corendon-14398', {
    adults: 2,
    selectedRoom: 'DJ',
    page: 1,
  });
  const detailQuery = new URLSearchParams(detailHref.split('?')[1]);
  assert.equal(detailQuery.get('room'), 'DJ');
  assert.equal(detailQuery.get('adults'), '2');

  const resultsHref = buildResultsPageHref({ adults: 2, selectedRoom: 'DJ', page: 1 }, 1);
  const resultsQuery = new URLSearchParams(resultsHref.split('?')[1]);
  assert.equal(resultsQuery.get('room'), null);
});

test('results pagination href keeps homepage nights selection', () => {
  const href = buildResultsPageHref(
    {
      nights: [7, 8],
      adults: 2,
      country: 'Spanje',
      page: 2,
    },
    2,
  );
  const query = new URLSearchParams(href.split('?')[1]);
  assert.equal(query.get('nights'), '7,8');
  assert.equal(query.get('country'), 'Spanje');
});

test('results and detail hrefs round-trip hasCarRental=1', () => {
  const resultsHref = buildResultsPageHref(
    {
      adults: 2,
      country: 'Spanje',
      hasCarRental: true,
      page: 1,
    },
    1,
  );
  const resultsQuery = new URLSearchParams(resultsHref.split('?')[1]);
  assert.equal(resultsQuery.get('hasCarRental'), '1');

  const detailHref = buildOfferDetailHref('sunweb-car-1', {
    adults: 2,
    country: 'Spanje',
    hasCarRental: true,
    page: 2,
  });
  const detailQuery = new URLSearchParams(detailHref.split('?')[1]);
  assert.equal(detailQuery.get('hasCarRental'), '1');
  assert.equal(detailQuery.get('page'), '2');

  const offHref = buildResultsPageHref({ adults: 2, country: 'Spanje', page: 1 }, 1);
  const offQuery = new URLSearchParams(offHref.split('?')[1]);
  assert.equal(offQuery.get('hasCarRental'), null);
});

test('pagination keeps party dates of birth and room assignment', () => {
  const href = buildResultsPageHref(
    {
      adults: 4,
      rooms: 2,
      party: [
        { dateOfBirth: '1980-03-12', roomIndex: 0 },
        { dateOfBirth: '1982-08-07', roomIndex: 0 },
        { dateOfBirth: '2011-06-14', roomIndex: 0 },
        { dateOfBirth: '2022-01-22', roomIndex: 1 },
      ],
      departureStart: '2026-09-01',
      nights: [7],
      departureAirport: 'BRU',
      country: 'Spanje',
      page: 2,
    },
    2,
  );
  const query = new URLSearchParams(href.split('?')[1]);
  assert.equal(query.get('dob'), '1980-03-12,1982-08-07,2011-06-14,2022-01-22');
  assert.equal(query.get('partyRooms'), '1,1,1,2');
  assert.equal(query.get('rooms'), '2');
  assert.equal(query.get('adults'), '4');
  assert.equal(query.get('departureStart'), '2026-09-01');
  assert.equal(query.get('nights'), '7');
  assert.equal(query.get('departureAirport'), 'BRU');
});

test('retired sort=value is not written to Results URLs', () => {
  const href = buildResultsPageHref(
    {
      adults: 2,
      sort: 'value',
      page: 1,
    },
    1,
  );
  const query = new URLSearchParams(href.split('?')[1]);
  assert.equal(query.get('sort'), null);
});
