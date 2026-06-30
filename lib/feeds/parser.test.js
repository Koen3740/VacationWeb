const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { parseCorendonFeed } = require('./parser');

test('parseCorendonFeed normalizes offers into a canonical shape', () => {
  const payloadPath = path.join(__dirname, 'fixtures', 'corendon-feed.sample.json');
  const payload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));

  const result = parseCorendonFeed(payload);

  assert.equal(result.provider, 'Corendon');
  assert.equal(result.offers.length, 1);
  assert.equal(result.offers[0].externalId, 'cor-1001');
  assert.equal(result.offers[0].hotelName, 'Hotel Palma Bay');
  assert.equal(result.offers[0].destination, 'Mallorca');
  assert.equal(result.offers[0].boardType, 'All Inclusive');
});
