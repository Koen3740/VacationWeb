/**
 * BUILD 04 — thin controlled caller for updateHomepageDiscoverSlots.
 * Usage:
 *   node scripts/update-homepage-discover-slot.mjs --slot 0 --destinationId crete
 *   node scripts/update-homepage-discover-slot.mjs --slot 1 --clear
 *   node scripts/update-homepage-discover-slot.mjs --slot 0 --destinationId crete --file <path>
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const discoverSrc = join(root, 'lib', 'discover');
const libDir = join(root, 'lib');
const destinationMediaSrc = join(libDir, 'destination-media');
const out = mkdtempSync(join(tmpdir(), 'vw-discover-b04-cli-'));

const candidates = [
  join(root, 'node_modules', 'typescript', 'bin', 'tsc'),
  join(root, '..', 'node_modules', 'typescript', 'bin', 'tsc'),
];
const tscBin = candidates.find((c) => existsSync(c));
if (!tscBin) {
  console.error(JSON.stringify({ ok: false, reason: 'typescript tsc not found' }));
  process.exit(2);
}

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
if (compile.status !== 0) {
  console.error(compile.stdout || '');
  console.error(compile.stderr || '');
  console.error(JSON.stringify({ ok: false, reason: 'tsc compile failed for discover lib' }));
  process.exit(2);
}

const require = createRequire(import.meta.url);
const { parseUpdateHomepageDiscoverSlotCliArgs } = require(
  join(out, 'discover', 'parse-update-homepage-discover-slot-cli.js'),
);
const { updateHomepageDiscoverSlots } = require(
  join(out, 'discover', 'update-homepage-discover-slots.js'),
);

const parsed = parseUpdateHomepageDiscoverSlotCliArgs(process.argv.slice(2));
if (!parsed.ok) {
  console.log(JSON.stringify({ ok: false, reason: parsed.reason }, null, 2));
  process.exit(1);
}

const result = updateHomepageDiscoverSlots([parsed.update], {
  filePath: parsed.filePath,
});
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);