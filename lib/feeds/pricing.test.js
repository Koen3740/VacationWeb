const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { savePriceUpdate } = require('./pricing');

test('savePriceUpdate appends a price history entry', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vacationweb-pricing-'));
  const storePath = path.join(tempDir, 'price-history.json');

  const result = savePriceUpdate({ externalId: 'cor-1001', price: 689, storePath });

  assert.equal(result.count, 1);
  assert.equal(JSON.parse(fs.readFileSync(storePath, 'utf8'))[0].price, 689);
});
