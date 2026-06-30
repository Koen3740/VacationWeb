const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { registerCorendonFeed, loadFeedRegistry } = require('./registry');

test('registerCorendonFeed creates a provider and active feed record', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vacationweb-'));
  const registryPath = path.join(tempDir, 'registry.json');

  const result = registerCorendonFeed({ filePath: registryPath });

  assert.equal(result.provider.name, 'Corendon');
  assert.equal(result.feed.providerId, result.provider.id);
  assert.equal(result.feed.status, 'active');

  const registry = loadFeedRegistry({ filePath: registryPath });
  assert.equal(registry.providers.length, 1);
  assert.equal(registry.feeds.length, 1);
  assert.equal(registry.feeds[0].name, 'Corendon primary feed');
});
