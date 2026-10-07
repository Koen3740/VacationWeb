/**
 * t364u (SUB25-A): prune old catalogue generations in object storage.
 * Keeps the current generation (current.json) + the immediately previous complete generation.
 *
 * Default = DRY-RUN (lists `generations/` and reads current.json + manifests; never deletes).
 * Deleting requires the explicit flag --apply. No cron / scheduler is installed by this script.
 *
 *   npx --no-install tsx scripts/prune-generations.ts                         (dry-run, default min-age 48 h)
 *   npx --no-install tsx scripts/prune-generations.ts --min-age-hours=48      (dry-run, explicit; 48 = default)
 *   npx --no-install tsx scripts/prune-generations.ts --apply                 (really delete)
 *
 * Run it only AFTER a successful publication (pointer flipped, site verified).
 * Never touches live-price/v1/**, backups/**, current.json, offers.json, offers.detail.json.
 * Exit codes: 0 ok (dry-run or apply finished), 2 STOP/fail-closed or bad usage.
 */
import {
  DEFAULT_MIN_AGE_HOURS,
  PruneStopError,
  formatPruneReport,
  runPrune,
} from '../lib/offers/prune-generations-core';
import { createR2PruneStorageFromEnv } from '../lib/offers/prune-generations-r2';

function parseArgs(argv: string[]): { apply: boolean; minAgeHours: number } {
  let apply = false;
  let minAgeHours = DEFAULT_MIN_AGE_HOURS;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--apply') {
      apply = true;
    } else if (arg === '--min-age-hours' || arg.startsWith('--min-age-hours=')) {
      const value = arg.includes('=') ? arg.slice(arg.indexOf('=') + 1) : argv[(i += 1)];
      const parsed = Number(value);
      if (value === undefined || value.trim() === '' || !Number.isFinite(parsed) || parsed < 0) {
        throw new Error(`--min-age-hours needs a number >= 0 (got ${JSON.stringify(value)})`);
      }
      minAgeHours = parsed;
    } else {
      throw new Error(`unknown argument ${JSON.stringify(arg)} (allowed: --apply, --min-age-hours=N)`);
    }
  }
  return { apply, minAgeHours };
}

async function main(): Promise<void> {
  const { apply, minAgeHours } = parseArgs(process.argv.slice(2));
  if (minAgeHours < DEFAULT_MIN_AGE_HOURS) {
    console.warn(
      `WARNING: --min-age-hours=${minAgeHours} is below the documented default ${DEFAULT_MIN_AGE_HOURS} h; warm instances may still read an older generation.`,
    );
  }
  const storage = createR2PruneStorageFromEnv(apply);
  const report = await runPrune(storage, { apply, minAgeHours });
  console.log(formatPruneReport(report));
}

main().catch((error: unknown) => {
  if (error instanceof PruneStopError) {
    console.error(`STOP [${error.code}]: ${error.message}`);
  } else {
    console.error(`STOP: ${error instanceof Error ? error.message : String(error)}`);
  }
  process.exitCode = 2;
});