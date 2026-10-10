import assert from 'node:assert/strict';
import test from 'node:test';
import type { TravelOffer } from '../feeds/canonical/travel-offer';
import {
  buildDetailOfferExtras,
  hasRentalCarDetails,
  hasStructuredDayProgramme,
  priceInclusionRows,
  pricePerPersonLine,
  provenDiscountPercentage,
  provenListPrice,
} from './detail-extras';

function makeOffer(overrides: Partial<TravelOffer> = {}): TravelOffer {
  return {
    id: 'sunweb-1',
    provider: 'Sunweb',
    hotelName: 'Hotel Test',
    destinationCountry: 'Spanje',
    destinationCity: 'Costa Adeje',
    departureAirport: 'BRU',
    departureAirportCode: 'BRU',
    departureDate: '2026-10-10',
    boardType: 'Halfpension',
    nights: 8,
    flightIncluded: 'true',
    price: 999,
    pricePerDay: 142,
    imageUrl: 'https://example.com/a.jpg',
    deepLink: 'https://www.sunweb.be/hotel',
    livePriceStatus: 'proven',
    livePriceSource: 'getPromotedPrice',
    liveTotalPrice: 2215.5,
    liveTotalPriceField: 'getPromotedPrice.totalPrice',
    ...overrides,
  };
}

const TWO_ADULTS = {
  adults: 2,
  rooms: 1,
  party: [
    { age: null, roomIndex: 0 },
    { age: null, roomIndex: 0 },
  ],
};

test('extras use the provider total and do not multiply p.p. by party size', () => {
  const extras = buildDetailOfferExtras(makeOffer(), TWO_ADULTS);
  assert.equal(extras.liveTotalPrice?.amount, 2215.5);
  assert.notEqual(extras.liveTotalPrice?.amount, 999 * 2);
  assert.equal(extras.livePricePerPerson?.amount, 999);
  assert.equal(extras.partyLabel, '2 volwassenen');
  assert.equal(extras.listPrice, undefined);
  assert.equal(extras.discountPercentage, undefined);
  assert.equal(extras.flights, undefined);
  assert.equal(extras.transfer, undefined);
  assert.equal(extras.adminFees, undefined);
  assert.equal(extras.guaranteeFund, undefined);
  assert.equal(extras.dayProgramme, undefined);
  assert.equal(extras.rentalCar, undefined);
  assert.equal(hasStructuredDayProgramme(extras), false);
  assert.equal(hasRentalCarDetails(extras), false);
});

test('return date comes from the catalog offset, not a second formula', () => {
  const extras = buildDetailOfferExtras(makeOffer(), TWO_ADULTS);
  assert.equal(extras.departureDateIso, '2026-10-10');
  assert.equal(extras.returnDateIso, '2026-10-17');
  assert.match(extras.returnDateLabel ?? '', /17\s*okt\.?\s*2026/i);
  assert.match(extras.departureDateLabel ?? '', /10\s*okt\.?\s*2026/i);
});

test('arrival airport and car flag appear only when the offer carries them', () => {
  const plain = buildDetailOfferExtras(makeOffer(), TWO_ADULTS);
  assert.equal(plain.arrivalAirport, undefined);
  assert.equal(plain.carRentalIncluded, undefined);
  assert.equal(plain.tripBadge, undefined);

  const withArrival = buildDetailOfferExtras(
    makeOffer({
      provider: 'Corendon',
      hotelName: 'Fly & Drive Andalusië Compleet',
      arrivalAirport: 'AGP',
      hasCarRental: true,
      livePriceSource: 'upsales',
      liveTotalPriceField: 'upsales.totalPrice',
    }),
    TWO_ADULTS,
  );
  assert.equal(withArrival.arrivalAirport, 'AGP');
  assert.equal(withArrival.carRentalIncluded, true);
  assert.equal(withArrival.tripBadge, 'Fly & Drive');
  assert.equal(hasRentalCarDetails(withArrival), false);
});

test('strike-through requires a higher provider list price', () => {
  const base = buildDetailOfferExtras(makeOffer(), TWO_ADULTS);
  assert.equal(provenListPrice(base), undefined);
  assert.equal(provenDiscountPercentage({ ...base, discountPercentage: 16 }), undefined);

  const discounted = {
    ...base,
    listPrice: { amount: 4678, currency: 'EUR' as const },
    discountPercentage: 16,
  };
  assert.equal(provenListPrice(discounted)?.amount, 4678);
  assert.equal(provenDiscountPercentage(discounted), 16);

  const notHigher = { ...base, listPrice: { amount: 2215.5, currency: 'EUR' as const }, discountPercentage: 10 };
  assert.equal(provenListPrice(notHigher), undefined);

  const rows = priceInclusionRows(discounted);
  assert.equal(rows.some((row) => row.label === 'Korting' && row.value === '−16%'), true);
  assert.equal(rows.some((row) => row.value.includes('2.215,50')), true);
  assert.match(pricePerPersonLine(discounted) ?? '', /999,00 p\.p\./);
  assert.match(pricePerPersonLine(discounted) ?? '', /incl\. vlucht en halfpension/);
});

test('inclusion rows omit fees, guarantee fund and transfer when unset', () => {
  const rows = priceInclusionRows(buildDetailOfferExtras(makeOffer(), TWO_ADULTS));
  const labels = rows.map((row) => row.label).join(' | ');
  assert.doesNotMatch(labels, /reservering|garantiefonds|SGR|bagage|transfer|onbekend/i);
  assert.equal(rows.some((row) => row.label === 'Halfpension' && row.value === 'inbegrepen'), true);
});
