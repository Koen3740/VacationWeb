const test = require('node:test');
const assert = require('node:assert/strict');

const { validateOffers } = require('./validator');

test('validateOffers accepts complete offers and rejects incomplete ones', () => {
  const offers = [
    {
      externalId: 'cor-1001',
      hotelName: 'Hotel Palma Bay',
      destination: 'Mallorca',
      country: 'Spain',
      region: 'Balearic Islands',
      price: 689,
      nights: 7,
      boardType: 'All Inclusive',
      departureDate: '2026-07-10',
      provider: 'Corendon',
    },
    {
      externalId: 'cor-1002',
      hotelName: '',
      destination: 'Mallorca',
      country: 'Spain',
      region: 'Balearic Islands',
      price: 500,
      nights: 7,
      boardType: 'Half Board',
      departureDate: '2026-07-11',
      provider: 'Corendon',
    },
  ];

  const result = validateOffers(offers);

  assert.equal(result.valid.length, 1);
  assert.equal(result.invalid.length, 1);
  assert.equal(result.invalid[0].reason, 'missing_hotel_name');
});
