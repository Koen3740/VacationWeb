const fs = require('node:fs');
const path = require('node:path');

function ensureStoreFile(storePath) {
  const resolvedPath = storePath || path.join(process.cwd(), 'data', 'price-history.json');
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(resolvedPath)) {
    fs.writeFileSync(resolvedPath, JSON.stringify([], null, 2));
  }

  return resolvedPath;
}

function savePriceUpdate({ externalId, price, storePath } = {}) {
  const resolvedPath = ensureStoreFile(storePath);
  const existing = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  const entry = {
    externalId,
    price: Number(price),
    updatedAt: new Date().toISOString(),
  };
  const next = [...existing, entry];
  fs.writeFileSync(resolvedPath, JSON.stringify(next, null, 2));
  return { count: next.length, storePath: resolvedPath, entry };
}

module.exports = {
  savePriceUpdate,
};
