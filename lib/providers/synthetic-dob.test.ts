import assert from 'node:assert/strict';
import test from 'node:test';
import type { TravelOffer } from '../feeds/canonical/travel-offer';
import { catalogReturnDateIso, catalogReturnDateOffsetDays } from '../offers/duration-semantics';
import {
  SYNTHETIC_ADULT_DOB,
  calculateOfferReturnDate,
  calculateReturnDate,
  partyHasValidAges,
  syntheticChildDob,
  syntheticDobForMember,
  tripDobReferenceForOffer,
} from './synthetic-dob';

type OfferLike = Parameters<typeof calculateOfferReturnDate>[0];

function offer(provider: string, nights: number, departureDate: string): OfferLike {
  return { provider, nights, departureDate } as OfferLike;
}

test('DATE: calculateReturnDate adds whole days (normal date)', () => {
  assert.equal(calculateReturnDate('2026-10-10', 7), '2026-10-17');
  assert.equal(calculateReturnDate('2026-10-10', 0), '2026-10-10');
});

test('DATE: calculateReturnDate crosses month and year boundaries', () => {
  assert.equal(calculateReturnDate('2026-12-28', 7), '2027-01-04');
  assert.equal(calculateReturnDate('2026-01-30', 3), '2026-02-02');
});

test('DATE: calculateReturnDate handles 28 Feb / 29 Feb in leap and non-leap years', () => {
  assert.equal(calculateReturnDate('2027-02-21', 7), '2027-02-28');
  assert.equal(calculateReturnDate('2027-02-22', 7), '2027-03-01');
  assert.equal(calculateReturnDate('2028-02-22', 7), '2028-02-29');
  assert.equal(calculateReturnDate('2028-02-23', 7), '2028-03-01');
});

test('DATE: calculateReturnDate rejects invalid input', () => {
  assert.equal(calculateReturnDate('2026-02-30', 7), null);
  assert.equal(calculateReturnDate('nope', 7), null);
  assert.equal(calculateReturnDate('2026-10-10', -1), null);
  assert.equal(calculateReturnDate('2026-10-10', 1.5), null);
});

type OfferWithType = OfferLike & { durationType?: string };

function offerOf(
  provider: string,
  nights: number,
  departureDate: string,
  durationType?: string,
): OfferWithType {
  return { provider, nights, departureDate, durationType } as OfferWithType;
}

test('SEMANTICS: nights-type offer: 10 Oct + 7 nights = 17 Oct', () => {
  // durationType 'nachten' (not a days provider): nights field counts NIGHTS -> return = departure + nights.
  assert.equal(calculateOfferReturnDate(offerOf('Other', 7, '2026-10-10', 'nachten')), '2026-10-17');
  assert.equal(catalogReturnDateOffsetDays(offerOf('Other', 7, '2026-10-10', 'nachten') as TravelOffer), 7);
  assert.equal(catalogReturnDateOffsetDays(offerOf('Other', 7, '2026-10-10') as TravelOffer), 7);
});

test('SEMANTICS: days-type offer: 10 Oct + 8 days = 17 Oct (departure and return day both count)', () => {
  assert.equal(calculateOfferReturnDate(offerOf('Other', 8, '2026-10-10', 'dagen')), '2026-10-17');
  assert.equal(calculateOfferReturnDate(offerOf('Other', 8, '2026-10-10', 'days')), '2026-10-17');
  assert.equal(catalogReturnDateOffsetDays(offerOf('Other', 8, '2026-10-10', 'dagen') as TravelOffer), 7);
  // 1 day = day trip, return = departure
  assert.equal(calculateOfferReturnDate(offerOf('Other', 1, '2026-10-10', 'dagen')), '2026-10-10');
});

