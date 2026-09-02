import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { writeBudgetParams } from './budget-params';
import {
  offerMatchesAmenity,
  parseAmenitiesParam,
  serializeAmenitiesParam,
} from './amenity-filters';
import {
  offerMatchesVacationType,
  parseVacationTypesParam,
  serializeVacationTypesParam,
} from './vacation-type';
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
    departureAirport: 'BRU',
    deepLink: 'https://www.corendon.be/vakantie#5007.MLELC.BRUPMI.200826.8.DZI-U',
    ...overrides,
  };
}

test('writeBudgetParams omits unrestricted UI defaults (500 / 2000)', () => {
  const params = new URLSearchParams('country=Spanje&vacationTypes=Adults+Only');
  writeBudgetParams(params, 500, 2000, 500, 2000);
  assert.equal(params.get('budgetMin'), null);
  assert.equal(params.get('budgetMax'), null);
  assert.equal(params.get('vacationTypes'), 'Adults Only');
});

test('budget slider track fill uses the same scale as range inputs', () => {
  const filterMin = 500;
  const filterMax = 2000;
  const span = filterMax - filterMin;
  // UI label €0 maps to filterMin; fill must start at 0% with the left thumb.
  assert.equal(((filterMin - filterMin) / span) * 100, 0);
  assert.equal(((1250 - filterMin) / span) * 100, 50);
  assert.equal(((filterMax - filterMin) / span) * 100, 100);
  // Old bug: 0..2000 visual scale put default min fill at 25%.
  assert.equal(((filterMin - 0) / 2000) * 100, 25);

  const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
  const src = readFileSync(join(root, 'components/results/filter-sidebar.tsx'), 'utf8');
  assert.equal(src.includes('BUDGET_MIN_BOUND'), false);
  assert.ok(src.includes('draftBudget.min - BUDGET_FILTER_MIN'));
  assert.ok(src.includes('draftBudget.max - BUDGET_FILTER_MIN'));
});

test('writeBudgetParams keeps real budget constraints', () => {
  const params = new URLSearchParams();
  writeBudgetParams(params, 700, 1500, 500, 2000);
  assert.equal(params.get('budgetMin'), '700');
  assert.equal(params.get('budgetMax'), '1500');
});

test('Adults Only matches hotelName and feedDescription keywords', () => {
  assert.equal(
    offerMatchesVacationType(
      makeOffer({ hotelName: 'BLUESEA Arenal Tower Adults Only' }),
      'Adults Only',
    ),
    true,
  );
  assert.equal(
    offerMatchesVacationType(
      makeOffer({ feedDescription: 'Dit adults-only resort is rustig.' }),
      'Adults Only',
    ),
    true,
  );
  assert.equal(offerMatchesVacationType(makeOffer(), 'Adults Only'), false);
});

test('Buitenzwembad matches feedDescription keyword', () => {
  assert.equal(
    offerMatchesAmenity(
      makeOffer({ feedDescription: 'Faciliteiten: Buitenzwembad en tuin.' }),
      'pool_outdoor',
    ),
    true,
  );
  assert.equal(offerMatchesAmenity(makeOffer(), 'pool_outdoor'), false);
});

test('vacationTypes and amenities URL round-trip', () => {
  assert.deepEqual(parseVacationTypesParam(serializeVacationTypesParam(['Adults Only', 'Familie'])), [
    'Adults Only',
    'Familie',
  ]);
  assert.deepEqual(parseAmenitiesParam(serializeAmenitiesParam(['pool_outdoor', 'sauna'])), [
    'pool_outdoor',
    'sauna',
  ]);
});

test('hasCarRental URL round-trip uses only =1', () => {
  const params = new URLSearchParams('country=Spanje&hasCarRental=1');
  assert.equal(params.get('hasCarRental'), '1');
  params.delete('hasCarRental');
  assert.equal(params.get('hasCarRental'), null);
});

test('filterOffers does not apply phantom default budget', () => {
  const offers = [
    makeOffer({ id: 'cheap', price: 200, hotelName: 'Budget Adults Only' }),
    makeOffer({ id: 'mid', price: 900, hotelName: 'Mid Adults Only' }),
    makeOffer({ id: 'pricey', price: 2500, hotelName: 'Luxe Adults Only' }),
  ];

  const withoutBudget = filterOffers(offers, { vacationTypes: ['Adults Only'] });
  assert.equal(withoutBudget.length, 3);

  const withInjectedDefaults = filterOffers(offers, {
    vacationTypes: ['Adults Only'],
    budgetMin: 500,
    budgetMax: 2000,
  });
  assert.equal(withInjectedDefaults.length, 1);
  assert.equal(withInjectedDefaults[0]?.id, 'mid');
});

test('All Inclusive board filter uses canonical boardType', () => {
  const offers = [
    makeOffer({ id: 'ai', boardType: 'All Inclusive' }),
    makeOffer({ id: 'lo', boardType: 'Logies en ontbijt' }),
  ];
  const filtered = filterOffers(offers, { boardTypes: ['All Inclusive'] });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]?.id, 'ai');
});
