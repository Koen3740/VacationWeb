/**
 * P6: hero must never appear in curated destination gallery; teasers may differ from heroes.
 * Compiles lib like run-p3-destination-media-test.mjs
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const libDir = join(root, 'lib');
const out = mkdtempSync(join(tmpdir(), 'vw-p6-gate-'));
const tscBin = [
  join(root, 'node_modules', 'typescript', 'bin', 'tsc'),
  join(root, '..', 'node_modules', 'typescript', 'bin', 'tsc'),
].find((c) => existsSync(c));
assert.ok(tscBin, 'tsc missing');

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
const tsc = spawnSync(process.execPath, [tscBin, '-p', cfgPath], {
  cwd: root,
  encoding: 'utf8',
});
assert.equal(tsc.status, 0, tsc.stdout + tsc.stderr);

const require = createRequire(import.meta.url);
const {
  selectDestinationHeroAsset,
  selectDiscoverTeaserAsset,
} = require(join(out, 'destination-media', 'select-discover-teaser-asset.js'));
const { curateDiscoverGallery } = require(join(out, 'discover', 'discover-gallery-assets.js'));
const { listFinalVerifiedUsableAssets } = require(join(out, 'destination-media', 'list-final-verified-usable.js'));
const { loadDestinationMediaPool } = require(join(out, 'destination-media', 'load-destination-media-pool.js'));
const { truncateToFullRows } = require(join(out, 'destination-media', 'image-dimensions.js'));

for (const id of ['albania', 'sicily', 'crete', 'sardinia']) {
  const hero = selectDestinationHeroAsset(id);
  assert.ok(hero, `hero missing ${id}`);
  const pool = loadDestinationMediaPool(id);
  const finals = listFinalVerifiedUsableAssets(pool);
  const curated = truncateToFullRows(
    curateDiscoverGallery(
      id,
      finals.map((a) => ({ assetId: a.assetId, masterPath: a.masterPath })),
      {
        excludeAssetIds: [hero.assetId],
        excludeMasterPaths: [hero.masterPath],
      },
    ),
    3,
  );
  assert.ok(!curated.some((c) => c.assetId === hero.assetId), `hero leaked into grid for ${id}`);
  assert.equal(curated.length % 3, 0, `incomplete row ${id}: ${curated.length}`);
  const teaser = selectDiscoverTeaserAsset(id);
  assert.ok(teaser, `teaser missing ${id}`);
  console.log(`  PASS ${id}: hero=${hero.assetId} teaser=${teaser.assetId} grid=${curated.length}`);
}
console.log('PASS P6 hero≠grid + teaser separation');

// P7: curated list must not contain hero; length mirrors preferred (minus missing), never auto-append pool rest
const {
  DISCOVER_GALLERY_ASSET_IDS,
} = require(join(out, 'discover', 'discover-gallery-assets.js'));

for (const id of ['albania', 'sicily', 'crete', 'sardinia']) {
  const hero = selectDestinationHeroAsset(id);
  const preferred = DISCOVER_GALLERY_ASSET_IDS[id] || [];
  assert.ok(!preferred.includes(hero.assetId), `P7 preferred gallery still lists hero for ${id}`);
  const pool = loadDestinationMediaPool(id);
  const finals = listFinalVerifiedUsableAssets(pool);
  const curated = curateDiscoverGallery(
    id,
    finals.map((a) => ({ assetId: a.assetId, masterPath: a.masterPath })),
    { excludeAssetIds: [hero.assetId], excludeMasterPaths: [hero.masterPath] },
  );
  for (const c of curated) {
    assert.ok(preferred.includes(c.assetId), `P7 unexpected gallery asset ${c.assetId} for ${id}`);
  }
  assert.ok(curated.length <= preferred.length, `P7 append detected ${id}`);
  console.log(`  PASS P7 ${id}: preferred=${preferred.length} curated=${curated.length}`);
}
console.log('PASS P7 strict curated gallery (no append)');