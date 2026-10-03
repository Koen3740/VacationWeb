import assert from 'node:assert/strict';
import test from 'node:test';
import type { TravelOffer } from '../feeds/canonical/travel-offer';
import {
  addCalendarDaysIso,
  catalogDurationUsesDays,
  catalogReturnDateIso,
  catalogReturnDateOffsetDays,
  formatCatalogDurationDaysLabel,
} from './duration-semantics';

function makeOffer(overrides: Partial<TravelOffer> = {}): TravelOffer {
  return {
    id: 'sunweb-1',
    provider: 'Sunweb',
    hotelName: 'Hotel Test',
    destinationCountry: 'Spanje',
    nights: 8,
    price: 499,
    pricePerDay: 62,
    imageUrl: 'https://example.com/a.jpg',
    deepLink: 'https://www.sunweb.nl/hotel',
    ...overrides,
  };
}

test('catalog duration uses days for Corendon, Sunweb and Eliza', () => {
  assert.equal(catalogDurationUsesDays(makeOffer({ provider: 'Sunweb' })), true);
  assert.equal(catalogDurationUsesDays(makeOffer({ provider: 'Eliza' })), true);
  // Real catalog provider name (PROVIDERS.eliza.name); catalog json stores no durationType.
  assert.equal(catalogDurationUsesDays(makeOffer({ provider: 'Eliza was here' })), true);
  assert.equal(catalogDurationUsesDays(makeOffer({ provider: 'Corendon' })), true);
  assert.equal(catalogDurationUsesDays(makeOffer({ provider: 'Other' })), false);
  assert.equal(catalogDurationUsesDays(makeOffer({ provider: 'Other', durationType: 'dagen' })), true);
});

test('catalog return date offset: days offers end on departure + days - 1 (t355u: was +8 for Sunweb/Eliza)', () => {
  assert.equal(catalogReturnDateOffsetDays(makeOffer({ provider: 'Sunweb', nights: 8 })), 7);
  assert.equal(catalogReturnDateOffsetDays(makeOffer({ provider: 'Eliza', nights: 8 })), 7);
  assert.equal(catalogReturnDateOffsetDays(makeOffer({ provider: 'Eliza was here', nights: 8 })), 7);
  assert.equal(catalogReturnDateOffsetDays(makeOffer({ provider: 'Corendon', nights: 8 })), 7);
  assert.equal(catalogReturnDateOffsetDays(makeOffer({ provider: 'Other', nights: 8, durationType: 'dagen' })), 7);
  // nights offers: departure + nights
  assert.equal(catalogReturnDateOffsetDays(makeOffer({ provider: 'Other', nights: 7, durationType: 'nachten' })), 7);
  assert.equal(catalogReturnDateOffsetDays(makeOffer({ provider: 'Other', nights: 7 })), 7);
  assert.equal(catalogReturnDateOffsetDays(makeOffer({ provider: 'Sunweb', nights: 1 })), 0);
  assert.equal(catalogReturnDateOffsetDays(makeOffer({ provider: 'Sunweb', nights: 0 })), undefined);
});

test('central offer end date: 10 Oct + 8 days = 17 Oct = 10 Oct + 7 nights, same for every provider', () => {
  const days = (provider: string) => catalogReturnDateIso(makeOffer({ provider, nights: 8, durationType: 'dagen' }), '2026-10-10');
  assert.equal(days('Sunweb'), '2026-10-17');
  assert.equal(days('Eliza was here'), '2026-10-17');
  assert.equal(days('Corendon'), '2026-10-17');
  assert.equal(
    catalogReturnDateIso(makeOffer({ provider: 'Other', nights: 7, durationType: 'nachten' }), '2026-10-10'),
    '2026-10-17',
  );
  // year boundary and 28/29 Feb
  assert.equal(catalogReturnDateIso(makeOffer({ nights: 8 }), '2026-12-28'), '2027-01-04');
  assert.equal(catalogReturnDateIso(makeOffer({ nights: 8 }), '2027-02-21'), '2027-02-28');
  assert.equal(catalogReturnDateIso(makeOffer({ nights: 8 }), '2028-02-22'), '2028-02-29');
  assert.equal(catalogReturnDateIso(makeOffer({ nights: 0 }), '2026-10-10'), null);
});

test('addCalendarDaysIso is pure calendar arithmetic and rejects invalid input', () => {
  assert.equal(addCalendarDaysIso('2026-10-10', 7), '2026-10-17');
  assert.equal(addCalendarDaysIso('2027-02-22', 7), '2027-03-01');
  assert.equal(addCalendarDaysIso('2026-02-30', 7), null);
  assert.equal(addCalendarDaysIso('10/10/2026', 7), null);
  assert.equal(addCalendarDaysIso('2026-10-10', -1), null);
});

test('formatCatalogDurationDaysLabel uses Dutch pluralization', () => {
  assert.equal(formatCatalogDurationDaysLabel(1), '1 dag');
  assert.equal(formatCatalogDurationDaysLabel(8), '8 dagen');
});
