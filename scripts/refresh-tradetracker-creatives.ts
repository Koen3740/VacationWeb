/**
 * One TradeTracker creative refresh.
 *
 * This is the single entrypoint for the existing creative pipeline.
 * The repository has no separate nightly scheduler; do not add a second one.
 * Product feeds, offers.json, catalog generations, current.json and live-price
 * are not part of this run.
 *
 *   npm run refresh:tradetracker-creatives
 *
 * Order:
 * 1. SOAP creative ingest for canonical NL 512226 and BE 511873
 * 2. Selection into the isolated selected snapshots
 * 3. Server-side image ingest for creatives with a concrete benefit
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';

function runCompiledScript(scriptFile: string, label: string): void {
  const scriptPath = path.join(process.cwd(), 'dist', 'import', 'scripts', scriptFile);
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
  console.log('TradeTracker creatives: ingest → select → store own images');
  runCompiledScript('ingest-tradetracker-creatives.js', 'Ingest creatives');
  runCompiledScript('select-tradetracker-creatives.js', 'Select creatives');
  runCompiledScript('ingest-tradetracker-creative-images.js', 'Ingest creative images');
  console.log('\n✔ TradeTracker creative refresh completed');
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\n✖ TradeTracker creative refresh aborted: ${message}`);
  process.exitCode = 1;
}
