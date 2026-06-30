const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { fetchCorendonFeed } = require('./fetcher');

test('fetchCorendonFeed stores a raw payload snapshot', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vacationweb-feed-'));
  const payloadPath = path.join(tempDir, 'raw-feed.json');

  const result = await fetchCorendonFeed({ payloadPath, fixturePath: path.join(__dirname, 'fixtures', 'corendon-feed.sample.json') });

  assert.equal(result.status, 'stored');
  assert.equal(JSON.parse(fs.readFileSync(payloadPath, 'utf8')).provider, 'Corendon');
});