test('SEMANTICS: Sunweb / Eliza / Corendon nights field = days: 8 days from 10 Oct = 17 Oct', () => {
  assert.equal(calculateOfferReturnDate(offerOf('Sunweb', 8, '2026-10-10', 'dagen')), '2026-10-17');
  assert.equal(calculateOfferReturnDate(offerOf('Sunweb', 8, '2026-10-10')), '2026-10-17');
  assert.equal(calculateOfferReturnDate(offerOf('Eliza was here', 8, '2026-10-10', 'dagen')), '2026-10-17');
  // Real catalog json stores no durationType: the provider name alone must give the same date.
  assert.equal(calculateOfferReturnDate(offerOf('Eliza was here', 8, '2026-10-10')), '2026-10-17');
  assert.equal(calculateOfferReturnDate(offerOf('Eliza', 8, '2026-10-10')), '2026-10-17');
  assert.equal(calculateOfferReturnDate(offerOf('Corendon', 8, '2026-10-10', 'dagen')), '2026-10-17');
  assert.equal(calculateOfferReturnDate(offerOf('Corendon', 8, '2026-10-10')), '2026-10-17');
});

test('SEMANTICS: real catalog examples (Corendon 12/12/2026 = 7 nights = 8 days; Sunweb/Eliza Duration 8)', () => {
  // data/offers.json: Corendon departureDate 12/12/2026, nights 8, deepLink fragment ...121226.7.DZ-A (7 nights).
  assert.equal(calculateOfferReturnDate(offerOf('Corendon', 8, '12/12/2026')), '2026-12-19');
  // Corendon API proof (t349u): ...101226-4-DZF, departure 2026-12-10, API returnDate 2026-12-14; feed nights field = 5.
  assert.equal(calculateOfferReturnDate(offerOf('Corendon', 5, '2026-12-10')), '2026-12-14');
  // t349u: Sunweb 84012 D=2026-10-07 Duration 8 -> last Sunweb 'child' reference day 2026-10-14 (= D+7).
  assert.equal(calculateOfferReturnDate(offerOf('Sunweb', 8, '2026-10-07')), '2026-10-14');
  // t349u: Eliza 133863 D=2026-10-14 Duration 8 -> 2026-10-21 (= D+7).
  assert.equal(calculateOfferReturnDate(offerOf('Eliza was here', 8, '2026-10-14')), '2026-10-21');
});

test('SEMANTICS: year boundary and 28/29 Feb (8 days / 7 nights)', () => {
  assert.equal(calculateOfferReturnDate(offerOf('Sunweb', 8, '2026-12-28')), '2027-01-04');
  assert.equal(calculateOfferReturnDate(offerOf('Other', 7, '2026-12-28', 'nachten')), '2027-01-04');
  assert.equal(calculateOfferReturnDate(offerOf('Corendon', 8, '2026-12-31')), '2027-01-07');
  assert.equal(calculateOfferReturnDate(offerOf('Eliza was here', 8, '2027-02-21')), '2027-02-28');
  assert.equal(calculateOfferReturnDate(offerOf('Eliza was here', 8, '2027-02-22')), '2027-03-01');
  assert.equal(calculateOfferReturnDate(offerOf('Sunweb', 8, '2028-02-22')), '2028-02-29');
  assert.equal(calculateOfferReturnDate(offerOf('Sunweb', 8, '2028-02-23')), '2028-03-01');
  assert.equal(calculateOfferReturnDate(offerOf('Corendon', 8, '2028-02-22')), '2028-02-29');
  assert.equal(calculateOfferReturnDate(offerOf('Other', 7, '2028-02-22', 'nachten')), '2028-02-29');
});

test('SEMANTICS: DOB reference date IS the central offer end date (same as cards/detail)', () => {
  for (const [provider, nights] of [['Sunweb', 8], ['Eliza was here', 8], ['Corendon', 8], ['Other', 7]] as const) {
    const o = offerOf(provider, nights, '2026-10-10', provider === 'Other' ? 'nachten' : undefined);
    assert.equal(calculateOfferReturnDate(o), catalogReturnDateIso(o as TravelOffer, '2026-10-10'), provider);
    assert.equal(calculateOfferReturnDate(o), '2026-10-17', provider);
  }
  assert.equal(catalogReturnDateOffsetDays(offerOf('Sunweb', 8, '2026-10-10') as TravelOffer), 7);
});

test('DATE: different durations give different return dates', () => {
  assert.equal(calculateOfferReturnDate(offer('Sunweb', 4, '2026-10-10')), '2026-10-13');
  assert.equal(calculateOfferReturnDate(offer('Sunweb', 15, '2026-10-10')), '2026-10-24');
  assert.equal(calculateOfferReturnDate(offer('Corendon', 15, '2026-10-10')), '2026-10-24');
});

