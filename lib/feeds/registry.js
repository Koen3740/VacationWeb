const fs = require('node:fs');
const path = require('node:path');

function ensureRegistryFile(filePath) {
  const resolvedPath = filePath || path.join(process.cwd(), 'data', 'feed-registry.json');
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(resolvedPath)) {
    fs.writeFileSync(resolvedPath, JSON.stringify({ providers: [], feeds: [] }, null, 2));
  }

  return resolvedPath;
}

function loadFeedRegistry({ filePath } = {}) {
  const resolvedPath = ensureRegistryFile(filePath);
  const content = fs.readFileSync(resolvedPath, 'utf8');
  return JSON.parse(content);
}

function saveFeedRegistry(registry, { filePath } = {}) {
  const resolvedPath = ensureRegistryFile(filePath);
  fs.writeFileSync(resolvedPath, JSON.stringify(registry, null, 2));
  return resolvedPath;
}

function registerCorendonFeed({ filePath } = {}) {
  const registry = loadFeedRegistry({ filePath });
  const provider = registry.providers.find((entry) => entry.name === 'Corendon');
  const providerId = provider ? provider.id : `provider-${Date.now()}`;

  if (!provider) {
    registry.providers.push({
      id: providerId,
      name: 'Corendon',
      type: 'tour-operator',
      createdAt: new Date().toISOString(),
    });
  }

  const feed = registry.feeds.find((entry) => entry.providerId === providerId && entry.name === 'Corendon primary feed');
  if (!feed) {
    registry.feeds.push({
      id: `feed-${Date.now()}`,
      providerId,
      name: 'Corendon primary feed',
      status: 'active',
      sourceType: 'json',
      createdAt: new Date().toISOString(),
    });
  }

  saveFeedRegistry(registry, { filePath });
  return {
    provider: registry.providers.find((entry) => entry.name === 'Corendon'),
    feed: registry.feeds.find((entry) => entry.providerId === providerId && entry.name === 'Corendon primary feed'),
  };
}

module.exports = {
  loadFeedRegistry,
  registerCorendonFeed,
  saveFeedRegistry,
};
