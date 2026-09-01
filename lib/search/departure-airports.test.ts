import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canonicalizeDepartureAirportCode,
  formatDepartureAirportLabel,
  formatDepartureAirportOptionLabel,
  formatOfferDepartureAirportLabel,
  formatSelectedDepartureAirportsLabel,
  getPublicPickerCountryGroups,
  listPublicPickerIataCodes,
  offerMatchesDepartureAirports,
  parseDepartureAirportsParam,
  resolveOfferIataAirportCode,
  serializeDepartureAirportsParam,
  setDepartureAirportsSelection,
  toggleDepartureAirport,
} from './departure-airports';
import { filterOffers } from './filtering';
import type { TravelOffer } from '@/types/travel';

function makeOffer(overrides: Partial<TravelOffer> = {}): TravelOffer {
  return {
    id: 'test-1',
    provider: 'Corendon',
    hotelName: 'Test Hotel',
    destinationCountry: 'Spanje',
    nights: 8,
    price: 800,
    pricePerDay: 100,
    imageUrl: 'https://example.com/a.jpg',
    flightIncluded: 'true',
    deepLink: 'https://www.corendon.be/vakantie#5007.MLELC.BRUPMI.200826.8.DZI-U',
    ...overrides,
  };
}

test('parse and serialize keep comma-separated departureAirport param', () => {
  assert.deepEqual(parseDepartureAirportsParam('BRU,CRL,LGG,MST,EIN,CGN'), [
    'BRU',
    'CRL',
    'LGG',
    'MST',
    'EIN',
    'CGN',
  ]);
  assert.equal(
    serializeDepartureAirportsParam(['BRU', 'CRL', 'LGG', 'MST', 'EIN', 'CGN']),
    'BRU,CRL,LGG,MST,EIN,CGN',
  );
});

test('BRU,CRL remains OR multi-select semantics', () => {
  assert.deepEqual(parseDepartureAirportsParam('BRU,CRL'), ['BRU', 'CRL']);
  const offers = [
    makeOffer({ id: 'bru', departureAirport: 'BRU' }),
    makeOffer({ id: 'crl', departureAirport: 'CRL' }),
    makeOffer({ id: 'ein', departureAirport: 'EIN' }),
  ];
  const filtered = filterOffers(offers, { departureAirport: 'BRU,CRL' });
  assert.deepEqual(filtered.map((offer) => offer.id), ['bru', 'crl']);
});

test('toggleDepartureAirport accumulates six airports without closing others', () => {
  let selected: string[] = [];
  for (const code of ['BRU', 'CRL', 'LGG', 'MST', 'EIN', 'CGN']) {
    selected = toggleDepartureAirport(selected, code);
  }
  assert.deepEqual(selected, ['BRU', 'CRL', 'LGG', 'MST', 'EIN', 'CGN']);
  assert.equal(formatSelectedDepartureAirportsLabel(selected), '6 luchthavens');
});

test('country bulk select/deselect via setDepartureAirportsSelection', () => {
  const be = ['BRU', 'CRL', 'ANR', 'OST', 'LGG'];
  let selected = setDepartureAirportsSelection([], be, true);
  assert.deepEqual(selected, be);
  selected = setDepartureAirportsSelection(selected, be, false);
  assert.deepEqual(selected, []);
});

test('airport labels use canonical registry display names', () => {
  assert.equal(formatDepartureAirportLabel('BRU'), 'Brussel');
  assert.equal(formatDepartureAirportLabel('AMS'), 'Amsterdam');
  assert.equal(formatDepartureAirportLabel('EIN'), 'Eindhoven');
  assert.equal(formatDepartureAirportLabel('CRL'), 'Brussel Charleroi');
  assert.equal(formatDepartureAirportLabel('LGG'), 'Luik');
  assert.equal(formatDepartureAirportLabel('ANR'), 'Antwerpen');
  assert.equal(formatDepartureAirportLabel('OST'), 'Oostende');
  assert.equal(formatDepartureAirportLabel('DUS'), 'Düsseldorf');
  assert.equal(formatDepartureAirportLabel('CGN'), 'Keulen/Bonn');
  assert.equal(formatDepartureAirportLabel('NRN'), 'Weeze');
  assert.equal(formatDepartureAirportLabel('LIL'), 'Rijsel');
  assert.equal(formatDepartureAirportLabel('LUX'), 'Luxemburg');
  assert.equal(formatDepartureAirportOptionLabel('BRU'), 'Brussel');
  assert.equal(formatSelectedDepartureAirportsLabel(['BRU']), 'Brussel');
  for (const code of listPublicPickerIataCodes()) {
    assert.notEqual(formatDepartureAirportLabel(code), code);
  }
});