test('DATE: exact provider departure overrides the offer departure date', () => {
  assert.equal(
    calculateOfferReturnDate(offer('Sunweb', 8, '2026-10-10'), '2026-11-01'),
    '2026-11-08',
  );
  assert.deepEqual(tripDobReferenceForOffer(offer('Sunweb', 8, '2026-10-10')), {
    returnDate: '2026-10-17',
  });
});

test('DOB: child exactly 2 at return gets a 2nd birthday ON the return day (= child, not baby, for Sunweb/Eliza)', () => {
  // t349u: Sunweb/Eliza price 2nd birthday <= last travel day (D+7 for 8 days) as child, D+8 as baby.
  const returnDate = calculateOfferReturnDate(offer('Sunweb', 8, '2026-10-10'));
  assert.equal(returnDate, '2026-10-17');
  assert.equal(syntheticChildDob(returnDate as string, 2), '2024-10-17');
});

test('DATE: unknown departure or duration gives a null return date (fail closed)', () => {
  assert.equal(calculateOfferReturnDate(offer('Sunweb', 7, '')), null);
  assert.equal(calculateOfferReturnDate(offer('Sunweb', 0, '2026-10-10')), null);
  assert.deepEqual(tripDobReferenceForOffer(offer('Sunweb', 0, '2026-10-10')), { returnDate: null });
});

test('DOB: synthetic child DOB = return date minus age years', () => {
  assert.equal(syntheticChildDob('2026-10-17', 0), '2026-10-17');
  assert.equal(syntheticChildDob('2026-10-17', 1), '2025-10-17');
  assert.equal(syntheticChildDob('2026-10-17', 2), '2024-10-17');
  assert.equal(syntheticChildDob('2026-10-17', 11), '2015-10-17');
  assert.equal(syntheticChildDob('2026-10-17', 17), '2009-10-17');
  assert.equal(syntheticChildDob('2027-01-04', 5), '2022-01-04');
});

test('DOB: 29 Feb in a non-leap birth year becomes 28 Feb (not 1 Mar)', () => {
  assert.equal(syntheticChildDob('2028-02-29', 5), '2023-02-28');
  assert.equal(syntheticChildDob('2028-02-29', 1), '2027-02-28');
  assert.equal(syntheticChildDob('2028-02-29', 0), '2028-02-29');
  assert.equal(syntheticChildDob('2028-02-29', 4), '2024-02-29');
  assert.equal(syntheticChildDob('2028-02-29', 8), '2020-02-29');
  assert.equal(syntheticChildDob('2028-02-29', 12), '2016-02-29');
  assert.equal(syntheticChildDob('2026-02-28', 5), '2021-02-28');
});

test('DOB: invalid ages and dates are rejected', () => {
  assert.equal(syntheticChildDob('2026-10-17', -1), null);
  assert.equal(syntheticChildDob('2026-10-17', 18), null);
  assert.equal(syntheticChildDob('2026-10-17', 2.5), null);
  assert.equal(syntheticChildDob('2026-02-29', 5), null);
});

test('DOB: adult uses the fixed dummy, child needs a return date', () => {
  assert.equal(SYNTHETIC_ADULT_DOB, '1986-01-01');
  assert.equal(syntheticDobForMember({ age: null }, undefined), '1986-01-01');
  assert.equal(syntheticDobForMember({ age: 5 }, { returnDate: '2026-10-17' }), '2021-10-17');
  assert.equal(syntheticDobForMember({ age: 5 }, { returnDate: null }), null);
  assert.equal(syntheticDobForMember({ age: 5 }, undefined), null);
});

test('TRAVELLER: partyHasValidAges accepts 0..17 and adults, rejects -1 and 18', () => {
  assert.equal(partyHasValidAges([{ age: null }, { age: 0 }, { age: 17 }]), true);
  assert.equal(partyHasValidAges([{ age: null }, { age: -1 }]), false);
  assert.equal(partyHasValidAges([{ age: null }, { age: 18 }]), false);
});