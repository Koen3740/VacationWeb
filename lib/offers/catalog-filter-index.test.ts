import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { normalizeOffer } from '@/lib/feeds/canonical/normalize-offer';
import type { StoredOffer } from '@/lib/feeds/types/stored-offer';
import {
  buildCatalogFilterIndex,
  monthKey,
  narrowOfferIndicesWithIndex,
  offersFromIndices,
  withCatalogFilterIndex,
} from '@/lib/offers/catalog-filter-index';
import { filterOffers } from '@/lib/search/filtering';
import { parseDepartureAirportsParam } from '@/lib/search/departure-airports';
import type { SearchParams, TravelOffer } from '@/types/travel';

test('monthKey: Corendon DD/MM/YYYY maps to YYYY-MM', () => {
  assert.equal(monthKey('13/10/2026'), '2026-10');
});

test('monthKey: Sunweb ISO YYYY-MM-DD maps to YYYY-MM', () => {
  assert.equal(monthKey('2026-10-13'), '2026-10');
});

test('monthKey: Eliza ISO YYYY-MM-DD maps to YYYY-MM', () => {
  assert.equal(monthKey('2026-10-13'), '2026-10');
});

test('monthKey: unknown formats return null', () => {
  assert.equal(monthKey('13-10-2026'), null);
  assert.equal(monthKey(''), null);
  assert.equal(monthKey(undefined), null);
});

test('GO6 month index: Corendon DD/MM/YYYY stays in same-month narrow', () => {
  const offers = [
    {
      id: 'corendon-dmy',
      provider: 'Corendon',
      destinationCountry: 'Spanje',
      nights: 8,
      departureDate: '13/10/2026',
      departureAirport: 'BRU',
      deepLink: 'https://www.corendon.be/vakantie#5007.MLELC.BRUPMI.131026.8.DZI-U',
      flightIncluded: 'true',
      price: 800,
      pricePerDay: 100,
      hotelName: 'Hotel A',
      imageUrl: 'https://example.com/a.jpg',
    },
    {
      id: 'sunweb-iso',
      provider: 'Sunweb',
      destinationCountry: 'Spanje',
      nights: 8,
      departureDate: '2026-10-13',
      departureAirport: 'BRU',
      deepLink:
        'https://www.sunweb.be/nl/vakantie/reizen?tt=1&r=' +
        encodeURIComponent(
          'https://www.sunweb.be/nl/vakantie/x?Duration[0]=8&TransportType[0]=Flight&Mealplan[0]=LO&DepartureAirport[0]=BRU&DepartureDate[0]=2026-10-13',
        ),
      flightIncluded: 'true',
      price: 700,
      pricePerDay: 87,
      hotelName: 'Hotel B',
      imageUrl: 'https://example.com/b.jpg',
    },
    {
      id: 'eliza-iso',
      provider: 'Eliza was here',
      destinationCountry: 'Spanje',
      nights: 8,
      departureDate: '2026-10-20',
      departureAirport: 'BRU',
      deepLink:
        'https://www.elizawashere.be/reizen?tt=1&r=' +
        encodeURIComponent(
          'https://www.elizawashere.be/x?Duration[0]=8&TransportType[0]=Flight&Mealplan[0]=LG&DepartureAirport[0]=BRU&DepartureDate[0]=2026-10-20',
        ),
      flightIncluded: 'true',
      price: 750,
      pricePerDay: 94,
      hotelName: 'Hotel C',
      imageUrl: 'https://example.com/c.jpg',
    },
  ] as TravelOffer[];

  const index = buildCatalogFilterIndex(offers);
  assert.ok(index.byDepartureMonth.get('2026-10')?.length === 3);
  assert.equal(index.byDepartureMonth.has('13/10/2'), false);

  const params = {
    country: 'Spanje',
    nights: [8],
    departureStart: '2026-10-01',
    departureEnd: '2026-10-31',
    departureAirport: 'BRU,CRL,ANR,OST,LGG',
  } as SearchParams;

  const indices = narrowOfferIndicesWithIndex(
    index,
    params,
    (p) => (p.countries?.length ? [...p.countries] : p.country ? [p.country] : []),
    parseDepartureAirportsParam,
  );
  assert.ok(indices !== null);
  const narrowed = offersFromIndices(offers, indices!);
  assert.equal(narrowed.length, 3);
  assert.ok(narrowed.some((o) => o.id === 'corendon-dmy'));
});

