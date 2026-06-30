const test = require('node:test');
const assert = require('node:assert/strict');

const { dedupeOffers } = require('./dedupe');

test('dedupeOffers removes duplicate offers based on externalId', () => {
  const offers = [
    {
      externalId: 'cor-1001',
      hotelName: 'Hotel Palma Bay',
      destination: 'Mallorca',
      country: 'Spain',
      price: 689,
      nights: 7,
      boardType: 'All Inclusive',
      departureDate: '2026-07-10',
      provider: 'Corendon',
    },
    {
      externalId: 'cor-1001',
      hotelName: 'Hotel Palma Bay',
      destination: 'Mallorca',
      country: 'Spain',
      price: 689,
      nights: 7,
      boardType: 'All Inclusive',
      departureDate: '2026-07-10',
      provider: 'Corendon',
    },
    {
      externalId: 'cor-1002',
      hotelName: 'Hotel Son Mar',
      destination: 'Mallorca',
      country: 'Spain',
      price: 750,
      nights: 7,
      boardType: 'Half Board',
      departureDate: '2026-07-12',
      provider: 'Corendon',
    },
  ];

  const result = dedupeOffers(offers);

  assert.equal(result.kept.length, 2);
  assert.equal(result.duplicates.length, 1);
  assert.equal(result.duplicates[0].externalId, 'cor-1001');
});
