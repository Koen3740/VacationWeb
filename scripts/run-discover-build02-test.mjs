/**
 * Zero-dep Build 02 discover test (no vitest). Compiles lib/discover (non-test)
 * with local typescript, then runs assertions in this file.
 * Build 03: include homepage-discover-slot-state-io (getter default source).
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
const out = mkdtempSync(join(tmpdir(), 'vw-discover-b02-'));
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
    join(destinationMediaSrc, 'image-dimensions.ts'),
    join(discoverSrc, 'types.ts'),
    join(discoverSrc, 'homepage-discover-destinations.ts'),
    join(discoverSrc, 'discover-destination-href.ts'),
    join(discoverSrc, 'discover-pool.ts'),
    join(discoverSrc, 'homepage-discover-slots.ts'),
    join(discoverSrc, 'homepage-discover-slot-state-io.ts'),
    join(discoverSrc, 'resolve-homepage-discover-slots.ts'),
    join(discoverSrc, 'apply-phased-slot-updates.ts'),
    join(discoverSrc, 'get-homepage-discover-destinations.ts'),
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
const {
  getDiscoverPool,
  isDiscoverDestinationRenderable,
} = require(join(out, 'discover', 'discover-pool.js'));
const { DEFAULT_HOMEPAGE_DISCOVER_SLOT_STATE } = require(
  join(out, 'discover', 'homepage-discover-slots.js'),
);
const { resolveHomepageDiscoverSlots } = require(
  join(out, 'discover', 'resolve-homepage-discover-slots.js'),
);
const { applyPhasedSlotUpdates } = require(
  join(out, 'discover', 'apply-phased-slot-updates.js'),
);

let passed = 0;
function ok(label) {
  passed += 1;
  console.log(`  PASS ${label}`);
}

// 1. Pool has 4 active
{
  const pool = getDiscoverPool();
  assert.equal(pool.length, 4);
  assert.equal(HOMEPAGE_DISCOVER_DESTINATIONS.length, 4);
  assert.ok(pool.every((d) => isDiscoverDestinationRenderable(d)));
  ok('1 pool has 4 active');
}

// 2. resolve returns 4 destinations (not 5)
{
  const resolved = resolveHomepageDiscoverSlots(
    DEFAULT_HOMEPAGE_DISCOVER_SLOT_STATE,
  );
  assert.equal(resolved.length, 4);
  assert.ok(resolved.length < HOMEPAGE_DISCOVER_LIMIT);
  assert.deepEqual(
    resolved.map((d) => d.destinationId),
    ['albania', 'sicily', 'crete', 'sardinia'],
  );
  ok('2 resolve returns 4 (not 5)');
}

// 3. If current id missing/inactive, failsafe to previous
{
  const pool = getDiscoverPool().map((d) =>
    d.destinationId === 'albania' ? { ...d, status: 'draft' } : { ...d },
  );
  const state = {
    slots: [
      {
        slotIndex: 0,
        destinationId: 'albania',
        previousDestinationId: 'sicily',
      },
      {
        slotIndex: 1,
        destinationId: 'crete',
        previousDestinationId: 'crete',
      },
      { slotIndex: 2, destinationId: null, previousDestinationId: null },
      { slotIndex: 3, destinationId: null, previousDestinationId: null },
      { slotIndex: 4, destinationId: null, previousDestinationId: null },
    ],
  };
  const resolved = resolveHomepageDiscoverSlots(state, pool);
  assert.equal(resolved[0].destinationId, 'sicily');
  assert.equal(resolved[1].destinationId, 'crete');
  assert.equal(resolved.length, 2);
  ok('3 failsafe to previous when current inactive');
}

// 4. If both missing, slot skipped (no ghost card)
{
  const state = {
    slots: [
      {
        slotIndex: 0,
        destinationId: 'missing-a',
        previousDestinationId: 'missing-b',
      },
      {
        slotIndex: 1,
        destinationId: 'crete',
        previousDestinationId: 'crete',
      },
      { slotIndex: 2, destinationId: null, previousDestinationId: null },
      { slotIndex: 3, destinationId: null, previousDestinationId: null },
      { slotIndex: 4, destinationId: null, previousDestinationId: null },
    ],
  };
  const resolved = resolveHomepageDiscoverSlots(state);
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].destinationId, 'crete');
  ok('4 both missing â†’ slot skipped (no ghost)');
}

// 5. reject replacing all filled slots at once
{
  const result = applyPhasedSlotUpdates(DEFAULT_HOMEPAGE_DISCOVER_SLOT_STATE, [
    { slotIndex: 0, destinationId: 'sicily' },
    { slotIndex: 1, destinationId: 'albania' },
    { slotIndex: 2, destinationId: 'sardinia' },
    { slotIndex: 3, destinationId: 'crete' },
  ]);
  assert.equal(result.ok, false);
  assert.match(result.reason, /Phased rotation rule/i);
  ok('5 phased reject all-filled replace');
}

// 6. allow replacing 1 of 4
{
  const result = applyPhasedSlotUpdates(DEFAULT_HOMEPAGE_DISCOVER_SLOT_STATE, [
    { slotIndex: 0, destinationId: 'sardinia' },
  ]);
  assert.equal(result.ok, true);
  assert.equal(result.state.slots[0].destinationId, 'sardinia');
  assert.equal(result.state.slots[0].previousDestinationId, 'albania');
  assert.equal(result.state.slots[1].destinationId, 'sicily');
  ok('6 phased allow replace 1 of 4');
}

// 7. UTF-8 names â€” use explicit default state (avoid cwd-dependent file load)
{
  const result = getHomepageDiscoverDestinations({
    limit: 5,
    state: DEFAULT_HOMEPAGE_DISCOVER_SLOT_STATE,
  });
  assert.deepEqual(
    result.map((d) => d.name),
    ['Albanië', 'Sicilië', 'Kreta', 'Sardinië'],
  );
  assert.equal(result.length, 4);
  assert.equal(
    getHomepageDiscoverDestinations({
      limit: 0,
      state: DEFAULT_HOMEPAGE_DISCOVER_SLOT_STATE,
    }).length,
    0,
  );
  assert.equal(
    getHomepageDiscoverDestinations({
      limit: 2,
      state: DEFAULT_HOMEPAGE_DISCOVER_SLOT_STATE,
    }).length,
    2,
  );
  assert.equal(
    getHomepageDiscoverDestinations({
      limit: 99,
      state: DEFAULT_HOMEPAGE_DISCOVER_SLOT_STATE,
    }).length,
    4,
  );
  ok('7 UTF-8 names Albanië/Sicilië/Kreta/Sardinië + getter limit');
}

// Default slot state: exactly 5 slots, slot 4 empty
{
  assert.equal(DEFAULT_HOMEPAGE_DISCOVER_SLOT_STATE.slots.length, 5);
  assert.equal(
    DEFAULT_HOMEPAGE_DISCOVER_SLOT_STATE.slots[4].destinationId,
    null,
  );
  ok('8 default state has 5 slots, 5th empty');
}

console.log(`PASS Build 02 discover tests (${passed} checks)`);



