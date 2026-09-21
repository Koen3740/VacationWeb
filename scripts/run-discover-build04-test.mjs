/**
 * BUILD 04 â€” thin CLI caller tests (zero-dep).
 */
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  writeFileSync,
  existsSync,
  copyFileSync,
  readFileSync,
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
const cliScript = join(root, 'scripts', 'update-homepage-discover-slot.mjs');
const packageStateFile = join(
  root,
  'data',
  'discover',
  'homepage-discover-slots.json',
);
const out = mkdtempSync(join(tmpdir(), 'vw-discover-b04-'));
const tmpDataDir = mkdtempSync(join(tmpdir(), 'vw-discover-b04-data-'));
const tmpStateFile = join(tmpDataDir, 'homepage-discover-slots.json');

const candidates = [
  join(root, 'node_modules', 'typescript', 'bin', 'tsc'),
  join(root, '..', 'node_modules', 'typescript', 'bin', 'tsc'),
];
const tscBin = candidates.find((c) => existsSync(c));
assert.ok(tscBin, 'tsc not found');

const dmFiles = [
  'types.ts',
  'paths.ts',
  'load-destination-media-pool.ts',
  'list-final-verified-usable.ts',
  'select-discover-teaser-asset.ts',
  'ensure-verified-web-path.ts',
  'resolve-discover-image-src.ts',
  'image-dimensions.ts',
].map((f) => join(destinationMediaSrc, f));
const files = [
  ...dmFiles,
  ...[
    'types.ts',
    'homepage-discover-destinations.ts',
    'discover-destination-href.ts',
    'discover-pool.ts',
    'homepage-discover-slots.ts',
    'homepage-discover-slot-state-io.ts',
    'resolve-homepage-discover-slots.ts',
    'apply-phased-slot-updates.ts',
    'update-homepage-discover-slots.ts',
    'get-homepage-discover-destinations.ts',
    'parse-update-homepage-discover-slot-cli.ts',
  ].map((f) => join(discoverSrc, f)),
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
  include: files,
};
const cfgPath = join(out, 'tsconfig.json');
writeFileSync(cfgPath, JSON.stringify(tsconfig, null, 2));
const compile = spawnSync(process.execPath, [tscBin, '-p', cfgPath], {
  cwd: root,
  encoding: 'utf8',
});
assert.equal(compile.status, 0, compile.stderr || compile.stdout || 'tsc failed');

const require = createRequire(import.meta.url);
const { parseUpdateHomepageDiscoverSlotCliArgs } = require(
  join(out, 'discover', 'parse-update-homepage-discover-slot-cli.js'),
);

function pass(name) {
  console.log(`  PASS ${name}`);
}

{
  const r = parseUpdateHomepageDiscoverSlotCliArgs([
    '--slot',
    '0',
    '--destinationId',
    'crete',
  ]);
  assert.equal(r.ok, true);
  assert.equal(r.update.slotIndex, 0);
  assert.equal(r.update.destinationId, 'crete');
  pass('1 parse --slot + --destinationId');
}

{
  const r = parseUpdateHomepageDiscoverSlotCliArgs(['--slot', '2', '--clear']);
  assert.equal(r.ok, true);
  assert.equal(r.update.slotIndex, 2);
  assert.equal(r.update.destinationId, null);
  pass('2 parse --clear â†’ destinationId null');
}

{
  const r = parseUpdateHomepageDiscoverSlotCliArgs([
    '--slot',
    '0',
    '--destinationId',
    'crete',
    '--clear',
  ]);
  assert.equal(r.ok, false);
  pass('3 parse reject destinationId+clear');
}

{
  const r = parseUpdateHomepageDiscoverSlotCliArgs([
    '--slot',
    '9',
    '--destinationId',
    'crete',
  ]);
  assert.equal(r.ok, false);
  pass('4 parse reject invalid slot');
}

assert.ok(existsSync(packageStateFile), 'package state file missing');
copyFileSync(packageStateFile, tmpStateFile);

function runCli(args) {
  return spawnSync(
    process.execPath,
    [cliScript, ...args, '--file', tmpStateFile],
    { encoding: 'utf8', cwd: root },
  );
}

{
  const before = JSON.parse(readFileSync(tmpStateFile, 'utf8'));
  assert.equal(before.slots[0].destinationId, 'albania');
  const r = runCli(['--slot', '0', '--destinationId', 'crete']);
  assert.equal(r.status, 0, r.stdout + '\n' + r.stderr);
  const body = JSON.parse(r.stdout);
  assert.equal(body.ok, true);
  assert.equal(body.state.slots[0].destinationId, 'crete');
  assert.equal(body.state.slots[0].previousDestinationId, 'albania');
  const after = JSON.parse(readFileSync(tmpStateFile, 'utf8'));
  assert.equal(after.slots[0].destinationId, 'crete');
  pass('5 CLI success update + persist');
}

{
  const r = runCli(['--slot', '1', '--destinationId', 'atlantis']);
  assert.equal(r.status, 1);
  const body = JSON.parse(r.stdout);
  assert.equal(body.ok, false);
  assert.match(body.reason, /not in Discover pool/);
  pass('6 CLI reject unknown destinationId');
}

{
  copyFileSync(packageStateFile, tmpStateFile);
  const { updateHomepageDiscoverSlots } = require(
    join(out, 'discover', 'update-homepage-discover-slots.js'),
  );
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
  assert.match(result.reason, /Phased rotation rule|all/i);
  pass('7 phased reject all filled (API used by caller)');
}

{
  copyFileSync(packageStateFile, tmpStateFile);
  const r = runCli(['--slot', '3', '--clear']);
  assert.equal(r.status, 0, r.stdout + '\n' + r.stderr);
  const body = JSON.parse(r.stdout);
  assert.equal(body.ok, true);
  assert.equal(body.state.slots[3].destinationId, null);
  const after = JSON.parse(readFileSync(tmpStateFile, 'utf8'));
  assert.equal(after.slots[3].destinationId, null);
  pass('8 CLI --clear persists null');
}

console.log('PASS Build 04 discover caller tests (8 checks)');


