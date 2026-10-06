/**
 * One TradeTracker creative refresh.
 *
 *   npm run refresh:tradetracker-creatives
 *
 * Calls refreshTradeTrackerCreatives, the same function as the daily cron:
 * ingestTradeTrackerCreatives → selectTradeTrackerCreatives → ingestDisplayableCreativeImages.
 * Snapshots and the image manifest are published after that chain succeeds.
 * Product feeds, offers.json, catalog generations, current.json and live-price
 * are not part of this run.
 */
import { refreshTradeTrackerCreatives } from '../lib/tradetracker/promotions/refresh-creatives';

async function main(): Promise<void> {
  const summary = await refreshTradeTrackerCreatives({
    root: process.cwd(),
    requireRemote: false,
    includeSecondary: process.argv.includes('--include-secondary'),
  });
  console.log(JSON.stringify(summary));
  if (!summary.ok) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'refresh failed';
  console.error(message);
  process.exitCode = 1;
});