test('land→airport grouping exposes five countries', () => {
  const groups = getPublicPickerCountryGroups();
  assert.equal(groups.length, 5);
  assert.ok(groups.every((group) => group.airports.length > 0));
});

test('canonical IATA is identity; country ISO rejected; proven place names map', () => {
  assert.equal(canonicalizeDepartureAirportCode('BRU'), 'BRU');
  assert.equal(canonicalizeDepartureAirportCode('BE-BRU'), 'BRU');
  assert.equal(canonicalizeDepartureAirportCode('BE-ANR'), 'ANR');
  assert.equal(canonicalizeDepartureAirportCode('DE-NRN'), 'NRN');
  assert.equal(canonicalizeDepartureAirportCode('BE'), undefined);
  assert.equal(canonicalizeDepartureAirportCode('NL'), undefined);
  assert.equal(canonicalizeDepartureAirportCode('Brussel Zaventem'), 'BRU');
  assert.equal(canonicalizeDepartureAirportCode('Unknown Airport Name'), undefined);
  assert.equal(resolveOfferIataAirportCode({ departureAirportCode: 'BE' }), undefined);
  assert.equal(resolveOfferIataAirportCode({ airport: 'Brussel Zaventem' }), 'BRU');
  assert.equal(
    resolveOfferIataAirportCode({
      departureAirport: 'BRU',
      departureAirportCode: 'BE',
      airport: 'Brussel Zaventem',
    }),
    'BRU',
  );
});

test('offer display uses VacationWeb label, not provider airport text or IATA', () => {
  assert.equal(
    formatOfferDepartureAirportLabel({
      departureAirport: 'BRU',
      airport: 'Brussel Zaventem',
    }),
    'Brussel',
  );
  assert.equal(
    formatOfferDepartureAirportLabel({
      departureAirport: 'BRU',
      departureAirportCode: 'BE',
    }),
    'Brussel',
  );
  // Proven place name alone now resolves to canonical IATA + registry label
  assert.equal(
    formatOfferDepartureAirportLabel({
      departureAirportCode: 'BE',
      airport: 'Brussel Zaventem',
    }),
    'Brussel',
  );
  assert.notEqual(
    formatOfferDepartureAirportLabel({ departureAirport: 'BRU', airport: 'Brussel Zaventem' }),
    'Brussel Zaventem',
  );
  assert.notEqual(
    formatOfferDepartureAirportLabel({ departureAirport: 'BRU' }),
    'BRU',
  );
});

test('single airport filter still matches BE-BRU / BRU aliases', () => {
  const offers = [
    makeOffer({ id: 'bru', departureAirport: 'BRU' }),
    makeOffer({ id: 'be-bru', departureAirportCode: 'BE-BRU' }),
    makeOffer({ id: 'ein', departureAirport: 'EIN' }),
  ];
  const filtered = filterOffers(offers, { departureAirport: 'BRU' });
  assert.deepEqual(filtered.map((offer) => offer.id), ['bru', 'be-bru']);
});

test('multi airport filter keeps all selected departure airports', () => {
  const offers = [
    makeOffer({ id: 'bru', departureAirport: 'BRU' }),
    makeOffer({ id: 'crl', departureAirport: 'CRL' }),
    makeOffer({ id: 'ein', departureAirport: 'EIN' }),
    makeOffer({ id: 'ams', departureAirport: 'AMS' }),
  ];
  const filtered = filterOffers(offers, { departureAirport: 'BRU,CRL,EIN' });
  assert.deepEqual(filtered.map((offer) => offer.id), ['bru', 'crl', 'ein']);
});

test('offer without airport is excluded when airports are selected', () => {
  assert.equal(
    offerMatchesDepartureAirports(makeOffer({ id: 'none' }), ['BRU']),
    false,
  );
});

test('canonical airport without catalog offers remains selectable and filters to zero', () => {
  assert.ok(listPublicPickerIataCodes().includes('LGG'));
  const offers = [
    makeOffer({ id: 'bru', departureAirport: 'BRU' }),
    makeOffer({ id: 'crl', departureAirport: 'CRL' }),
  ];
  const filtered = filterOffers(offers, { departureAirport: 'LGG' });
  assert.deepEqual(filtered, []);
});

test('multi-country selection keeps OR semantics across BE and NL', () => {
  const offers = [
    makeOffer({ id: 'bru', departureAirport: 'BRU' }),
    makeOffer({ id: 'ams', departureAirport: 'AMS' }),
    makeOffer({ id: 'dus', departureAirport: 'DUS' }),
  ];
  const filtered = filterOffers(offers, { departureAirport: 'BRU,AMS' });
  assert.deepEqual(filtered.map((offer) => offer.id), ['bru', 'ams']);
});
