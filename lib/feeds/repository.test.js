const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { saveNormalizedOffers } = require('./repository');

test('saveNormalizedOffers persists canonical offers into a JSON store', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vacationweb-repo-'));
  const storePath = path.join(tempDir, 'offers.json');

  const offers = [
    {
      externalId: 'cor-1001',
      hotelName: 'Hotel Palma Bay',
      destination: 'Mallorca',
      country: 'Spain',
      region: 'Balearic Islands',
      price: 689,
      currency: 'EUR',
      nights: 7,
      boardType: 'All Inclusive',
      departureDate: '2026-07-10',
      provider: 'Corendon',
    },
  ];

  const result = saveNormalizedOffers({ offers, storePath });

  assert.equal(result.count, 1);
  assert.equal(JSON.parse(fs.readFileSync(storePath, 'utf8'))[0].externalId, 'cor-1001');
});
