import { TRADETRACKER_SOURCE, type CampaignNewsType, type TradeTrackerCredentialMarket } from './constants';
import type {
  PromotionalSourceKind,
  TradeTrackerAffiliateSiteRecord,
  TradeTrackerBannerCreativeRecord,
  TradeTrackerCampaignNewsRecord,
  TradeTrackerCampaignRecord,
  TradeTrackerIncentiveRecord,
} from './types';
import { promotionalValidity, toCalendarDate } from './validity';

export function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function unwrapList(container: unknown, key: string): unknown[] {
  const record = asRecord(container);
  if (!record) {
    return [];
  }
  return asArray(record[key]);
}

function textField(value: unknown): string | null {
  if (value == null || value === '') {
    return null;
  }
  if (typeof value === 'object' && value !== null && '$value' in value) {
    return textField((value as { $value: unknown }).$value);
  }
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function idField(value: unknown): string | null {
  return textField(value);
}

function newsKind(newsType: string): TradeTrackerCampaignNewsRecord['kind'] {
  if (newsType === 'campaign_start') return 'campaign_start';
  if (newsType === 'campaign_stop') return 'campaign_stop';
  if (newsType === 'campaign_update_consumer') return 'consumer_promotion';
  if (newsType.startsWith('campaign_update_')) return 'campaign_update';
  return 'campaign_news';
}

function campaignCategory(info: Record<string, unknown> | null): {
  id: string | null;
  name: string | null;
} {
  const category = asRecord(info?.category);
  return {
    id: idField(category?.ID),
    name: textField(category?.name),
  };
}

export function extractAffiliateSites(payload: unknown): unknown[] {
  const root = asRecord(payload);
  const sites = root?.affiliateSites ?? payload;
  return unwrapList(sites, 'affiliateSite');
}

export function extractCampaigns(payload: unknown): unknown[] {
  const root = asRecord(payload);
  const campaigns = root?.campaigns ?? payload;
  return unwrapList(campaigns, 'campaign');
}

export function extractNewsItems(payload: unknown): unknown[] {
  const root = asRecord(payload);
  const items = root?.campaignNewsItems ?? payload;
  return unwrapList(items, 'campaignNewsItem');
}

export function extractMaterialItems(payload: unknown): unknown[] {
  const root = asRecord(payload);
  const items = root?.materialItems ?? payload;
  return unwrapList(items, 'materialItem');
}

export function normalizeAffiliateSite(raw: unknown): TradeTrackerAffiliateSiteRecord | null {
  const record = asRecord(raw);
  const siteId = idField(record?.ID);
  const name = textField(record?.name);
  if (!record || !siteId || !name) {
    return null;
  }
  return {
    source: TRADETRACKER_SOURCE,
    siteId,
    name,
    url: textField(record.URL),
    sourceMetadata: { rawKeys: Object.keys(record) },
  };
}

export function normalizeCampaign(
  raw: unknown,
  affiliateSite: { siteId: string; name: string | null },
): TradeTrackerCampaignRecord | null {
  const record = asRecord(raw);
  const campaignId = idField(record?.ID);
  const campaignName = textField(record?.name);
  if (!record || !campaignId || !campaignName) {
    return null;
  }
  const info = asRecord(record.info);
  const category = campaignCategory(info);
  return {
    source: TRADETRACKER_SOURCE,
    kind: 'campaign',
    campaignId,
    campaignName,
    campaignUrl: textField(record.URL),
    campaignInfo: textField(info?.campaignDescription) ?? textField(info?.shopDescription),
    campaignCategoryId: category.id,
    campaignCategoryName: category.name,
    assignmentStatus: textField(info?.assignmentStatus),
    logoUrl: textField(record.logoURL),
    trackingUrl: textField(info?.trackingURL),
    campaignStartDate: toCalendarDate(info?.startDate),
    campaignStopDate: toCalendarDate(info?.stopDate),
    campaignTimeZone: textField(info?.timeZone),
    affiliateSiteId: affiliateSite.siteId,
    affiliateSiteName: affiliateSite.name,
    sourceMetadata: {
      rawKeys: Object.keys(record),
      infoKeys: info ? Object.keys(info) : [],
      deeplinkingSupported: info?.deeplinkingSupported ?? null,
    },
  };
}

export function normalizeCampaignNewsItem(
  raw: unknown,
  asOfMs: number,
): TradeTrackerCampaignNewsRecord | null {
  const record = asRecord(raw);
  const newsItemId = idField(record?.ID);
  if (!record || !newsItemId) {
    return null;
  }
  const campaign = asRecord(record.campaign);
  const newsType = (textField(record.campaignNewsType) ?? 'unknown') as CampaignNewsType;
  const publishDate = toCalendarDate(record.publishDate);
  const expirationDate = toCalendarDate(record.expirationDate);
  return {
    source: TRADETRACKER_SOURCE,
    kind: newsKind(String(newsType)),
    newsItemId,
    newsType,
    title: textField(record.title) ?? '',
    content: textField(record.content) ?? '',
    publishDate,
    expirationDate,
    campaignId: idField(campaign?.ID),
    campaignName: textField(campaign?.name),
    campaignUrl: textField(campaign?.URL),
    validity: promotionalValidity({
      startDate: publishDate,
      endDate: expirationDate,
      asOfMs,
    }),
    sourceMetadata: {
      rawKeys: Object.keys(record),
      campaignKeys: campaign ? Object.keys(campaign) : [],
    },
  };
}

export function normalizeIncentiveItem(
  raw: unknown,
  kind: Extract<PromotionalSourceKind, 'incentive_offer' | 'voucher'>,
  affiliateSite: { siteId: string; name: string | null },
  asOfMs: number,
): TradeTrackerIncentiveRecord | null {
  const record = asRecord(raw);
  const materialItemId = idField(record?.ID);
  const name = textField(record?.name);
  if (!record || !materialItemId || !name) {
    return null;
  }
  const campaign = asRecord(record.campaign);
  const validFromDate = toCalendarDate(record.validFromDate);
  const validToDate = toCalendarDate(record.validToDate);
  return {
    source: TRADETRACKER_SOURCE,
    kind,
    materialItemId,
    name,
    description: textField(record.description),
    conditions: textField(record.conditions),
    validFromDate,
    validToDate,
    discountFixed: textField(record.discountFixed),
    discountVariable: textField(record.discountVariable),
    voucherCode: textField(record.voucherCode),
    campaignId: idField(campaign?.ID),
    campaignName: textField(campaign?.name),
    campaignUrl: textField(campaign?.URL),
    affiliateSiteId: affiliateSite.siteId,
    affiliateSiteName: affiliateSite.name,
    validity: promotionalValidity({
      startDate: validFromDate,
      endDate: validToDate,
      asOfMs,
    }),
    sourceMetadata: {
      rawKeys: Object.keys(record),
      creationDate: textField(record.creationDate),
      modificationDate: textField(record.modificationDate),
      hasMaterialCode: Boolean(textField(record.code)),
    },
  };
}

export type ParsedBannerEmbed = {
  trackingClickUrlTemplate: string | null;
  impressionUrlTemplate: string | null;
  staticImageUrlHint: string | null;
  hosts: string[];
};

function unwrapSoapValue(value: unknown): unknown {
  if (typeof value === 'object' && value !== null && '$value' in value) {
    return (value as { $value: unknown }).$value;
  }
  return value;
}

function booleanField(value: unknown): boolean | null {
  const raw = unwrapSoapValue(value);
  if (typeof raw === 'boolean') {
    return raw;
  }
  if (raw == null || raw === '') {
    return null;
  }
  if (typeof raw === 'number') {
    if (raw === 1) return true;
    if (raw === 0) return false;
    return null;
  }
  const text = String(raw).trim().toLowerCase();
  if (text === 'true' || text === '1') return true;
  if (text === 'false' || text === '0') return false;
  return null;
}

function numberField(value: unknown): number | null {
  const raw = unwrapSoapValue(value);
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw;
  }
  const text = textField(raw);
  if (!text) {
    return null;
  }
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function timestampField(value: unknown): string | null {
  const raw = unwrapSoapValue(value);
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return raw.toISOString();
  }
  return textField(raw);
}

