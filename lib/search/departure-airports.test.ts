import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canonicalizeDepartureAirportCode,
  formatDepartureAirportLabel,
  formatDepartureAirportOptionLabel,
  formatOfferDepartureAirportLabel,
  formatSelectedDepartureAirportsLabel,
  offerMatchesDepartureAirports,
  parseDepartureAirportsParam,
  resolveOfferIataAirportCode,
  serializeDepartureAirportsParam,
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

test('toggleDepartureAirport accumulates six airports without closing others', () => {
  let selected: string[] = [];
  for (const code of ['BRU', 'CRL', 'LGG', 'MST', 'EIN', 'CGN']) {
    selected = toggleDepartureAirport(selected, code);
  }
  assert.deepEqual(selected, ['BRU', 'CRL', 'LGG', 'MST', 'EIN', 'CGN']);
  assert.equal(formatSelectedDepartureAirportsLabel(selected), '6 luchthavens');
});

test('airport labels prefer full names over raw codes', () => {
  assert.equal(formatDepartureAirportLabel('BRU'), 'Brussel');
  assert.equal(formatDepartureAirportLabel('AMS'), 'Amsterdam');
  assert.equal(formatDepartureAirportLabel('EIN'), 'Eindhoven');
  assert.equal(formatDepartureAirportLabel('CRL'), 'Brussel Charleroi');
  assert.equal(formatDepartureAirportLabel('LGG'), 'Luik');
  assert.equal(formatDepartureAirportLabel('DUS'), 'Düsseldorf');
  assert.equal(formatDepartureAirportLabel('CGN'), 'Keulen');
  assert.equal(formatDepartureAirportOptionLabel('BRU'), 'Brussel');
  assert.equal(formatDepartureAirportOptionLabel('CRL'), 'Brussel Charleroi');
  assert.equal(formatDepartureAirportOptionLabel('LGG'), 'Luik');
  assert.equal(formatDepartureAirportOptionLabel('MST'), 'Maastricht');
  assert.equal(formatDepartureAirportOptionLabel('EIN'), 'Eindhoven');
  assert.equal(formatDepartureAirportOptionLabel('CGN'), 'Keulen');
  assert.equal(formatSelectedDepartureAirportsLabel(['BRU']), 'Brussel');
  for (const code of ['BRU', 'AMS', 'EIN', 'CRL', 'LGG']) {
    assert.notEqual(formatDepartureAirportLabel(code), code);
    assert.notEqual(formatDepartureAirportOptionLabel(code), code);
  }
});

test('canonical IATA is identity; country ISO and provider names are not', () => {
  assert.equal(canonicalizeDepartureAirportCode('BRU'), 'BRU');
  assert.equal(canonicalizeDepartureAirportCode('BE-BRU'), 'BRU');
  assert.equal(canonicalizeDepartureAirportCode('BE'), undefined);
  assert.equal(canonicalizeDepartureAirportCode('NL'), undefined);
  assert.equal(canonicalizeDepartureAirportCode('Brussel Zaventem'), undefined);
  assert.equal(resolveOfferIataAirportCode({ departureAirportCode: 'BE' }), undefined);
  assert.equal(resolveOfferIataAirportCode({ airport: 'Brussel Zaventem' }), undefined);
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
  assert.equal(
    formatOfferDepartureAirportLabel({
      departureAirportCode: 'BE',
      airport: 'Brussel Zaventem',
    }),
    undefined,
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
