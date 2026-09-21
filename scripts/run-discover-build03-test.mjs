/**
 * Zero-dep Build 03 discover persistence test (no vitest).
 * Compiles lib/discover with local typescript, uses os.tmpdir() copy of state file.
 */
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  writeFileSync,
  existsSync,
  copyFileSync,
  readFileSync,
  mkdirSync,
} from 'node:fs';
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
const packageStateFile = join(
  root,
  'data',
  'discover',
  'homepage-discover-slots.json',
);
const out = mkdtempSync(join(tmpdir(), 'vw-discover-b03-'));
const tmpDataDir = mkdtempSync(join(tmpdir(), 'vw-discover-b03-data-'));
const tmpStateFile = join(tmpDataDir, 'homepage-discover-slots.json');

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
    join(discoverSrc, 'update-homepage-discover-slots.ts'),
    join(discoverSrc, 'get-homepage-discover-destinations.ts'),
  ],
};

const cfgPath = join(out, 'tsconfig.json');

writeFileSync(cfgPath, JSON.stringify(tsconfig, null, 2));

if (!tscBin) {
  console.error(
    'Missing typescript binary under node_modules. VacationWebNext already has typescript as devDependency.',
  );
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

if (!existsSync(packageStateFile)) {
  console.error('Missing package state file:', packageStateFile);
  process.exit(1);
}
copyFileSync(packageStateFile, tmpStateFile);

const require = createRequire(import.meta.url);
const { getHomepageDiscoverDestinations } = require(
  join(out, 'discover', 'get-homepage-discover-destinations.js'),
);
const { DEFAULT_HOMEPAGE_DISCOVER_SLOT_STATE } = require(
  join(out, 'discover', 'homepage-discover-slots.js'),
);
const { resolveHomepageDiscoverSlots } = require(
  join(out, 'discover', 'resolve-homepage-discover-slots.js'),
);
const {
  loadHomepageDiscoverSlotState,
  saveHomepageDiscoverSlotState,
  isValidHomepageDiscoverSlotState,
  resolveHomepageDiscoverSlotStatePath,
  DEFAULT_HOMEPAGE_DISCOVER_SLOT_STATE_RELATIVE_PATH,
} = require(join(out, 'discover', 'homepage-discover-slot-state-io.js'));
const { updateHomepageDiscoverSlots } = require(
  join(out, 'discover', 'update-homepage-discover-slots.js'),
);

let passed = 0;
function ok(label) {
  passed += 1;
  console.log(`  PASS ${label}`);
}

// 1. initial/default state â†’ resolve 4 destinations
{
  const resolved = resolveHomepageDiscoverSlots(
    DEFAULT_HOMEPAGE_DISCOVER_SLOT_STATE,
  );
  assert.equal(resolved.length, 4);
  assert.deepEqual(
    resolved.map((d) => d.destinationId),
    ['albania', 'sicily', 'crete', 'sardinia'],
  );
  ok('1 initial/default state â†’ resolve 4');
}

// 2. load persisted state from file
{
  const loaded = loadHomepageDiscoverSlotState({ filePath: tmpStateFile });
  assert.ok(isValidHomepageDiscoverSlotState(loaded));
  assert.equal(loaded.slots.length, 5);
  assert.equal(loaded.slots[0].destinationId, 'albania');
  assert.equal(loaded.slots[4].destinationId, null);
  const resolved = resolveHomepageDiscoverSlots(loaded);
  assert.equal(resolved.length, 4);
  ok('2 load persisted state from file');
}

// 3. explicit slot-update (swap slot 0 to another pool id)
{
  const result = updateHomepageDiscoverSlots(
    [{ slotIndex: 0, destinationId: 'sardinia' }],
    { filePath: tmpStateFile },
  );
  assert.equal(result.ok, true);
  assert.equal(result.state.slots[0].destinationId, 'sardinia');
  assert.equal(result.state.slots[0].previousDestinationId, 'albania');
  ok('3 explicit slot-update via updateHomepageDiscoverSlots');
}

// 4. reload file after update shows new assignment
{
  const reloaded = loadHomepageDiscoverSlotState({ filePath: tmpStateFile });
  assert.equal(reloaded.slots[0].destinationId, 'sardinia');
  assert.equal(reloaded.slots[0].previousDestinationId, 'albania');
  assert.equal(reloaded.slots[1].destinationId, 'sicily');
  const raw = JSON.parse(readFileSync(tmpStateFile, 'utf8'));
  assert.equal(raw.slots[0].destinationId, 'sardinia');
  ok('4 reload file after update shows new assignment');
}

// 5. failsafe: current bogus, previous valid â†’ resolve shows previous
{
  const state = {
    slots: [
      {
        slotIndex: 0,
        destinationId: 'bogus-missing',
        previousDestinationId: 'crete',
      },
      {
        slotIndex: 1,
        destinationId: 'sicily',
        previousDestinationId: 'sicily',
      },
      {
        slotIndex: 2,
        destinationId: 'albania',
        previousDestinationId: 'albania',
      },
      {
        slotIndex: 3,
        destinationId: 'sardinia',
        previousDestinationId: 'sardinia',
      },
      { slotIndex: 4, destinationId: null, previousDestinationId: null },
    ],
  };
  const resolved = resolveHomepageDiscoverSlots(state);
  assert.equal(resolved[0].destinationId, 'crete');
  assert.equal(resolved.length, 4);
  ok('5 failsafe bogus current â†’ previous destination');
}

// 6. reject replacing all 4 filled slots in one batch
{
  // Reset tmp file to a fresh 4-filled state for a clean reject check
  const filled = {
    slots: [
      {
        slotIndex: 0,
        destinationId: 'albania',
        previousDestinationId: 'albania',
      },
      {
        slotIndex: 1,
        destinationId: 'sicily',
        previousDestinationId: 'sicily',
      },
      {
        slotIndex: 2,
        destinationId: 'crete',
        previousDestinationId: 'crete',
      },
      {
        slotIndex: 3,
        destinationId: 'sardinia',
        previousDestinationId: 'sardinia',
      },
      { slotIndex: 4, destinationId: null, previousDestinationId: null },
    ],
  };
  saveHomepageDiscoverSlotState(filled, { filePath: tmpStateFile });
  const result = updateHomepageDiscoverSlots(
    [
      { slotIndex: 0, destinationId: 'sicily' },
      { slotIndex: 1, destinationId: 'albania' },
      { slotIndex: 2, destinationId: 'sardinia' },
      { slotIndex: 3, destinationId: 'crete' },
    ],
    { filePath: tmpStateFile },
  );
  assert.equal(result.ok, false);
  assert.match(result.reason, /Phased rotation rule/i);
  // file unchanged
  const still = loadHomepageDiscoverSlotState({ filePath: tmpStateFile });
  assert.equal(still.slots[0].destinationId, 'albania');
  ok('6 reject replacing all 4 filled slots in one batch');
}

// 7. reject destinationId not in pool
{
  const result = updateHomepageDiscoverSlots(
    [{ slotIndex: 0, destinationId: 'not-in-pool-xyz' }],
    { filePath: tmpStateFile },
  );
  assert.equal(result.ok, false);
  assert.match(result.reason, /destinationId not in Discover pool/i);
  assert.match(result.reason, /not-in-pool-xyz/);
  ok('7 reject destinationId not in pool');
}

// 8. UTF-8 names intact
{
  const result = getHomepageDiscoverDestinations({
    limit: 5,
    state: DEFAULT_HOMEPAGE_DISCOVER_SLOT_STATE,
  });
  assert.deepEqual(
    result.map((d) => d.name),
    ['Albanië', 'Sicilië', 'Kreta', 'Sardinië'],
  );
  ok('8 UTF-8 names Albanië/Sicilië/Kreta/Sardinië');
}

// 9. ghost: both current+previous invalid â†’ slot skipped
{
  const state = {
    slots: [
      {
        slotIndex: 0,
        destinationId: 'ghost-a',
        previousDestinationId: 'ghost-b',
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
  ok('9 ghost both invalid â†’ slot skipped');
}

// Extra: missing file â†’ default clone (no auto-write)
{
  const missing = join(tmpDataDir, 'does-not-exist.json');
  const loaded = loadHomepageDiscoverSlotState({ filePath: missing });
  assert.equal(loaded.slots.length, 5);
  assert.equal(loaded.slots[0].destinationId, 'albania');
  assert.ok(!existsSync(missing));
  // mutate clone must not touch DEFAULT
  loaded.slots[0].destinationId = 'mutated';
  assert.equal(
    DEFAULT_HOMEPAGE_DISCOVER_SLOT_STATE.slots[0].destinationId,
    'albania',
  );
  assert.equal(
    DEFAULT_HOMEPAGE_DISCOVER_SLOT_STATE_RELATIVE_PATH,
    'data/discover/homepage-discover-slots.json',
  );
  assert.ok(
    resolveHomepageDiscoverSlotStatePath(root).endsWith(
      join('data', 'discover', 'homepage-discover-slots.json'),
    ),
  );
  ok('10 missing file â†’ default clone, no auto-write');
}

console.log(`PASS Build 03 discover tests (${passed} checks)`);



