/**
 * TD-015 — Safe feed re-import + R2 refresh.
 *
 * Pipeline (existing architecture only):
 *   enabled XML feeds → import-all-feeds → data/offers.json → upload-offers → R2
 *
 * Safety:
 * - Import aborts without overwriting local offers.json if any enabled feed fails or yield is empty.
 * - Upload refuses empty/invalid local datasets and verifies remote count after put.
 * - Upload is only attempted after a successful import exit code.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';

function runNodeScript(compiledRelativePath: string, label: string): void {
  const scriptPath = path.join(process.cwd(), 'dist', 'import', compiledRelativePath);
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: process.env,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status ?? 'unknown'}`);
  }
}

function main(): void {
  console.log('TD-015 refresh: import feeds → validate local dataset → upload to Object Storage (R2)');

  runNodeScript(path.join('scripts', 'import-all-feeds.js'), 'Import feeds');
  runNodeScript(path.join('scripts', 'upload-offers.js'), 'Upload offers to Object Storage');

  console.log('\n✔ TD-015 refresh completed — runtime SSOT (R2) updated from current feed files');
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\n✖ TD-015 refresh aborted: ${message}`);
  console.error('Previous R2 dataset was not replaced by an empty/partial local import.');
  process.exitCode = 1;
}
