import { TRADETRACKER_SOURCE, type CampaignNewsType } from './constants';
import type {
  PromotionalSourceKind,
  TradeTrackerAffiliateSiteRecord,
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

export function isMalformedSoapEnvelope(payload: unknown): boolean {
  if (payload == null) {
    return true;
  }
  if (typeof payload !== 'object') {
    return true;
  }
  return false;
}
