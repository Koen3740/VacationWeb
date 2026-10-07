import fs from 'node:fs';
import path from 'node:path';
import { TRADETRACKER_AFFILIATE_WSDL_URL, TRADETRACKER_SOURCE } from '../lib/tradetracker/promotions/constants';
import { assertNoSecretLeak, getTradeTrackerSoapCredentials } from '../lib/tradetracker/promotions/credentials';
import { publicErrorMessage } from '../lib/tradetracker/promotions/errors';
import {
  creativeIngestTargets,
  creativeSnapshotFileName,
  ingestTradeTrackerCreatives,
} from '../lib/tradetracker/promotions/ingest-creatives';
import type { TradeTrackerCreativeSnapshot } from '../lib/tradetracker/promotions/types';

/**
 * Dual-market TradeTracker banner creative snapshot (slice 1).
 *
 * Required in gitignored .env.local:
 *   TRADETRACKER_CUSTOMER_ID
 *   TRADETRACKER_ACCESS_KEY          NL sites 512226 (canonical) and 512055
 *   TRADETRACKER_BE_CUSTOMER_ID
 *   TRADETRACKER_BE_ACCESS_KEY       BE sites 511873 (canonical) and 511747
 *
 * Default targets: NL 512226 and BE 511873. Campaigns come from getCampaigns(assignmentStatus=accepted)
 * per market (SUB 33C); there is no fixed campaign list.
 * Optional: --include-secondary also fetches NL 512055 and BE 511747.
 *
 * Writes metadata and SOAP html `code` only. Does not request image bytes, /i, or /c.
 *
 *   npm run ingest:tradetracker-creatives
 *   npm run ingest:tradetracker-creatives -- --include-secondary
 */

const SNAPSHOT_DIR = path.join(process.cwd(), 'data', 'tradetracker-creatives');

function printSafe(label: string, value: unknown): void {
  console.log(`${label}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);
}

function assertClean(text: string, secrets: string[]): void {
  for (const secret of secrets) {
    assertNoSecretLeak(text, secret);
  }
}

async function main(): Promise<void> {
  const started = Date.now();
  const includeSecondary = process.argv.includes('--include-secondary');
  const targets = creativeIngestTargets(includeSecondary);
  const secrets: string[] = [];
  const written: Array<{
    market: string;
    affiliateSiteId: string;
    credentialScope: string;
    file: string;
    counts: TradeTrackerCreativeSnapshot['counts'];
    methodErrors: TradeTrackerCreativeSnapshot['methodErrors'];
  }> = [];
  let failed = false;

  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });

  for (const target of targets) {
    const label = `${target.market}:${target.affiliateSiteId}`;
    try {
      const credentials = getTradeTrackerSoapCredentials({ market: target.market });
      if (!secrets.includes(credentials.passphrase)) {
        secrets.push(credentials.passphrase);
      }
      const snapshot = await ingestTradeTrackerCreatives({
        market: target.market,
        affiliateSiteId: target.affiliateSiteId,
        campaignIds: target.campaignIds,
        credentials,
        wsdlUrl: TRADETRACKER_AFFILIATE_WSDL_URL,
      });
      const fileName = creativeSnapshotFileName(target.market, target.affiliateSiteId);
      const body = JSON.stringify(snapshot, null, 2);
      assertClean(body, secrets);
      const filePath = path.join(SNAPSHOT_DIR, fileName);
      fs.writeFileSync(filePath, body, 'utf8');
      written.push({
        market: snapshot.market,
        affiliateSiteId: snapshot.scopedAffiliateSiteId,
        credentialScope: snapshot.credentialScope,
        file: fileName,
        counts: snapshot.counts,
        methodErrors: snapshot.methodErrors,
      });
      printSafe(`snapshot ${label}`, {
        file: filePath,
        counts: snapshot.counts,
        methodErrors: snapshot.methodErrors.map((item) => ({
          method: item.method,
          message: item.message,
        })),
        sample: snapshot.creatives.slice(0, 3).map((item) => ({
          materialItemId: item.materialItemId,
          name: item.name,
          campaignId: item.campaignId,
          width: item.width,
          height: item.height,
          hasEmbedCode: Boolean(item.embedCode),
          hasClickTemplate: Boolean(item.trackingClickUrlTemplate),
        })),
      });
    } catch (error) {
      failed = true;
      printSafe(`snapshot ${label}`, {
        status: 'FAILURE',
        error: publicErrorMessage(error),
      });
    }
  }

  const index = {
    source: TRADETRACKER_SOURCE,
    ingestedAt: new Date().toISOString(),
    wsdlUrl: TRADETRACKER_AFFILIATE_WSDL_URL,
    imageDelivery: 'metadata-and-embed-code',
    includeSecondary,
    snapshots: written,
  };
  const indexBody = JSON.stringify(index, null, 2);
  assertClean(indexBody, secrets);
  const indexPath = path.join(SNAPSHOT_DIR, 'index.json');
  fs.writeFileSync(indexPath, indexBody, 'utf8');

  printSafe('status', failed ? 'FAILURE' : 'SUCCESS');
  printSafe('latencyMs', Date.now() - started);
  printSafe('indexPath', indexPath);
  printSafe(
    'counts',
    written.map((item) => ({
      market: item.market,
      affiliateSiteId: item.affiliateSiteId,
      creatives: item.counts.creatives,
      byCampaignId: item.counts.byCampaignId,
    })),
  );
  if (failed) {
    process.exitCode = 1;
  }
}

void main();
