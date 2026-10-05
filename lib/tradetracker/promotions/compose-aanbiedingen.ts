import { TRADETRACKER_CREATIVE_CANONICAL_SITE } from './constants';
import type { DisplayablePromotion, VacationWebPromotionMarket } from './select-displayable';
import {
  CREATIVE_ALLOWED_PROVIDERS,
  type CreativeAllowedProvider,
  type SelectedTradeTrackerCreative,
} from './types';

/**
 * `/aanbiedingen` card order:
 * 1. Primary — selected TradeTracker banner creatives for this market.
 * 2. Secondary — existing news, incentive, and voucher promotions.
 * Secondary cards never replace a primary creative. A secondary card with the
 * same material id as a primary creative is dropped.
 * Tracking templates stay off the card. Nothing here performs HTTP.
 */

export type AanbiedingenCardSource = 'creative' | 'promotion';

export type AanbiedingenCard = {
  id: string;
  source: AanbiedingenCardSource;
  market: VacationWebPromotionMarket;
  providerName: CreativeAllowedProvider;
  title: string;
  summary: string | null;
  campaignId: string | null;
  campaignName: string | null;
  materialItemId: string | null;
  affiliateSiteId: string | null;
  dimensionsLabel: string | null;
  isMobile: boolean | null;
  isCommon: boolean | null;
  /** Raw TradeTracker discount/voucher text. Null when the source omitted it. */
  discountText: string | null;
  conditions: string | null;
  publishDate: string | null;
  expirationDate: string | null;
  /** Merchant campaign URL only. Never a `/c` or `/i` tracking URL. */
  campaignUrl: string | null;
  /** Creatives have no safe image in this slice. Slice 4 owns image delivery. */
  imagePolicy: 'metadata-only' | null;
};

const ALLOWED = new Set<string>(CREATIVE_ALLOWED_PROVIDERS);

function isTuiText(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }
  return /\btui\b/i.test(value);
}

function isAllowedProvider(value: string): value is CreativeAllowedProvider {
  return ALLOWED.has(value);
}

/** Public merchant links only. Affiliate click and impression URLs are refused. */
export function safeCampaignUrl(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return null;
  }
  const pathName = url.pathname;
  if (pathName === '/c' || pathName.endsWith('/c') || pathName === '/i' || pathName.endsWith('/i')) {
    return null;
  }
  if (url.hostname === 'ti.tradetracker.net') {
    return null;
  }
  return url.toString();
}

function discountText(creative: SelectedTradeTrackerCreative): string | null {
  const parts: string[] = [];
  if (creative.discountFixed) {
    parts.push(creative.discountFixed);
  }
  if (creative.discountVariable) {
    parts.push(creative.discountVariable);
  }
  if (creative.voucherCode) {
    parts.push(creative.voucherCode);
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}

function dimensionsLabel(creative: SelectedTradeTrackerCreative): string | null {
  if (!creative.width || !creative.height) {
    return null;
  }
  const flags: string[] = [`${creative.width}×${creative.height}`];
  if (creative.isMobile) {
    flags.push('mobiel');
  }
  if (creative.isCommon) {
    flags.push('gangbaar');
  }
  return flags.join(' · ');
}

function creativeCard(creative: SelectedTradeTrackerCreative): AanbiedingenCard | null {
  if (!isAllowedProvider(creative.provider) || isTuiText(creative.provider) || isTuiText(creative.campaignName) || isTuiText(creative.title)) {
    return null;
  }
  if (creative.affiliateSiteId !== TRADETRACKER_CREATIVE_CANONICAL_SITE[creative.market]) {
    return null;
  }
  return {
    id: creative.dedupeKey,
    source: 'creative',
    market: creative.market,
    providerName: creative.provider,
    title: creative.title,
    summary: creative.description,
    campaignId: creative.campaignId,
    campaignName: creative.campaignName,
    materialItemId: creative.materialItemId,
    affiliateSiteId: creative.affiliateSiteId,
    dimensionsLabel: dimensionsLabel(creative),
    isMobile: creative.isMobile,
    isCommon: creative.isCommon,
    discountText: discountText(creative),
    conditions: creative.conditions,
    publishDate: creative.validFromDate,
    expirationDate: creative.validToDate,
    campaignUrl: safeCampaignUrl(creative.campaignUrl),
    imagePolicy: 'metadata-only',
  };
}

function materialIdFromPromotion(promotion: DisplayablePromotion): string | null {
  const match = /^(?:incentive_offer|voucher):([^:]+)$/.exec(promotion.id);
  return match?.[1] ?? null;
}

function promotionCard(
  promotion: DisplayablePromotion,
  market: VacationWebPromotionMarket,
): AanbiedingenCard | null {
  if (promotion.market !== market) {
    return null;
  }
  if (!isAllowedProvider(promotion.providerName) || isTuiText(promotion.providerName) || isTuiText(promotion.title)) {
    return null;
  }
  return {
    id: `promotion:${promotion.id}`,
    source: 'promotion',
    market,
    providerName: promotion.providerName,
    title: promotion.title,
    summary: promotion.summary || null,
    campaignId: null,
    campaignName: null,
    materialItemId: materialIdFromPromotion(promotion),
    affiliateSiteId: null,
    dimensionsLabel: null,
    isMobile: null,
    isCommon: null,
    discountText: null,
    conditions: null,
    publishDate: promotion.publishDate,
    expirationDate: promotion.expirationDate,
    campaignUrl: safeCampaignUrl(promotion.campaignUrl),
    imagePolicy: null,
  };
}

export function composeAanbiedingenCards(args: {
  market: VacationWebPromotionMarket;
  creatives: readonly SelectedTradeTrackerCreative[];
  secondary: readonly DisplayablePromotion[];
}): AanbiedingenCard[] {
  const cards: AanbiedingenCard[] = [];
  const primaryMaterialIds = new Set<string>();

  for (const creative of args.creatives) {
    if (creative.market !== args.market) {
      continue;
    }
    const card = creativeCard(creative);
    if (!card) {
      continue;
    }
    cards.push(card);
    if (card.materialItemId) {
      primaryMaterialIds.add(card.materialItemId);
    }
  }

  const seenSecondaryMaterials = new Set<string>();
  for (const promotion of args.secondary) {
    const card = promotionCard(promotion, args.market);
    if (!card) {
      continue;
    }
    if (card.materialItemId && primaryMaterialIds.has(card.materialItemId)) {
      continue;
    }
    if (card.materialItemId) {
      if (seenSecondaryMaterials.has(card.materialItemId)) {
        continue;
      }
      seenSecondaryMaterials.add(card.materialItemId);
    }
    cards.push(card);
  }

  return cards;
}
