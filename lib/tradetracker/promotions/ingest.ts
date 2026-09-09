import {
  TRADETRACKER_AFFILIATE_WSDL_URL,
  TRADETRACKER_SOURCE,
  VACATIONWEB_TRADETRACKER_AFFILIATE_SITE_ID,
} from './constants';
import { getTradeTrackerSoapCredentials, resolveAffiliateSiteIdForIngest } from './credentials';
import { TradeTrackerSoapError, publicErrorMessage } from './errors';
import {
  extractAffiliateSites,
  extractCampaigns,
  extractMaterialItems,
  extractNewsItems,
  isMalformedSoapEnvelope,
  normalizeAffiliateSite,
  normalizeCampaign,
  normalizeCampaignNewsItem,
  normalizeIncentiveItem,
} from './normalize';
import type { AffiliateSoapPort } from './soap-client';
import { createLiveAffiliateSoapPort } from './soap-client';
import type {
  MethodIngestError,
  TradeTrackerAffiliateSiteRecord,
  TradeTrackerCampaignNewsRecord,
  TradeTrackerCampaignRecord,
  TradeTrackerIncentiveRecord,
  TradeTrackerPromotionSnapshot,
  TradeTrackerSoapCredentials,
} from './types';

export type IngestPromotionsOptions = {
  port?: AffiliateSoapPort;
  credentials?: TradeTrackerSoapCredentials;
  asOfMs?: number;
  wsdlUrl?: string;
  /** Defaults to VacationWeb affiliate site 512226. */
  affiliateSiteId?: string;
};

async function captureMethodError(
  method: string,
  errors: MethodIngestError[],
  invoke: () => Promise<void>,
): Promise<void> {
  try {
    await invoke();
  } catch (error) {
    errors.push({
      method,
      message: publicErrorMessage(error),
    });
  }
}

function siteIdNumber(siteId: string): number {
  const n = Number(siteId);
  if (!Number.isInteger(n) || n < 0) {
    throw new TradeTrackerSoapError('getCampaigns', `Invalid affiliateSiteID: ${siteId}`);
  }
  return n;
}

export async function ingestTradeTrackerPromotions(
  options: IngestPromotionsOptions = {},
): Promise<TradeTrackerPromotionSnapshot> {
  const asOfMs = options.asOfMs ?? Date.now();
  const credentials = options.credentials ?? getTradeTrackerSoapCredentials();
  const scopedAffiliateSiteId =
    options.affiliateSiteId ?? resolveAffiliateSiteIdForIngest();
  const port = options.port ?? (await createLiveAffiliateSoapPort(options.wsdlUrl));
  const methodErrors: MethodIngestError[] = [];

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

  const allSites = extractAffiliateSites(sitesPayload)
    .map((item) => normalizeAffiliateSite(item))
    .filter((item): item is TradeTrackerAffiliateSiteRecord => item != null);

  const affiliateSites = allSites.filter((site) => site.siteId === scopedAffiliateSiteId);
  if (affiliateSites.length === 0) {
    throw new TradeTrackerSoapError(
      'getAffiliateSites',
      `Affiliate site ${scopedAffiliateSiteId} was not returned by TradeTracker`,
    );
  }

  const site = affiliateSites[0]!;
  const siteId = siteIdNumber(site.siteId);

  const campaigns: TradeTrackerCampaignRecord[] = [];
  await captureMethodError(`getCampaigns:${site.siteId}`, methodErrors, async () => {
    const payload = await port.getCampaigns(siteId);
    if (isMalformedSoapEnvelope(payload)) {
      throw new TradeTrackerSoapError('getCampaigns', 'Malformed response');
    }
    for (const item of extractCampaigns(payload)) {
      const campaign = normalizeCampaign(item, site);
      if (campaign) {
        campaigns.push(campaign);
      }
    }
  });

  const vacationWebCampaignIds = new Set(campaigns.map((campaign) => campaign.campaignId));

  const newsItems: TradeTrackerCampaignNewsRecord[] = [];
  await captureMethodError('getCampaignNewsItems', methodErrors, async () => {
    const payload = await port.getCampaignNewsItems();
    if (isMalformedSoapEnvelope(payload)) {
      throw new TradeTrackerSoapError('getCampaignNewsItems', 'Malformed response');
    }
    for (const item of extractNewsItems(payload)) {
      const news = normalizeCampaignNewsItem(item, asOfMs);
      if (!news) {
        continue;
      }
      // Account-wide news feed: keep only items tied to campaigns on this affiliate site.
      if (!news.campaignId || !vacationWebCampaignIds.has(news.campaignId)) {
        continue;
      }
      newsItems.push(news);
    }
  });

  const incentiveOffers: TradeTrackerIncentiveRecord[] = [];
  const vouchers: TradeTrackerIncentiveRecord[] = [];

  await captureMethodError(`getMaterialIncentiveOfferItems:${site.siteId}`, methodErrors, async () => {
    const payload = await port.getMaterialIncentiveOfferItems(siteId);
    if (isMalformedSoapEnvelope(payload)) {
      throw new TradeTrackerSoapError('getMaterialIncentiveOfferItems', 'Malformed response');
    }
    for (const item of extractMaterialItems(payload)) {
      const offer = normalizeIncentiveItem(item, 'incentive_offer', site, asOfMs);
      if (offer) {
        incentiveOffers.push(offer);
      }
    }
  });

  await captureMethodError(`getMaterialIncentiveVoucherItems:${site.siteId}`, methodErrors, async () => {
    const payload = await port.getMaterialIncentiveVoucherItems(siteId);
    if (isMalformedSoapEnvelope(payload)) {
      throw new TradeTrackerSoapError('getMaterialIncentiveVoucherItems', 'Malformed response');
    }
    for (const item of extractMaterialItems(payload)) {
      const voucher = normalizeIncentiveItem(item, 'voucher', site, asOfMs);
      if (voucher) {
        vouchers.push(voucher);
      }
    }
  });

  return {
    source: TRADETRACKER_SOURCE,
    ingestedAt: new Date(asOfMs).toISOString(),
    wsdlUrl: options.wsdlUrl ?? TRADETRACKER_AFFILIATE_WSDL_URL,
    scopedAffiliateSiteId,
    affiliateSites,
    campaigns,
    newsItems,
    incentiveOffers,
    vouchers,
    methodErrors,
  };
}

export function snapshotCounts(snapshot: TradeTrackerPromotionSnapshot): Record<string, number | string> {
  return {
    scopedAffiliateSiteId: snapshot.scopedAffiliateSiteId,
    vacationWebDefaultSiteId: VACATIONWEB_TRADETRACKER_AFFILIATE_SITE_ID,
    affiliateSites: snapshot.affiliateSites.length,
    campaigns: snapshot.campaigns.length,
    newsItems: snapshot.newsItems.length,
    incentiveOffers: snapshot.incentiveOffers.length,
    vouchers: snapshot.vouchers.length,
    methodErrors: snapshot.methodErrors.length,
    activeNewsItems: snapshot.newsItems.filter((item) => item.validity.isActive).length,
    activeIncentiveOffers: snapshot.incentiveOffers.filter((item) => item.validity.isActive).length,
    activeVouchers: snapshot.vouchers.filter((item) => item.validity.isActive).length,
  };
}
