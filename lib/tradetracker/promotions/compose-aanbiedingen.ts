import {
  creativeImageMaterialKey,
  isOwnCreativeImageUrl,
  type CreativeImageLink,
} from './creative-image-path';
import { TRADETRACKER_CREATIVE_CANONICAL_SITE } from './constants';
import { evaluateOfferBenefit } from './displayable-offer';
import { promotionClickHref } from './promotion-click';
import type { DisplayablePromotion, VacationWebPromotionMarket } from './select-displayable';
import {
  CREATIVE_ALLOWED_PROVIDERS,
  type CreativeAllowedProvider,
  type SelectedTradeTrackerCreative,
} from './types';

/**
 * `/aanbiedingen` card order:
 * 1. Primary — selected creatives that are concrete offers (`isDisplayableOffer`).
 * 2. Secondary — news, incentive, and voucher rows that pass the same rule.
 * General ads are omitted. Secondary cards never replace a primary creative.
 * The affiliate click is the stored `/c` template, validated and placed only on
 * `clickUrl`. Image src is VacationWeb storage only. Nothing here performs HTTP.
 */

export type AanbiedingenCardSource = 'creative' | 'promotion';

export type AanbiedingenCard = {
  id: string;
  source: AanbiedingenCardSource;
  market: VacationWebPromotionMarket;
  providerName: CreativeAllowedProvider;
  title: string;
  summary: string | null;
  /** Source benefit spelling or raw discount/voucher text. Never an invented amount. */
  benefitText: string | null;
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
  /**
   * Stored affiliate click template for a real user click.
   * Null when the template is missing or does not match this creative.
   */
  clickUrl: string | null;
  /** Own stored banner. Null until ingest has written a safe public path. */
  imageUrl: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  imagePolicy: 'own-storage' | null;
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

function scrubTrackingUrls(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const scrubbed = value
    .replace(/https?:\/\/ti\.tradetracker\.net\S*/gi, '')
    .replace(/https?:\/\/\S*\/i\?\S*/gi, '')
    .replace(/https?:\/\/\S*\/c\?\S*/gi, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
  return scrubbed || null;
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
  return parts.length > 0 ? scrubTrackingUrls(parts.join(' · ')) : null;
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

function ownImage(link: CreativeImageLink | undefined): Pick<AanbiedingenCard, 'imageUrl' | 'imageWidth' | 'imageHeight' | 'imagePolicy'> {
  if (!link || !isOwnCreativeImageUrl(link.publicPath)) {
    return { imageUrl: null, imageWidth: null, imageHeight: null, imagePolicy: null };
  }
  return {
    imageUrl: link.publicPath,
    imageWidth: link.width,
    imageHeight: link.height,
    imagePolicy: 'own-storage',
  };
}

function creativeCard(
  creative: SelectedTradeTrackerCreative,
  images: ReadonlyMap<string, CreativeImageLink> | undefined,
): AanbiedingenCard | null {
  if (!isAllowedProvider(creative.provider) || isTuiText(creative.provider) || isTuiText(creative.campaignName) || isTuiText(creative.title)) {
    return null;
  }
  if (creative.affiliateSiteId !== TRADETRACKER_CREATIVE_CANONICAL_SITE[creative.market]) {
    return null;
  }
  const decision = evaluateOfferBenefit(creative);
  if (decision.outcome !== 'displayable' || !decision.benefitText) {
    return null;
  }
  const benefitText = scrubTrackingUrls(decision.benefitText);
  if (!benefitText) {
    return null;
  }
  return {
    id: creative.dedupeKey,
    source: 'creative',
    market: creative.market,
    providerName: creative.provider,
    title: scrubTrackingUrls(creative.title) ?? creative.title,
    summary: scrubTrackingUrls(creative.description),
    benefitText,
    campaignId: creative.campaignId,
    campaignName: scrubTrackingUrls(creative.campaignName),
    materialItemId: creative.materialItemId,
    affiliateSiteId: creative.affiliateSiteId,
    dimensionsLabel: dimensionsLabel(creative),
    isMobile: creative.isMobile,
    isCommon: creative.isCommon,
    discountText: discountText(creative),
    conditions: scrubTrackingUrls(creative.conditions),
    publishDate: creative.validFromDate,
    expirationDate: creative.validToDate,
    campaignUrl: safeCampaignUrl(creative.campaignUrl),
    clickUrl: promotionClickHref(creative),
    ...ownImage(images?.get(creativeImageMaterialKey(creative.market, creative.affiliateSiteId, creative.materialItemId))),
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
  const decision = evaluateOfferBenefit({
    title: promotion.title,
    description: promotion.sourceText ?? promotion.summary,
    summary: promotion.summary,
    conditions: promotion.conditions,
    discountFixed: promotion.discountFixed,
    discountVariable: promotion.discountVariable,
    voucherCode: promotion.voucherCode,
  });
  if (decision.outcome !== 'displayable' || !decision.benefitText) {
    return null;
  }
  const benefitText = scrubTrackingUrls(decision.benefitText);
  if (!benefitText) {
    return null;
  }
  return {
    id: `promotion:${promotion.id}`,
    source: 'promotion',
    market,
    providerName: promotion.providerName,
    title: scrubTrackingUrls(promotion.title) ?? promotion.title,
    summary: scrubTrackingUrls(promotion.summary),
    benefitText,
    campaignId: null,
    campaignName: null,
    materialItemId: materialIdFromPromotion(promotion),
    affiliateSiteId: null,
    dimensionsLabel: null,
    isMobile: null,
    isCommon: null,
    discountText: scrubTrackingUrls(
      [promotion.discountFixed, promotion.discountVariable, promotion.voucherCode].filter(Boolean).join(' · ') || null,
    ),
    conditions: scrubTrackingUrls(promotion.conditions),
    publishDate: promotion.publishDate,
    expirationDate: promotion.expirationDate,
    campaignUrl: safeCampaignUrl(promotion.campaignUrl),
    clickUrl: null,
    imageUrl: null,
    imageWidth: null,
    imageHeight: null,
    imagePolicy: null,
  };
}

function compareCreatives(a: SelectedTradeTrackerCreative, b: SelectedTradeTrackerCreative): number {
  const campaign = a.campaignId.localeCompare(b.campaignId);
  if (campaign !== 0) return campaign;
  const material = Number(a.materialItemId) - Number(b.materialItemId);
  if (material !== 0) return material;
  return a.title.localeCompare(b.title, 'nl');
}

function comparePromotions(a: DisplayablePromotion, b: DisplayablePromotion): number {
  const provider = a.providerName.localeCompare(b.providerName, 'nl');
  if (provider !== 0) return provider;
  const title = a.title.localeCompare(b.title, 'nl');
  if (title !== 0) return title;
  return a.id.localeCompare(b.id);
}

export function composeAanbiedingenCards(args: {
  market: VacationWebPromotionMarket;
  creatives: readonly SelectedTradeTrackerCreative[];
  secondary: readonly DisplayablePromotion[];
  images?: ReadonlyMap<string, CreativeImageLink>;
}): AanbiedingenCard[] {
  const cards: AanbiedingenCard[] = [];
  const primaryMaterialIds = new Set<string>();
  const creatives = args.creatives.filter((creative) => creative.market === args.market).sort(compareCreatives);

  for (const creative of creatives) {
    const card = creativeCard(creative, args.images);
    if (!card) {
      continue;
    }
    cards.push(card);
    if (card.materialItemId) {
      primaryMaterialIds.add(card.materialItemId);
    }
  }

  const seenSecondaryMaterials = new Set<string>();
  const secondary = [...args.secondary].sort(comparePromotions);
  for (const promotion of secondary) {
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
