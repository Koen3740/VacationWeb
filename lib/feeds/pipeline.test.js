const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { ingestCorendonFeed } = require('./pipeline');

test('ingestCorendonFeed stores validated offers from the feed payload', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vacationweb-pipeline-'));
  const storePath = path.join(tempDir, 'offers.json');

  const result = ingestCorendonFeed({
    payload: {
      provider: 'Corendon',
      offers: [
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
        },
      ],
    },
    storePath,
  });

  assert.equal(result.savedCount, 1);
  assert.equal(result.invalidCount, 0);
  assert.equal(JSON.parse(fs.readFileSync(storePath, 'utf8'))[0].externalId, 'cor-1001');
});