function decodeBasicEntities(value: string): string {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&apos;/gi, "'");
}

function attributeValues(html: string, name: 'href' | 'src'): string[] {
  const pattern = new RegExp(String.raw`\b${name}\s*=\s*(?:"([^"]*)"|'([^']*)')`, 'gi');
  const values: string[] = [];
  for (const match of html.matchAll(pattern)) {
    const raw = match[1] ?? match[2] ?? '';
    const decoded = decodeBasicEntities(raw).trim();
    if (decoded) {
      values.push(decoded);
    }
  }
  return values;
}

function urlParts(raw: string): URL | null {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

/** TradeTracker direct link on the advertiser's own domain: `?tt=<campaign>_<material>_<site>_<reference>`. */
export function isDirectLinkClickUrl(raw: string): boolean {
  const url = urlParts(raw);
  if (!url || (url.protocol !== 'https:' && url.protocol !== 'http:')) {
    return false;
  }
  const tt = url.searchParams.getAll('tt');
  return tt.length === 1 && /^\d+_\d+_\d+_/.test(tt[0] ?? '');
}

function isClickUrl(raw: string): boolean {
  const url = urlParts(raw);
  if (url) {
    return url.pathname === '/c' || url.pathname.endsWith('/c') || isDirectLinkClickUrl(raw);
  }
  return /\/c\?/i.test(raw);
}

function isImpressionUrl(raw: string): boolean {
  const url = urlParts(raw);
  if (url) {
    if (url.pathname === '/i' || url.pathname.endsWith('/i')) {
      return true;
    }
    return url.hostname === 'ti.tradetracker.net';
  }
  return /\/i\?/i.test(raw) || /ti\.tradetracker\.net/i.test(raw);
}

function isStaticImageUrl(raw: string): boolean {
  if (isImpressionUrl(raw) || isClickUrl(raw)) {
    return false;
  }
  const url = urlParts(raw);
  if (!url) {
    return /static\.tradetracker\.net/i.test(raw);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return false;
  }
  if (url.hostname === 'static.tradetracker.net' || url.hostname.endsWith('.static.tradetracker.net')) {
    return true;
  }
  return /\.(png|jpe?g|gif|webp|svg)$/i.test(url.pathname);
}

/**
 * Pull click, impression, and static image URL references out of SOAP html `code`.
 * Does not request those URLs.
 */
export function parseBannerEmbedCode(code: string | null): ParsedBannerEmbed {
  if (!code) {
    return {
      trackingClickUrlTemplate: null,
      impressionUrlTemplate: null,
      staticImageUrlHint: null,
      hosts: [],
    };
  }

  const hrefs = attributeValues(code, 'href');
  const srcs = attributeValues(code, 'src');
  const trackingClickUrlTemplate = hrefs.find((value) => isClickUrl(value)) ?? null;
  const impressionUrlTemplate =
    srcs.find((value) => isImpressionUrl(value)) ?? hrefs.find((value) => isImpressionUrl(value)) ?? null;
  const staticImageUrlHint = srcs.find((value) => isStaticImageUrl(value)) ?? null;

  const hosts = new Set<string>();
  for (const value of [trackingClickUrlTemplate, impressionUrlTemplate, staticImageUrlHint]) {
    const host = value ? urlParts(value)?.hostname : null;
    if (host) {
      hosts.add(host);
    }
  }

  return {
    trackingClickUrlTemplate,
    impressionUrlTemplate,
    staticImageUrlHint,
    hosts: [...hosts],
  };
}

export function normalizeBannerCreativeItem(
  raw: unknown,
  context: {
    market: TradeTrackerCredentialMarket;
    affiliateSiteId: string;
    fetchedAt: string;
    asOfMs: number;
  },
): TradeTrackerBannerCreativeRecord | null {
  const record = asRecord(raw);
  const materialItemId = idField(record?.ID);
  const name = textField(record?.name);
  if (!record || !materialItemId || !name) {
    return null;
  }

  const campaign = asRecord(record.campaign);
  const dimension = asRecord(record.materialBannerDimension);
  const validFromDate = toCalendarDate(record.validFromDate);
  const validToDate = toCalendarDate(record.validToDate);
  const embedCode = textField(record.code);
  const parsed = parseBannerEmbedCode(embedCode);

  return {
    source: TRADETRACKER_SOURCE,
    kind: 'banner_image',
    materialItemId,
    name,
    campaignId: idField(campaign?.ID),
    campaignName: textField(campaign?.name),
    campaignUrl: textField(campaign?.URL),
    affiliateSiteId: context.affiliateSiteId,
    market: context.market,
    width: numberField(dimension?.width),
    height: numberField(dimension?.height),
    dimensionId: idField(dimension?.ID),
    isMobile: booleanField(dimension?.isMobile),
    isCommon: booleanField(dimension?.isCommon),
    referenceSupported: booleanField(record.referenceSupported),
    description: textField(record.description),
    conditions: textField(record.conditions),
    validFromDate,
    validToDate,
    discountFixed: textField(record.discountFixed),
    discountVariable: textField(record.discountVariable),
    voucherCode: textField(record.voucherCode),
    creationDate: timestampField(record.creationDate),
    modificationDate: timestampField(record.modificationDate),
    status: textField(record.status),
    embedCode,
    trackingClickUrlTemplate: parsed.trackingClickUrlTemplate,
    impressionUrlTemplate: parsed.impressionUrlTemplate,
    staticImageUrlHint: parsed.staticImageUrlHint,
    validity: promotionalValidity({
      startDate: validFromDate,
      endDate: validToDate,
      asOfMs: context.asOfMs,
    }),
    fetchedAt: context.fetchedAt,
    sourceMetadata: {
      rawKeys: Object.keys(record),
      dimensionKeys: dimension ? Object.keys(dimension) : [],
      embedHosts: parsed.hosts,
    },
  };
}

export function isMalformedSoapEnvelope(payload: unknown): boolean {
  if (payload == null) {
    return true;
  }
  if (typeof payload !== 'object') {
    return true;
  }
  return false;
}
