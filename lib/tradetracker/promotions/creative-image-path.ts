import { TRADETRACKER_CREATIVE_CANONICAL_SITE, type TradeTrackerCredentialMarket } from './constants';

/** VacationWeb-owned prefix. Never a TradeTracker host and never catalog/offers storage. */
export const CREATIVE_IMAGE_PUBLIC_PREFIX = '/aanbiedingen/creative-images';
export const CREATIVE_IMAGE_STORAGE_PREFIX = 'tradetracker-creatives/images';
export const CREATIVE_IMAGE_LOCAL_DIR = 'data/tradetracker-creatives/images';

const FILE_NAME = /^(\d+)-(\d+)x(\d+)-([a-f0-9]{16})\.(png|jpe?g|gif|webp)$/;
const PUBLIC_PATH =
  /^\/aanbiedingen\/creative-images\/(nl|be)\/(512226|511873)\/(\d+)\/(\d+-\d+x\d+-[a-f0-9]{16}\.(?:png|jpe?g|gif|webp))$/;

export type CreativeImageParts = {
  market: TradeTrackerCredentialMarket;
  affiliateSiteId: string;
  campaignId: string;
  fileName: string;
};

export type CreativeImageLink = {
  publicPath: string;
  width: number;
  height: number;
};

export function creativeImageMaterialKey(
  market: string,
  affiliateSiteId: string,
  materialItemId: string,
): string {
  return `${market}|${affiliateSiteId}|${materialItemId}`;
}

export function isCanonicalCreativeSite(market: string, affiliateSiteId: string): market is TradeTrackerCredentialMarket {
  return (
    (market === 'nl' || market === 'be') &&
    TRADETRACKER_CREATIVE_CANONICAL_SITE[market] === affiliateSiteId
  );
}

export function creativeImageFileName(args: {
  materialItemId: string;
  width: number;
  height: number;
  contentHash: string;
  ext: string;
}): string | null {
  if (!/^\d+$/.test(args.materialItemId)) {
    return null;
  }
  if (!Number.isInteger(args.width) || !Number.isInteger(args.height) || args.width < 1 || args.height < 1) {
    return null;
  }
  if (!/^[a-f0-9]{16}$/.test(args.contentHash)) {
    return null;
  }
  if (!/^(png|jpe?g|gif|webp)$/.test(args.ext)) {
    return null;
  }
  const fileName = `${args.materialItemId}-${args.width}x${args.height}-${args.contentHash}.${args.ext}`;
  return FILE_NAME.test(fileName) ? fileName : null;
}

export function parseCreativeImagePublicPath(publicPath: string): CreativeImageParts | null {
  const match = PUBLIC_PATH.exec(publicPath);
  if (!match) {
    return null;
  }
  const market = match[1] ?? '';
  const affiliateSiteId = match[2] ?? '';
  const campaignId = match[3] ?? '';
  const fileName = match[4] ?? '';
  if (!isCanonicalCreativeSite(market, affiliateSiteId)) {
    return null;
  }
  return { market, affiliateSiteId, campaignId, fileName };
}

/** Browser image src. Own path only — never `/i`, `/c`, or a TradeTracker host. */
export function isOwnCreativeImageUrl(value: string | null | undefined): value is string {
  if (!value || value.includes('://') || value.includes('\\') || value.includes('..')) {
    return false;
  }
  if (/\/i\?|\/c\?|ti\.tradetracker\.net|referral\.corendon/i.test(value)) {
    return false;
  }
  return parseCreativeImagePublicPath(value) !== null;
}

export function creativeImageStorageKey(parts: CreativeImageParts): string {
  const key = `${CREATIVE_IMAGE_STORAGE_PREFIX}/${parts.market}/${parts.affiliateSiteId}/${parts.campaignId}/${parts.fileName}`;
  assertIsolatedCreativeImageKey(key);
  return key;
}

export function creativeImagePublicPath(parts: CreativeImageParts): string {
  const publicPath = `${CREATIVE_IMAGE_PUBLIC_PREFIX}/${parts.market}/${parts.affiliateSiteId}/${parts.campaignId}/${parts.fileName}`;
  if (!isOwnCreativeImageUrl(publicPath)) {
    throw new Error('creative image public path is not VacationWeb-owned');
  }
  return publicPath;
}

const STORAGE_KEY =
  /^tradetracker-creatives\/images\/(nl|be)\/(512226|511873)\/\d+\/\d+-\d+x\d+-[a-f0-9]{16}\.(png|jpe?g|gif|webp)$/;

export function assertIsolatedCreativeImageKey(key: string): void {
  if (!STORAGE_KEY.test(key) || key.split('/').some((part) => part === '..' || part === '.')) {
    throw new Error('creative image key is outside the isolated prefix');
  }
  const [market, site] = key.split('/').slice(2, 4);
  if (!market || !site || !isCanonicalCreativeSite(market, site)) {
    throw new Error('creative image key site does not match market');
  }
  const forbidden = ['offers.json', 'current.json', 'generations', 'live-price', 'catalog'];
  if (forbidden.some((part) => key.includes(part))) {
    throw new Error('creative image key overlaps catalog storage');
  }
}
