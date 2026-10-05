import {
  TRADETRACKER_CREATIVE_CAMPAIGNS_V1,
  TRADETRACKER_CREATIVE_CANONICAL_SITE,
  TRADETRACKER_SOURCE,
  type TradeTrackerCredentialMarket,
} from './constants';
import type {
  CreativeAllowedProvider,
  CreativeExclusion,
  CreativeExclusionReason,
  CreativeMaterialRelation,
  CreativeProviderMapping,
  CreativeSelectionDedupe,
  SelectedTradeTrackerCreative,
  SelectedTradeTrackerCreativeSnapshot,
  TradeTrackerBannerCreativeRecord,
  TradeTrackerCreativeSnapshot,
} from './types';
import { CREATIVE_ALLOWED_PROVIDERS } from './types';
import { compareCalendarDates, utcCalendarDate } from './validity';

/**
 * Slice 2 selection on top of Slice 1 creative snapshots.
 *
 * Later /aanbiedingen work should read `selected-{market}-{site}.json`
 * from `data/tradetracker-creatives/` via a new loader next to
 * `load-for-page.ts`. News and incentive SOAP stays a separate secondary
 * source. This module does not call TradeTracker and does not request
 * click (`/c`) or impression (`/i`) URLs.
 */

const DEDUPE_KEY_LABEL = 'market|affiliateSiteId|materialItemId' as const;

const PROVIDER_RULES: readonly {
  provider: CreativeAllowedProvider;
  nameTokens: readonly string[];
  hosts: readonly string[];
}[] = [
  {
    provider: 'Corendon',
    nameTokens: ['corendon'],
    hosts: ['corendon.nl', 'corendon.be'],
  },
  {
    provider: 'Sunweb',
    nameTokens: ['sunweb'],
    hosts: ['sunweb.nl', 'sunweb.be'],
  },
  {
    provider: 'Eliza was here',
    nameTokens: ['eliza was here'],
    hosts: ['elizawashere.nl', 'elizawashere.be'],
  },
];

export function creativeDedupeKey(creative: {
  market: string;
  affiliateSiteId: string;
  materialItemId: string;
}): string {
  return `${creative.market}|${creative.affiliateSiteId}|${creative.materialItemId}`;
}

