import { TRADETRACKER_AFFILIATE_WSDL_URL, TRADETRACKER_SOURCE } from './constants';
import { getOptionalAffiliateSiteIdOverride, getTradeTrackerSoapCredentials } from './credentials';
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
  const port = options.port ?? (await createLiveAffiliateSoapPort(options.wsdlUrl));
  const methodErrors: MethodIngestError[] = [];

  try {
    await port.authenticate(credentials);
  } catch (error) {
    throw error instanceof TradeTrackerSoapError
      ? error
      : new TradeTrackerSoapError('authenticate', error, [credentials.passphrase]);
  }

  let affiliateSites: TradeTrackerAffiliateSiteRecord[] = [];
  const sitesPayload = await port.getAffiliateSites();
  if (isMalformedSoapEnvelope(sitesPayload)) {
    throw new TradeTrackerSoapError('getAffiliateSites', 'Malformed response');
  }
  affiliateSites = extractAffiliateSites(sitesPayload)
    .map((item) => normalizeAffiliateSite(item))
    .filter((item): item is TradeTrackerAffiliateSiteRecord => item != null);

  const siteOverride = getOptionalAffiliateSiteIdOverride();
  if (siteOverride) {
    const match = affiliateSites.filter((site) => site.siteId === siteOverride);
    if (match.length === 0) {
      throw new TradeTrackerSoapError(
        'getAffiliateSites',
        `TRADETRACKER_AFFILIATE_SITE_ID did not match a returned site`,
      );
    }
    affiliateSites = match;
  }

  const campaigns: TradeTrackerCampaignRecord[] = [];
  for (const site of affiliateSites) {
    await captureMethodError(`getCampaigns:${site.siteId}`, methodErrors, async () => {
      const payload = await port.getCampaigns(siteIdNumber(site.siteId));
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
  }

  const newsItems: TradeTrackerCampaignNewsRecord[] = [];
  await captureMethodError('getCampaignNewsItems', methodErrors, async () => {
    const payload = await port.getCampaignNewsItems();
    if (isMalformedSoapEnvelope(payload)) {
      throw new TradeTrackerSoapError('getCampaignNewsItems', 'Malformed response');
    }
    for (const item of extractNewsItems(payload)) {
      const news = normalizeCampaignNewsItem(item, asOfMs);
      if (news) {
        newsItems.push(news);
      }
    }
  });

  const incentiveOffers: TradeTrackerIncentiveRecord[] = [];
  const vouchers: TradeTrackerIncentiveRecord[] = [];
  for (const site of affiliateSites) {
    const siteId = siteIdNumber(site.siteId);
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
  }

  return {
    source: TRADETRACKER_SOURCE,
    ingestedAt: new Date(asOfMs).toISOString(),
    wsdlUrl: options.wsdlUrl ?? TRADETRACKER_AFFILIATE_WSDL_URL,
    affiliateSites,
    campaigns,
    newsItems,
    incentiveOffers,
    vouchers,
    methodErrors,
  };
}

export function snapshotCounts(snapshot: TradeTrackerPromotionSnapshot): Record<string, number> {
  return {
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
