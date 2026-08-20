import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CAR_RENTAL_INCLUDED_LABEL,
  carRentalIncludedLabel,
  deriveCorendonHasCarRental,
  deriveSunwebHasCarRental,
  offerHasCarRental,
  parseHasCarRentalParam,
  serializeHasCarRentalParam,
  unionHasCarRental,
} from './has-car-rental';

test('Sunweb: Flight + hasCarRental true only', () => {
  assert.equal(
    deriveSunwebHasCarRental({ transportType: 'Flight', hasCarRentalRaw: 'true' }),
    true,
  );
  assert.equal(
    deriveSunwebHasCarRental({ transportType: 'Flight', hasCarRentalRaw: 'True' }),
    true,
  );
  assert.equal(
    deriveSunwebHasCarRental({ transportType: 'Flight', hasCarRentalRaw: 'false' }),
    undefined,
  );
  assert.equal(
    deriveSunwebHasCarRental({ transportType: 'Flight', hasCarRentalRaw: undefined }),
    undefined,
  );
  assert.equal(
    deriveSunwebHasCarRental({ transportType: 'SelfDrive', hasCarRentalRaw: 'true' }),
    undefined,
  );
});

test('Corendon: exact Fly-Drive token + flightIncluded true only', () => {
  assert.equal(
    deriveCorendonHasCarRental({
      subcategories: 'Fly-Drive vakantie,Zonvakantie',
      flightIncluded: 'true',
    }),
    true,
  );
  assert.equal(
    deriveCorendonHasCarRental({
      subcategories: 'Zonvakantie',
      flightIncluded: 'true',
    }),
    undefined,
  );
  assert.equal(
    deriveCorendonHasCarRental({
      subcategories: 'Fly-Drive vakantie',
      flightIncluded: 'false',
    }),
    undefined,
  );
  assert.equal(
    deriveCorendonHasCarRental({
      subcategories: 'Fly & Drive,Zonvakantie',
      flightIncluded: 'true',
    }),
    undefined,
  );
  assert.equal(
    deriveCorendonHasCarRental({
      subcategories: 'inclusief huurauto',
      flightIncluded: 'true',
    }),
    undefined,
  );
});

test('unionHasCarRental: true wins over missing/false', () => {
  assert.equal(unionHasCarRental([{}, { hasCarRental: true }]), true);
  assert.equal(unionHasCarRental([{ hasCarRental: false }, { hasCarRental: true }]), true);
  assert.equal(unionHasCarRental([{}, { hasCarRental: false }]), undefined);
});

test('card label uses only the boolean', () => {
  assert.equal(carRentalIncludedLabel({ hasCarRental: true }), CAR_RENTAL_INCLUDED_LABEL);
  assert.equal(carRentalIncludedLabel({}), undefined);
  assert.equal(carRentalIncludedLabel({ hasCarRental: false }), undefined);
  assert.equal(offerHasCarRental({ hotelName: 'Olée inclusief huurauto' } as { hasCarRental?: boolean }), false);
});

test('URL param is only hasCarRental=1', () => {
  assert.equal(parseHasCarRentalParam('1'), true);
  assert.equal(parseHasCarRentalParam('0'), undefined);
  assert.equal(parseHasCarRentalParam('true'), undefined);
  assert.equal(parseHasCarRentalParam(undefined), undefined);
  assert.equal(serializeHasCarRentalParam(true), '1');
  assert.equal(serializeHasCarRentalParam(undefined), undefined);
  assert.equal(serializeHasCarRentalParam(false), undefined);
});
