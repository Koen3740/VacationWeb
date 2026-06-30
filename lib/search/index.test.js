const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { buildOfferIndex, buildOfferSearchIndex, searchOffers, searchOfferIndex, addOffersToSearchIndex } = require('./index');

test('US-09 indexes imported offers and supports destination and hotel searches', () => {
  const proofPath = path.join(__dirname, '..', '..', 'data', 'phase1a-proof', 'offers.json');
  const offers = JSON.parse(fs.readFileSync(proofPath, 'utf8'));

  assert.equal(offers.length, 1);

  const index = buildOfferSearchIndex(offers);
  assert.equal(index.documents.length, 1);
  assert.equal(index.documents[0].destination, 'Mallorca');
  assert.equal(index.documents[0].hotelName, 'Hotel Palma Bay');

  const destinationResults = searchOfferIndex(index, { query: 'Mallorca' });
  assert.equal(destinationResults.length, 1);
  assert.equal(destinationResults[0].externalId, 'cor-1001');

  const hotelResults = searchOfferIndex(index, { query: 'Palma' });
  assert.equal(hotelResults.length, 1);
  assert.equal(hotelResults[0].hotelName, 'Hotel Palma Bay');

  const emptyResults = searchOfferIndex(index, { query: 'Canary' });
  assert.deepEqual(emptyResults, []);

  const updatedIndex = addOffersToSearchIndex(index, [
    {
      externalId: 'cor-1002',
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

  const regionResults = searchOfferIndex(updatedIndex, { query: 'Tenerife' });
  assert.equal(regionResults.length, 1);
  assert.equal(regionResults[0].externalId, 'cor-1002');

  const legacyResult = searchOffers({ query: 'palma', indexPath: path.join(__dirname, '..', '..', 'data', 'phase1a-proof', 'offers-index.json') });
  assert.equal(legacyResult.length, 0);
});
