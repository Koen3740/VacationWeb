const fs = require('node:fs');
const path = require('node:path');

async function fetchCorendonFeed({ payloadPath, fixturePath } = {}) {
  const resolvedPath = payloadPath || path.join(process.cwd(), 'data', 'corendon-feed-latest.json');
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const sourcePath = fixturePath || path.join(__dirname, 'fixtures', 'corendon-feed.sample.json');
  const payload = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  fs.writeFileSync(resolvedPath, JSON.stringify(payload, null, 2));

  return {
    status: 'stored',
    payloadPath: resolvedPath,
    provider: payload.provider,
    offerCount: payload.offers?.length || 0,
  };
}

module.exports = {
  fetchCorendonFeed,
};
