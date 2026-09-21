/**
 * P3: Destination Media → Discover imageSrc resolve + pool overlay.
 * Compiles lib/destination-media + lib/discover with local tsc (zero-dep).
 */
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  writeFileSync,
  existsSync,
  readdirSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const libDir = join(root, 'lib');
const out = mkdtempSync(join(tmpdir(), 'vw-p3-dm-'));
const candidates = [
  join(root, 'node_modules', 'typescript', 'bin', 'tsc'),
  join(root, '..', 'node_modules', 'typescript', 'bin', 'tsc'),
];
const tscBin = candidates.find((c) => existsSync(c));

function listTs(dir) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .map((f) => join(dir, f));
}

const include = [
  ...listTs(join(libDir, 'destination-media')),
  ...listTs(join(libDir, 'discover')),
];

const tsconfig = {
  compilerOptions: {
    target: 'ES2020',
    module: 'commonjs',
    moduleResolution: 'node',
    esModuleInterop: true,
    strict: true,
    skipLibCheck: true,
    rootDir: libDir,
    outDir: out,
    declaration: false,
    types: ['node'],
    typeRoots: [join(root, 'node_modules', '@types')],
  },
  include,
};

const cfgPath = join(out, 'tsconfig.json');
writeFileSync(cfgPath, JSON.stringify(tsconfig, null, 2));

if (!tscBin) {
  console.error('Missing typescript binary');
  process.exit(1);
}

const tsc = spawnSync(process.execPath, [tscBin, '-p', cfgPath], {
  cwd: root,
  encoding: 'utf8',
});
if (tsc.status !== 0) {
  console.error(tsc.stdout);
  console.error(tsc.stderr);
  process.exit(tsc.status ?? 1);
}

const require = createRequire(import.meta.url);
const { resolveDiscoverImageSrc } = require(
  join(out, 'destination-media', 'resolve-discover-image-src.js'),
);
const { selectDiscoverTeaserAsset } = require(
  join(out, 'destination-media', 'select-discover-teaser-asset.js'),
);
const { loadDestinationMediaPool } = require(
  join(out, 'destination-media', 'load-destination-media-pool.js'),
);
const { listFinalVerifiedUsableAssets } = require(
  join(out, 'destination-media', 'list-final-verified-usable.js'),
);
const { getDiscoverPool } = require(join(out, 'discover', 'discover-pool.js'));
const { getHomepageDiscoverDestinations } = require(
  join(out, 'discover', 'get-homepage-discover-destinations.js'),
);

process.chdir(root);

let passed = 0;
function ok(label) {
  passed += 1;
  console.log(`  PASS ${label}`);
}

{
  const pool = loadDestinationMediaPool('albania', { root });
  assert.ok(pool);
  assert.equal(pool.destinationId, 'albania');
  const finals = listFinalVerifiedUsableAssets(pool, { root });
  assert.ok(finals.length >= 1);
  assert.ok(finals.every((a) => a.destinationId === 'albania'));
  ok('load albania FINAL assets');
}

{
  const crete = selectDiscoverTeaserAsset('crete', { root });
  assert.ok(crete);
  assert.equal(crete.destinationId, 'crete');
  assert.ok(!crete.assetId.includes('sardinia'));
  assert.ok(!crete.assetId.includes('albania'));
  ok('crete teaser never cross-destination');
}

{
  const a = selectDiscoverTeaserAsset('albania', { root });
  assert.equal(
    a.assetId,
    'vw-story-albania-blue-eye-crop-p5',
  );
  ok('preferred albania Blue Eye crop teaser');
}

const expected = {
  albania:
    '/images/verified/albania/vw-story-albania-blue-eye-crop-p5.jpg',
  crete:
    '/images/verified/crete/vw-story-crete-balos-aerial-commons.jpg',
  sicily:
    '/images/verified/sicily/vw-pool-sicily-scala-dei-turchi.jpg',
  sardinia:
    '/images/verified/sardinia/vw-story-sardinia-cala-goloritze-aguglia-commons.jpg',
};

for (const [id, url] of Object.entries(expected)) {
  const seed = `/images/wow-ssot/discover-${id}.jpg`;
  const src = resolveDiscoverImageSrc(id, seed, { root });
  assert.equal(src, url);
  const abs = join(root, 'public', ...url.split('/').filter(Boolean));
  assert.ok(existsSync(abs), `missing ${abs}`);
  ok(`resolve ${id} → verified`);
}

{
  const seed = '/images/wow-ssot/discover-albania.jpg';
  assert.equal(
    resolveDiscoverImageSrc('no-such-destination', seed, { root }),
    seed,
  );
  ok('missing pool falls back to seed');
}

{
  const pool = getDiscoverPool();
  assert.equal(pool.length, 4);
  for (const d of pool) {
    assert.equal(d.imageSrc, expected[d.destinationId]);
  }
  ok('getDiscoverPool overlays verified imageSrc');
}

{
  const result = getHomepageDiscoverDestinations({ limit: 5 });
  assert.equal(result.length, 4);
  assert.equal(result[0].imageSrc, expected.albania);
  assert.equal(result[1].imageSrc, expected.sicily);
  assert.equal(result[2].imageSrc, expected.crete);
  assert.equal(result[3].imageSrc, expected.sardinia);
  ok('homepage getter uses Destination Media teasers');
}

console.log(`PASS P3 destination-media discover (${passed} checks)`);