export function selectedCreativeFileName(market: string, affiliateSiteId: string): string {
  return `selected-${market}-${affiliateSiteId}.json`;
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function nameMatchesToken(campaignName: string, token: string): boolean {
  const name = normalizeToken(campaignName);
  const needle = normalizeToken(token);
  if (!name || !needle) {
    return false;
  }
  if (name === needle) {
    return true;
  }
  return [' ', '.', '-', '_'].some((separator) => name.startsWith(`${needle}${separator}`));
}

function hostnameOf(campaignUrl: string | null): string | null {
  if (!campaignUrl) {
    return null;
  }
  try {
    return new URL(campaignUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function hostMatches(hostname: string | null, hosts: readonly string[]): boolean {
  if (!hostname) {
    return false;
  }
  return hosts.some((host) => hostname === host || hostname.endsWith(`.${host}`));
}

/**
 * Map a creative from campaign name and campaign URL only.
 * Banner titles are ignored. Ambiguous or unsupported campaigns stay `unknown`.
 */
export function mapCreativeProvider(args: {
  campaignName: string | null;
  campaignUrl: string | null;
}): CreativeProviderMapping {
  const hostname = hostnameOf(args.campaignUrl);
  const matched = PROVIDER_RULES.filter((rule) => {
    const byName = rule.nameTokens.some((token) =>
      args.campaignName ? nameMatchesToken(args.campaignName, token) : false,
    );
    return byName || hostMatches(hostname, rule.hosts);
  });
  if (matched.length !== 1) {
    return 'unknown';
  }
  return matched[0]!.provider;
}

export function isCreativeDemonstrablyExpired(
  creative: Pick<TradeTrackerBannerCreativeRecord, 'validToDate' | 'validity'>,
  asOfMs: number,
): boolean {
  if (creative.validity?.status === 'expired') {
    return true;
  }
  const end = creative.validToDate ?? creative.validity?.endDate ?? null;
  if (!end) {
    return false;
  }
  return compareCalendarDates(utcCalendarDate(asOfMs), end) > 0;
}

function isKnownMarket(value: string): value is TradeTrackerCredentialMarket {
  return value === 'nl' || value === 'be';
}

function campaignOwner(campaignId: string): TradeTrackerCredentialMarket | null {
  const markets: TradeTrackerCredentialMarket[] = ['nl', 'be'];
  const owners = markets.filter((market) =>
    TRADETRACKER_CREATIVE_CAMPAIGNS_V1[market].some((campaign) => campaign.campaignId === campaignId),
  );
  return owners.length === 1 ? owners[0]! : null;
}

function httpUrl(value: string | null): URL | null {
  if (!value) {
    return null;
  }
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

function exclusionReason(
  creative: TradeTrackerBannerCreativeRecord,
  snapshotMarket: TradeTrackerCredentialMarket,
  asOfMs: number,
): CreativeExclusionReason | null {
  if (!creative.materialItemId.trim()) {
    return 'missing_material_id';
  }
  if (!isKnownMarket(creative.market)) {
    return 'unknown_market';
  }
  if (creative.market !== snapshotMarket) {
    return 'market_mismatch';
  }
  if (creative.affiliateSiteId !== TRADETRACKER_CREATIVE_CANONICAL_SITE[creative.market]) {
    return 'non_canonical_site';
  }
  if (!creative.campaignId) {
    return 'unknown_campaign';
  }
  const owner = campaignOwner(creative.campaignId);
  if (!owner) {
    return 'unknown_campaign';
  }
  if (owner !== creative.market) {
    return 'market_campaign_mismatch';
  }
  if (mapCreativeProvider(creative) === 'unknown') {
    return 'unknown_provider';
  }
  if (isCreativeDemonstrablyExpired(creative, asOfMs)) {
    return 'expired';
  }
  if (!creative.name.trim()) {
    return 'missing_title';
  }
  if (
    creative.width == null ||
    creative.height == null ||
    !Number.isFinite(creative.width) ||
    !Number.isFinite(creative.height) ||
    creative.width <= 0 ||
    creative.height <= 0
  ) {
    return 'missing_dimensions';
  }
  if (!httpUrl(creative.trackingClickUrlTemplate)) {
    return 'missing_click_template';
  }
  if (!creative.embedCode?.trim() && !creative.staticImageUrlHint?.trim()) {
    return 'missing_embed';
  }
  return null;
}

function dimensionKey(creative: TradeTrackerBannerCreativeRecord): string {
  return `${creative.dimensionId ?? ''}|${creative.width ?? ''}x${creative.height ?? ''}`;
}

function relationGroupKey(creative: TradeTrackerBannerCreativeRecord): string {
  return `${creative.market}|${creative.affiliateSiteId}|${creative.campaignId ?? ''}|${creative.name}`;
}

/**
 * Classify material rows. Same name at another size is a dimension variant.
 * Same name and size with another material id stays a separate creative.
 */
export function classifyCreativeRelations(
  creatives: readonly TradeTrackerBannerCreativeRecord[],
): Map<TradeTrackerBannerCreativeRecord, CreativeMaterialRelation> {
  const groups = new Map<string, TradeTrackerBannerCreativeRecord[]>();
  for (const creative of creatives) {
    const key = relationGroupKey(creative);
    const group = groups.get(key);
    if (group) {
      group.push(creative);
    } else {
      groups.set(key, [creative]);
    }
  }

  const relations = new Map<TradeTrackerBannerCreativeRecord, CreativeMaterialRelation>();
  for (const group of groups.values()) {
    const byDimension = new Map<string, number>();
    for (const creative of group) {
      const key = dimensionKey(creative);
      byDimension.set(key, (byDimension.get(key) ?? 0) + 1);
    }
    for (const creative of group) {
      const twins = byDimension.get(dimensionKey(creative)) ?? 0;
      if (twins > 1) {
        relations.set(creative, 'same_dimension_distinct_material');
      } else if (byDimension.size > 1) {
        relations.set(creative, 'dimension_variant');
      } else {
        relations.set(creative, 'unique');
      }
    }
  }
  return relations;
}

function timestampRank(value: string | null): number {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

function preferSurvivor(
  current: TradeTrackerBannerCreativeRecord,
  candidate: TradeTrackerBannerCreativeRecord,
): TradeTrackerBannerCreativeRecord {
  const modificationDelta =
    timestampRank(candidate.modificationDate) - timestampRank(current.modificationDate);
  if (modificationDelta !== 0) {
    return modificationDelta > 0 ? candidate : current;
  }
  const creationDelta = timestampRank(candidate.creationDate) - timestampRank(current.creationDate);
  if (creationDelta !== 0) {
    return creationDelta > 0 ? candidate : current;
  }
  return current;
}

function toSelected(
  creative: TradeTrackerBannerCreativeRecord,
  relation: CreativeMaterialRelation,
  sourceSnapshot: string,
): SelectedTradeTrackerCreative {
  const provider = mapCreativeProvider(creative);
  if (provider === 'unknown' || !CREATIVE_ALLOWED_PROVIDERS.includes(provider)) {
    throw new Error(`Refusing to select unmapped provider for material ${creative.materialItemId}`);
  }
  const click = creative.trackingClickUrlTemplate;
  if (!click) {
    throw new Error(`Refusing to select material ${creative.materialItemId} without a click template`);
  }
  return {
    id: creativeDedupeKey(creative),
    dedupeKey: creativeDedupeKey(creative),
    provider,
    market: creative.market,
    campaignId: creative.campaignId ?? '',
    campaignName: creative.campaignName ?? '',
    campaignUrl: creative.campaignUrl,
    affiliateSiteId: creative.affiliateSiteId,
    materialItemId: creative.materialItemId,
    title: creative.name,
    creativeType: 'banner_image',
    width: creative.width ?? 0,
    height: creative.height ?? 0,
    dimensionId: creative.dimensionId,
    isMobile: creative.isMobile,
    isCommon: creative.isCommon,
    relation,
    validity: creative.validity,
    validFromDate: creative.validFromDate,
    validToDate: creative.validToDate,
    discountFixed: creative.discountFixed,
    discountVariable: creative.discountVariable,
    voucherCode: creative.voucherCode,
    description: creative.description,
    conditions: creative.conditions,
    embedCode: creative.embedCode,
    staticImageUrlHint: creative.staticImageUrlHint,
    trackingClickUrlTemplate: click,
    impressionUrlTemplate: creative.impressionUrlTemplate,
    referenceSupported: creative.referenceSupported,
    source: TRADETRACKER_SOURCE,
    sourceSnapshot,
    fetchedAt: creative.fetchedAt,
    displayable: true,
  };
}

function emptyRelations(): Record<CreativeMaterialRelation, number> {
  return {
    unique: 0,
    dimension_variant: 0,
    same_dimension_distinct_material: 0,
  };
}

export function selectTradeTrackerCreatives(
  snapshot: TradeTrackerCreativeSnapshot,
  options: { sourceSnapshot?: string; asOfMs?: number } = {},
): SelectedTradeTrackerCreativeSnapshot {
  const asOfMs = options.asOfMs ?? Date.parse(snapshot.ingestedAt);
  if (Number.isNaN(asOfMs)) {
    throw new Error('Creative snapshot ingestedAt is not a valid timestamp');
  }
  if (!isKnownMarket(snapshot.market)) {
    throw new Error(`Creative snapshot market is not nl or be: ${snapshot.market}`);
  }

  const sourceSnapshot =
    options.sourceSnapshot ?? `snapshot-${snapshot.market}-${snapshot.scopedAffiliateSiteId}.json`;
  const relations = classifyCreativeRelations(snapshot.creatives);
  const groups = new Map<string, TradeTrackerBannerCreativeRecord[]>();
  for (const creative of snapshot.creatives) {
    const key = creativeDedupeKey(creative);
    const group = groups.get(key);
    if (group) {
      group.push(creative);
    } else {
      groups.set(key, [creative]);
    }
  }

  const exclusions: CreativeExclusion[] = [];
  const selected: SelectedTradeTrackerCreative[] = [];
  let collapsed = 0;

  for (const [key, group] of groups) {
    let survivor = group[0]!;
    for (const candidate of group.slice(1)) {
      survivor = preferSurvivor(survivor, candidate);
    }
    const reason = exclusionReason(survivor, snapshot.market, asOfMs);
    if (reason) {
      for (const creative of group) {
        exclusions.push({
          materialItemId: creative.materialItemId || null,
          dedupeKey: key,
          reason,
        });
      }
      continue;
    }
    selected.push(toSelected(survivor, relations.get(survivor) ?? 'unique', sourceSnapshot));
    for (const creative of group) {
      if (creative === survivor) {
        continue;
      }
      collapsed += 1;
      exclusions.push({
        materialItemId: creative.materialItemId || null,
        dedupeKey: key,
        reason: 'duplicate_material',
      });
    }
  }

  selected.sort((a, b) => {
    const aId = Number(a.materialItemId);
    const bId = Number(b.materialItemId);
    if (Number.isInteger(aId) && Number.isInteger(bId) && aId !== bId) {
      return aId - bId;
    }
    return a.materialItemId.localeCompare(b.materialItemId);
  });

  const relationCounts = emptyRelations();
  for (const creative of selected) {
    relationCounts[creative.relation] += 1;
  }
  const providers: Record<string, number> = {};
  for (const creative of selected) {
    providers[creative.provider] = (providers[creative.provider] ?? 0) + 1;
  }

  const dedupe: CreativeSelectionDedupe = {
    key: DEDUPE_KEY_LABEL,
    collapsed,
    relations: relationCounts,
  };

  return {
    source: TRADETRACKER_SOURCE,
    selectedAt: snapshot.ingestedAt,
    snapshotIngestedAt: snapshot.ingestedAt,
    wsdlUrl: snapshot.wsdlUrl,
    market: snapshot.market,
    scopedAffiliateSiteId: snapshot.scopedAffiliateSiteId,
    sourceSnapshot,
    imageDelivery: 'metadata-and-embed-code',
    inputCount: snapshot.creatives.length,
    selectedCount: selected.length,
    excludedCount: exclusions.length,
    providers,
    dedupe,
    exclusions,
    creatives: selected,
  };
}
