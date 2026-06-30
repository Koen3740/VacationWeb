const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { registerCorendonFeed } = require('./registry');
const { fetchCorendonFeed } = require('./fetcher');
const { parseCorendonFeed } = require('./parser');
const { validateOffers } = require('./validator');
const { ingestCorendonFeed } = require('./pipeline');
const { savePriceUpdate } = require('./pricing');

test('US-01 through US-07 complete an end-to-end Corendon ingest flow', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vacationweb-phase1a-'));
  const registryPath = path.join(tempDir, 'feed-registry.json');
  const rawPayloadPath = path.join(tempDir, 'raw-feed.json');
  const offersStorePath = path.join(tempDir, 'offers.json');
  const priceStorePath = path.join(tempDir, 'price-history.json');
  const fixturePath = path.join(__dirname, 'fixtures', 'corendon-feed.sample.json');

  const registryResult = registerCorendonFeed({ filePath: registryPath });
  assert.equal(registryResult.provider.name, 'Corendon');
  assert.equal(registryResult.feed.status, 'active');

  const fetchResult = await fetchCorendonFeed({ payloadPath: rawPayloadPath, fixturePath });
  assert.equal(fetchResult.status, 'stored');

  const payload = JSON.parse(fs.readFileSync(rawPayloadPath, 'utf8'));
  const parsed = parseCorendonFeed(payload);
  assert.equal(parsed.offers.length, 1);

  const validation = validateOffers(parsed.offers);
  assert.equal(validation.valid.length, 1);
  assert.equal(validation.invalid.length, 0);

  const ingestResult = ingestCorendonFeed({ payload, storePath: offersStorePath });
  assert.equal(ingestResult.savedCount, 1);
  assert.equal(ingestResult.invalidCount, 0);

  const priceResult = savePriceUpdate({ externalId: 'cor-1001', price: 689, storePath: priceStorePath });
  assert.equal(priceResult.count, 1);

  const storedOffers = JSON.parse(fs.readFileSync(offersStorePath, 'utf8'));
  const priceHistory = JSON.parse(fs.readFileSync(priceStorePath, 'utf8'));

  assert.equal(storedOffers[0].externalId, 'cor-1001');
  assert.equal(priceHistory[0].price, 689);
});
