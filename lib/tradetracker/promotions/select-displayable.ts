import { DISPLAYABLE_CAMPAIGN_NEWS_TYPES } from './constants';
import type {
  TradeTrackerCampaignNewsRecord,
  TradeTrackerIncentiveRecord,
  TradeTrackerPromotionSnapshot,
} from './types';

export type VacationWebPromotionMarket = 'be' | 'nl';

export type DisplayablePromotionKind =
  | 'consumer_promotion'
  | 'vouchercode_update'
  | 'incentive_update'
  | 'incentive_offer'
  | 'voucher';

export type DisplayablePromotion = {
  id: string;
  kind: DisplayablePromotionKind;
  market: VacationWebPromotionMarket;
  affiliateSiteId: string;
  title: string;
  content: string;
  campaignId: string | null;
  campaignName: string | null;
  campaignUrl: string | null;
  publishDate: string | null;
  expirationDate: string | null;
  sourceNewsType: string | null;
};

const DISPLAYABLE_NEWS = new Set<string>(DISPLAYABLE_CAMPAIGN_NEWS_TYPES);

function newsKind(newsType: string): DisplayablePromotionKind | null {
  if (newsType === 'campaign_update_consumer') return 'consumer_promotion';
  if (newsType === 'campaign_update_vouchercode') return 'vouchercode_update';
  if (newsType === 'campaign_update_incentive') return 'incentive_update';
  return null;
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function fromNews(
  item: TradeTrackerCampaignNewsRecord,
  market: VacationWebPromotionMarket,
  affiliateSiteId: string,
): DisplayablePromotion | null {
  if (!item.validity.isActive) {
    return null;
  }
  if (!DISPLAYABLE_NEWS.has(item.newsType)) {
    return null;
  }
  const kind = newsKind(item.newsType);
  if (!kind) {
    return null;
  }
  const title = item.title.trim();
  const content = stripHtml(item.content);
  if (!title && !content) {
    return null;
  }
  return {
    id: `news:${item.newsItemId}`,
    kind,
    market,
    affiliateSiteId,
    title: title || 'Promotie',
    content,
    campaignId: item.campaignId,
    campaignName: item.campaignName,
    campaignUrl: item.campaignUrl,
    publishDate: item.publishDate,
    expirationDate: item.expirationDate,
    sourceNewsType: item.newsType,
  };
}

function fromIncentive(
  item: TradeTrackerIncentiveRecord,
  market: VacationWebPromotionMarket,
): DisplayablePromotion | null {
  if (!item.validity.isActive) {
    return null;
  }
  const title = item.name.trim();
  if (!title) {
    return null;
  }
  const parts = [item.description, item.conditions, item.voucherCode ? `Code: ${item.voucherCode}` : null]
    .map((part) => (part ? stripHtml(part) : ''))
    .filter(Boolean);
  return {
    id: `${item.kind}:${item.materialItemId}`,
    kind: item.kind,
    market,
    affiliateSiteId: item.affiliateSiteId,
    title,
    content: parts.join('\n\n'),
    campaignId: item.campaignId,
    campaignName: item.campaignName,
    campaignUrl: item.campaignUrl,
    publishDate: item.validFromDate,
    expirationDate: item.validToDate,
    sourceNewsType: null,
  };
}

/**
 * Select only items that are clearly promotional TradeTracker source data.
 * Does not invent deals from catalog/prices.
 */
export function selectDisplayablePromotions(
  snapshot: TradeTrackerPromotionSnapshot,
  market: VacationWebPromotionMarket,
): DisplayablePromotion[] {
  const out: DisplayablePromotion[] = [];
  const affiliateSiteId = snapshot.scopedAffiliateSiteId;

  for (const item of snapshot.newsItems) {
    const selected = fromNews(item, market, affiliateSiteId);
    if (selected) {
      out.push(selected);
    }
  }
  for (const item of snapshot.incentiveOffers) {
    const selected = fromIncentive(item, market);
    if (selected) {
      out.push(selected);
    }
  }
  for (const item of snapshot.vouchers) {
    const selected = fromIncentive(item, market);
    if (selected) {
      out.push(selected);
    }
  }

  out.sort((a, b) => {
    const aDate = a.publishDate ?? '';
    const bDate = b.publishDate ?? '';
    if (aDate !== bDate) {
      return bDate.localeCompare(aDate);
    }
    return a.title.localeCompare(b.title, 'nl');
  });

  return out;
}
