import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const libDir = join(root, 'lib');
const out = mkdtempSync(join(tmpdir(), 'vw-gallery-'));
const tsc = join(root, 'node_modules', 'typescript', 'bin', 'tsc');
const dm = join(libDir, 'destination-media');
const include = readdirSync(dm).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts')).map((f) => join(dm, f));
writeFileSync(
  join(out, 'tsconfig.json'),
  JSON.stringify({
    compilerOptions: {
      target: 'ES2020',
      module: 'commonjs',
      moduleResolution: 'node',
      esModuleInterop: true,
      strict: true,
      skipLibCheck: true,
      rootDir: libDir,
      outDir: out,
      types: ['node'],
      typeRoots: [join(root, 'node_modules', '@types')],
    },
    include,
  }),
);
const r = spawnSync(process.execPath, [tsc, '-p', join(out, 'tsconfig.json')], {
  cwd: root,
  encoding: 'utf8',
});
assert.equal(r.status, 0, r.stdout + r.stderr);
const require = createRequire(import.meta.url);
const { truncateToFullRows, meetsGalleryResolution, readImageDimensions } = require(
  join(out, 'destination-media', 'image-dimensions.js'),
);
assert.deepEqual(truncateToFullRows([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 3), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
assert.equal(meetsGalleryResolution({ width: 1920, height: 1440 }), true);
assert.equal(meetsGalleryResolution({ width: 1920, height: 827 }), false);
const dims = readImageDimensions(
  join(root, 'media/masters/candidates/photo/vw-pool-albania-theth-national-park-2017.jpg'),
);
assert.ok(dims && dims.width >= 1600);
console.log('PASS gallery resolution + full-rows');
