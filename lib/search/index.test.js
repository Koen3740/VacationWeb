const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { buildOfferIndex, buildOfferSearchIndex, searchOfferIndex, addOffersToSearchIndex } = require('./index');

test('US-09 indexes imported offers and supports destination and hotel searches', () => {
  const offersPath = path.join(__dirname, '..', '..', 'data', 'offers.json');
  const offers = JSON.parse(fs.readFileSync(offersPath, 'utf8'));

  assert.ok(offers.length > 0);

  const index = buildOfferSearchIndex(offers);
  assert.equal(index.documents.length, offers.length);

  const mallorcaOffer = offers.find((offer) => offer.region === 'Mallorca');
  assert.ok(mallorcaOffer, 'expected at least one Mallorca offer in offers.json');

  const regionResults = searchOfferIndex(index, { query: 'Mallorca' });
  assert.ok(regionResults.length > 0);
  assert.ok(regionResults.some((result) => result.externalId === mallorcaOffer.externalId));

  const hotelResults = searchOfferIndex(index, { query: String(mallorcaOffer.hotelName) });
  assert.ok(hotelResults.length > 0);
  assert.ok(hotelResults.some((result) => result.externalId === mallorcaOffer.externalId));

  const emptyResults = searchOfferIndex(index, { query: 'xyz-nonexistent-term-12345' });
  assert.deepEqual(emptyResults, []);

  const updatedIndex = addOffersToSearchIndex(index, [
    {
      externalId: 'test-offer-1',
      hotelName: 'Hotel Playa Azul',
      destination: 'Tenerife',
      country: 'Spain',
      region: 'Canary Islands',
      price: 799,
      currency: 'EUR',
      nights: 8,
      boardType: 'Half Board',
      departureDate: '2026-07-18',
      provider: 'Corendon',
    },
  ]);

  const tenerifeResults = searchOfferIndex(updatedIndex, { query: 'Tenerife' });
  assert.ok(tenerifeResults.some((result) => result.externalId === 'test-offer-1'));
});