test('exact Spanje/okt/8d/BE airports: month-index no longer zeros Corendon', () => {
  const offers = [
    {
      id: 'corendon-1',
      provider: 'Corendon',
      destinationCountry: 'Spanje',
      nights: 8,
      departureDate: '13/10/2026',
      departureAirport: 'BRU',
      deepLink: 'https://www.corendon.be/vakantie#5007.MLELC.BRUPMI.131026.8.DZI-U',
      flightIncluded: 'true',
      price: 800,
      pricePerDay: 100,
      hotelName: 'Corendon Hotel',
      imageUrl: 'https://example.com/c.jpg',
    },
    {
      id: 'sunweb-1',
      provider: 'Sunweb',
      destinationCountry: 'Spanje',
      nights: 8,
      departureDate: '2026-10-10',
      departureAirport: 'BRU',
      deepLink:
        'https://www.sunweb.be/nl/vakantie/reizen?tt=1&r=' +
        encodeURIComponent(
          'https://www.sunweb.be/nl/vakantie/x?Duration[0]=8&TransportType[0]=Flight&Mealplan[0]=LO&DepartureAirport[0]=BRU&DepartureDate[0]=2026-10-10',
        ),
      flightIncluded: 'true',
      price: 700,
      pricePerDay: 87,
      hotelName: 'Sunweb Hotel',
      imageUrl: 'https://example.com/s.jpg',
    },
    {
      id: 'eliza-1',
      provider: 'Eliza was here',
      destinationCountry: 'Spanje',
      nights: 8,
      departureDate: '2026-10-15',
      departureAirport: 'CRL',
      deepLink:
        'https://www.elizawashere.be/reizen?tt=1&r=' +
        encodeURIComponent(
          'https://www.elizawashere.be/x?Duration[0]=8&TransportType[0]=Flight&Mealplan[0]=LG&DepartureAirport[0]=CRL&DepartureDate[0]=2026-10-15',
        ),
      flightIncluded: 'true',
      price: 750,
      pricePerDay: 94,
      hotelName: 'Eliza Hotel',
      imageUrl: 'https://example.com/e.jpg',
    },
    {
      id: 'corendon-ams',
      provider: 'Corendon',
      destinationCountry: 'Spanje',
      nights: 8,
      departureDate: '10/10/2026',
      departureAirport: 'AMS',
      deepLink: 'https://www.corendon.be/vakantie#5008.MLELC.AMSPMI.101026.8.DZI-U',
      flightIncluded: 'true',
      price: 820,
      pricePerDay: 102,
      hotelName: 'Corendon AMS',
      imageUrl: 'https://example.com/a.jpg',
    },
  ] as TravelOffer[];

  const params: SearchParams = {
    country: 'Spanje',
    adults: 2,
    rooms: 1,
    nights: [8],
    departureStart: '2026-10-01',
    departureEnd: '2026-10-31',
    departureAirport: 'BRU,CRL,ANR,OST,LGG',
  };

  const withoutIndex = filterOffers(offers, params);
  const withIndex = withCatalogFilterIndex(offers, () => filterOffers(offers, params));

  assert.equal(withoutIndex.length, withIndex.length);
  assert.equal(withoutIndex.filter((o) => o.provider === 'Corendon').length, 1);
  assert.equal(withIndex.filter((o) => o.provider === 'Corendon').length, 1);
  assert.ok(withIndex.some((o) => o.id === 'corendon-1'));
  assert.ok(!withIndex.some((o) => o.id === 'corendon-ams'));
  assert.equal(withIndex.length, 3);
});

test('catalog offers.json: Spanje/okt/8d/BE airports — index matches full scan for Corendon', () => {
  const raw = JSON.parse(readFileSync(join(process.cwd(), 'data/offers.json'), 'utf8')) as StoredOffer[];
  const offers = raw.map(normalizeOffer);
  const params: SearchParams = {
    country: 'Spanje',
    adults: 2,
    rooms: 1,
    nights: [8],
    departureStart: '2026-10-01',
    departureEnd: '2026-10-31',
    departureAirport: 'BRU,CRL,ANR,OST,LGG',
  };

  const withoutIndex = filterOffers(offers, params);
  const withIndex = withCatalogFilterIndex(offers, () => filterOffers(offers, params));

  const corWithout = withoutIndex.filter((o) => o.provider === 'Corendon').length;
  const corWith = withIndex.filter((o) => o.provider === 'Corendon').length;

  assert.equal(withIndex.length, withoutIndex.length);
  assert.equal(corWith, corWithout);
  assert.ok(corWith > 0, `expected Corendon > 0 after month-index fix, got ${corWith}`);
});
