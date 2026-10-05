import {
  TRADETRACKER_AFFILIATE_WSDL_URL,
  TRADETRACKER_CREATIVE_CAMPAIGNS_V1,
  TRADETRACKER_CREATIVE_CANONICAL_SITE,
  TRADETRACKER_CREATIVE_SECONDARY_SITE,
  TRADETRACKER_SOURCE,
  type TradeTrackerCredentialMarket,
} from './constants';
import { getTradeTrackerSoapCredentials } from './credentials';
import { TradeTrackerSoapError, publicErrorMessage } from './errors';
import {
  extractAffiliateSites,
  extractMaterialItems,
  isMalformedSoapEnvelope,
  normalizeAffiliateSite,
  normalizeBannerCreativeItem,
} from './normalize';
import type { AffiliateSoapPort } from './soap-client';
import { createLiveAffiliateSoapPort } from './soap-client';
import type {
  MethodIngestError,
  TradeTrackerAffiliateSiteRecord,
  TradeTrackerBannerCreativeRecord,
  TradeTrackerCreativeSnapshot,
  TradeTrackerSoapCredentials,
} from './types';

export type CreativeIngestTarget = {
  market: TradeTrackerCredentialMarket;
  affiliateSiteId: string;
  campaignIds: readonly string[];
};

export type IngestCreativesOptions = {
  market: TradeTrackerCredentialMarket;
  affiliateSiteId: string;
  campaignIds: readonly string[];
  port?: AffiliateSoapPort;
  credentials?: TradeTrackerSoapCredentials;
  asOfMs?: number;
  wsdlUrl?: string;
};

export function creativeSnapshotFileName(market: string, affiliateSiteId: string): string {
  return `snapshot-${market}-${affiliateSiteId}.json`;
}

/** Canonical NL 512226 / BE 511873. Secondary sites only when requested. */
export function creativeIngestTargets(includeSecondarySites = false): CreativeIngestTarget[] {
  const markets: TradeTrackerCredentialMarket[] = ['nl', 'be'];
  const targets: CreativeIngestTarget[] = [];
  for (const market of markets) {
    const sites = [TRADETRACKER_CREATIVE_CANONICAL_SITE[market]];
    if (includeSecondarySites) {
      sites.push(TRADETRACKER_CREATIVE_SECONDARY_SITE[market]);
    }
    const campaignIds = TRADETRACKER_CREATIVE_CAMPAIGNS_V1[market].map((item) => item.campaignId);
    for (const affiliateSiteId of sites) {
      targets.push({ market, affiliateSiteId, campaignIds });
    }
  }
  return targets;
}

function siteIdNumber(siteId: string): number {
  const parsed = Number(siteId);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new TradeTrackerSoapError('getMaterialBannerImageItems', `Invalid affiliateSiteID: ${siteId}`);
  }
  return parsed;
}

function countsFor(
  creatives: TradeTrackerBannerCreativeRecord[],
  campaignIds: readonly string[],
  methodErrors: MethodIngestError[],
): TradeTrackerCreativeSnapshot['counts'] {
  const byCampaignId: Record<string, number> = {};
  for (const campaignId of campaignIds) {
    byCampaignId[campaignId] = 0;
  }
  for (const creative of creatives) {
    const key = creative.campaignId ?? 'unknown';
    byCampaignId[key] = (byCampaignId[key] ?? 0) + 1;
  }
  return {
    creatives: creatives.length,
    campaignsRequested: campaignIds.length,
    methodErrors: methodErrors.length,
    byCampaignId,
  };
}

/**
 * Authenticate with the market key and fetch banner creatives for one affiliate site.
 * One call per campaign. Limit stays unset; the proven Corendon sets fit in one response.
 */
export async function ingestTradeTrackerCreatives(
  options: IngestCreativesOptions,
): Promise<TradeTrackerCreativeSnapshot> {
  const asOfMs = options.asOfMs ?? Date.now();
  const fetchedAt = new Date(asOfMs).toISOString();
  const credentials =
    options.credentials ??
    getTradeTrackerSoapCredentials({ market: options.market });
  const port = options.port ?? (await createLiveAffiliateSoapPort(options.wsdlUrl));
  const methodErrors: MethodIngestError[] = [];
  const requestedCampaignIds = options.campaignIds.map((id) => id.trim()).filter((id) => id.length > 0);
  const requested = new Set(requestedCampaignIds);

  try {
    await port.authenticate(credentials);
  } catch (error) {
    throw error instanceof TradeTrackerSoapError
      ? error
      : new TradeTrackerSoapError('authenticate', error, [credentials.passphrase]);
  }

  const sitesPayload = await port.getAffiliateSites();
  if (isMalformedSoapEnvelope(sitesPayload)) {
    throw new TradeTrackerSoapError('getAffiliateSites', 'Malformed response');
  }

  const sites = extractAffiliateSites(sitesPayload)
    .map((item) => normalizeAffiliateSite(item))
    .filter((item): item is TradeTrackerAffiliateSiteRecord => item != null);

  if (!sites.some((site) => site.siteId === options.affiliateSiteId)) {
    throw new TradeTrackerSoapError(
      'getAffiliateSites',
      `Affiliate site ${options.affiliateSiteId} is not available on the ${options.market} TradeTracker session`,
    );
  }

  const affiliateSiteID = siteIdNumber(options.affiliateSiteId);
  const creatives: TradeTrackerBannerCreativeRecord[] = [];

  for (const campaignId of requestedCampaignIds) {
    const method = `getMaterialBannerImageItems:${options.affiliateSiteId}:${campaignId}`;
    try {
      const payload = await port.getMaterialBannerImageItems(affiliateSiteID, { campaignID: campaignId });
      if (isMalformedSoapEnvelope(payload)) {
        throw new TradeTrackerSoapError('getMaterialBannerImageItems', 'Malformed response');
      }
      for (const item of extractMaterialItems(payload)) {
        const creative = normalizeBannerCreativeItem(item, {
          market: options.market,
          affiliateSiteId: options.affiliateSiteId,
          fetchedAt,
          asOfMs,
        });
        if (!creative) {
          continue;
        }
        if (creative.campaignId && !requested.has(creative.campaignId)) {
          continue;
        }
        creatives.push(creative);
      }
    } catch (error) {
      methodErrors.push({
        method,
        message: publicErrorMessage(error, 'TradeTracker Webservice error', [credentials.passphrase]),
      });
    }
  }

  return {
    source: TRADETRACKER_SOURCE,
    ingestedAt: fetchedAt,
    wsdlUrl: options.wsdlUrl ?? TRADETRACKER_AFFILIATE_WSDL_URL,
    market: options.market,
    scopedAffiliateSiteId: options.affiliateSiteId,
    credentialScope: options.market,
    imageDelivery: 'metadata-and-embed-code',
    campaignIds: requestedCampaignIds,
    creatives,
    methodErrors,
    counts: countsFor(creatives, requestedCampaignIds, methodErrors),
  };
}
