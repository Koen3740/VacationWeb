/**
 * Zero-dep discover getter test (no vitest). Compiles lib/discover (non-test)
 * with local typescript, then runs assertions in this file.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const discoverSrc = join(root, 'lib', 'discover');
const libDir = join(root, 'lib');
const destinationMediaSrc = join(libDir, 'destination-media');
const out = mkdtempSync(join(tmpdir(), 'vw-discover-test-'));
const candidates = [
  join(root, 'node_modules', 'typescript', 'bin', 'tsc'),
  join(root, '..', 'node_modules', 'typescript', 'bin', 'tsc'),
];
const tscBin = candidates.find((c) => existsSync(c));

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
    include: [
    join(destinationMediaSrc, 'types.ts'),
    join(destinationMediaSrc, 'paths.ts'),
    join(destinationMediaSrc, 'load-destination-media-pool.ts'),
    join(destinationMediaSrc, 'list-final-verified-usable.ts'),
    join(destinationMediaSrc, 'select-discover-teaser-asset.ts'),
    join(destinationMediaSrc, 'ensure-verified-web-path.ts'),
    join(destinationMediaSrc, 'resolve-discover-image-src.ts'),
    join(discoverSrc, 'types.ts'),
    join(discoverSrc, 'homepage-discover-destinations.ts'),
    join(discoverSrc, 'discover-destination-href.ts'),
    join(discoverSrc, 'discover-gallery-intros.ts'),
    join(discoverSrc, 'get-homepage-discover-destinations.ts'),
    join(discoverSrc, 'discover-pool.ts'),
    join(discoverSrc, 'homepage-discover-slots.ts'),
    join(discoverSrc, 'homepage-discover-slot-state-io.ts'),
    join(discoverSrc, 'resolve-homepage-discover-slots.ts'),
  ],
};

const cfgPath = join(out, 'tsconfig.json');
writeFileSync(cfgPath, JSON.stringify(tsconfig, null, 2));

if (!tscBin) {
  console.error('Missing typescript binary under node_modules. VacationWebNext already has typescript as devDependency.');
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
const { getHomepageDiscoverDestinations } = require(
  join(out, 'discover', 'get-homepage-discover-destinations.js'),
);
const { HOMEPAGE_DISCOVER_DESTINATIONS } = require(
  join(out, 'discover', 'homepage-discover-destinations.js'),
);
const { HOMEPAGE_DISCOVER_LIMIT } = require(join(out, 'discover', 'types.js'));

const resultDefault = getHomepageDiscoverDestinations();
assert.ok(resultDefault.length <= HOMEPAGE_DISCOVER_LIMIT);
assert.ok(resultDefault.length <= 5);

const result = getHomepageDiscoverDestinations({ limit: 5 });
assert.equal(result.length, 4);
assert.deepEqual(
  result.map((d) => d.destinationId),
  ['albania', 'sicily', 'crete', 'sardinia'],
);
assert.deepEqual(
  result.map((d) => d.name),
  ['Albanië', 'Sicilië', 'Kreta', 'Sardinië'],
);
assert.equal(HOMEPAGE_DISCOVER_DESTINATIONS.length, 4);

assert.equal(getHomepageDiscoverDestinations({ limit: 0 }).length, 0);
assert.equal(getHomepageDiscoverDestinations({ limit: 1 }).length, 1);
assert.equal(getHomepageDiscoverDestinations({ limit: 2 }).length, 2);
assert.equal(getHomepageDiscoverDestinations({ limit: 3 }).length, 3);
assert.equal(getHomepageDiscoverDestinations({ limit: 4 }).length, 4);
assert.equal(getHomepageDiscoverDestinations({ limit: 99 }).length, 4);

assert.equal(result[0].imageSrc, '/images/verified/albania/vw-story-albania-blue-eye-crop-p5.jpg');
assert.equal(result[0].href, '/ontdekt/albania');
assert.equal(result[0].teaser, 'De verborgen parel van Europa');

console.log('PASS getHomepageDiscoverDestinations: â‰¤5, 4 seeded, limit respected, UTF-8 names OK');




