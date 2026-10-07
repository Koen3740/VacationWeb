import {
  TRADETRACKER_AFFILIATE_WSDL_URL,
  TRADETRACKER_CREATIVE_CANONICAL_SITE,
  TRADETRACKER_CREATIVE_SECONDARY_SITE,
  TRADETRACKER_SOURCE,
  type TradeTrackerCredentialMarket,
} from './constants';
import { getTradeTrackerSoapCredentials } from './credentials';
import { TradeTrackerSoapError, publicErrorMessage } from './errors';
import {
  extractAffiliateSites,
  extractCampaigns,
  extractMaterialItems,
  isMalformedSoapEnvelope,
  normalizeAffiliateSite,
  normalizeBannerCreativeItem,
  normalizeCampaign,
} from './normalize';
import { mapCreativeProvider } from './select-creatives';
import type { AffiliateSoapPort } from './soap-client';
import { createLiveAffiliateSoapPort } from './soap-client';
import type {
  MethodIngestError,
  TradeTrackerAccessibleCampaign,
  TradeTrackerAffiliateSiteRecord,
  TradeTrackerBannerCreativeRecord,
  TradeTrackerCreativeSnapshot,
  TradeTrackerSoapCredentials,
} from './types';

/**
 * One market source: the market's own access key and its own site.
 * Campaigns are not listed here. Each run asks TradeTracker which campaigns
 * this site is accepted for (getCampaigns, assignmentStatus=accepted).
 */
export type CreativeIngestTarget = {
  market: TradeTrackerCredentialMarket;
  affiliateSiteId: string;
  /** Optional narrowing for research and tests. Never widens the accepted set. */
  campaignIds?: readonly string[];
};

export type IngestCreativesOptions = {
  market: TradeTrackerCredentialMarket;
  affiliateSiteId: string;
  /** Optional narrowing. Only campaigns accepted for this market and site are fetched. */
  campaignIds?: readonly string[];
  port?: AffiliateSoapPort;
  credentials?: TradeTrackerSoapCredentials;
  asOfMs?: number;
  wsdlUrl?: string;
};

export function creativeSnapshotFileName(market: string, affiliateSiteId: string): string {
  return `snapshot-${market}-${affiliateSiteId}.json`;
}

/**
 * Canonical NL 512226 / BE 511873. Secondary sites only when requested.
 * Each target is collected with its own market key. NL is never derived from BE
 * and BE is never derived from NL.
 */
export function creativeIngestTargets(includeSecondarySites = false): CreativeIngestTarget[] {
  const markets: TradeTrackerCredentialMarket[] = ['nl', 'be'];
  const targets: CreativeIngestTarget[] = [];
  for (const market of markets) {
    const sites = [TRADETRACKER_CREATIVE_CANONICAL_SITE[market]];
    if (includeSecondarySites) {
      sites.push(TRADETRACKER_CREATIVE_SECONDARY_SITE[market]);
    }
    for (const affiliateSiteId of sites) {
      targets.push({ market, affiliateSiteId });
    }
  }
  return targets;
}

function numericFirst(a: string, b: string): number {
  const left = Number(a);
  const right = Number(b);
  if (Number.isInteger(left) && Number.isInteger(right) && left !== right) {
    return left - right;
  }
  return a.localeCompare(b);
}

/**
 * Campaigns this market's key may promote on this site.
 * A row with an explicit non-accepted status is dropped even though the filter asked for accepted.
 */
export function acceptedCampaignsFromPayload(
  payload: unknown,
  site: { siteId: string; name: string | null },
): TradeTrackerAccessibleCampaign[] {
  const byId = new Map<string, TradeTrackerAccessibleCampaign>();
  for (const item of extractCampaigns(payload)) {
    const campaign = normalizeCampaign(item, site);
    if (!campaign) {
      continue;
    }
    const status = campaign.assignmentStatus?.trim().toLowerCase() ?? 'accepted';
    if (status !== 'accepted') {
      continue;
    }
    if (byId.has(campaign.campaignId)) {
      continue;
    }
    byId.set(campaign.campaignId, {
      campaignId: campaign.campaignId,
      campaignName: campaign.campaignName,
      campaignUrl: campaign.campaignUrl,
      assignmentStatus: 'accepted',
      provider: mapCreativeProvider({ campaignName: campaign.campaignName, campaignUrl: campaign.campaignUrl }),
    });
  }
  return [...byId.values()].sort((a, b) => numericFirst(a.campaignId, b.campaignId));
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
 *
 * 1. getCampaigns(site, assignmentStatus=accepted) with this market's key: the access truth.
 * 2. Banner creatives for each accepted campaign of a connected provider, one call per campaign.
 *
 * Read-only SOAP only. Limit stays unset; the proven sets fit in one response.
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
  const narrowing = options.campaignIds
    ? new Set(options.campaignIds.map((id) => id.trim()).filter((id) => id.length > 0))
    : null;

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
  const site = sites.find((item) => item.siteId === options.affiliateSiteId)!;

  // Access truth for this market and site. A failure here fails the market;
  // the refresh then keeps the previous published snapshot.
  const campaignsPayload = await port.getCampaigns(affiliateSiteID, { assignmentStatus: 'accepted' });
  if (isMalformedSoapEnvelope(campaignsPayload)) {
    throw new TradeTrackerSoapError('getCampaigns', 'Malformed response');
  }
  const acceptedCampaigns = acceptedCampaignsFromPayload(campaignsPayload, {
    siteId: site.siteId,
    name: site.name,
  });
  const requestedCampaignIds = acceptedCampaigns
    .filter((campaign) => campaign.provider !== 'unknown')
    .filter((campaign) => !narrowing || narrowing.has(campaign.campaignId))
    .map((campaign) => campaign.campaignId);
  const requested = new Set(requestedCampaignIds);
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
    acceptedCampaigns,
    creatives,
    methodErrors,
    counts: countsFor(creatives, requestedCampaignIds, methodErrors),
  };
}
