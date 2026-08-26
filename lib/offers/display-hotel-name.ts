import { decodeHtmlEntities } from '@/lib/feeds/canonical/decode-html-entities';
import type { TravelOffer } from '@/types/travel';

/**
 * Repair leftover HTML apostrophe entities when `&` was stripped
 * (e.g. feed/UI showing `Villa#039` instead of `Villa's`).
 */
function repairBrokenApostropheEntities(value: string): string {
  return value
    .replace(/&apos;/gi, "'")
    .replace(/&#0?39;?/gi, "'")
    .replace(/#0?39;?/gi, "'");
}

function looksTechnicalPublicName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) {
    return true;
  }
  if (/^\d{2,}$/.test(trimmed)) {
    return true;
  }
  // Room/unit style codes: Villa8, APP12, DZ1
  if (/^(villa|app|apt|room|unit|kamer)\s*\d+[a-z0-9'_-]*$/i.test(trimmed)) {
    return true;
  }
  if (/^[A-Z]{1,4}\d{2,}[A-Z0-9_-]*$/i.test(trimmed) && trimmed.length <= 12) {
    return true;
  }
  return false;
}

function nameFromDescriptionShort(descriptionShort: string | undefined): string | undefined {
  const text = descriptionShort?.trim();
  if (!text) {
    return undefined;
  }
  const match = text.match(/\bnaar\s+(.+?)\s+in\s+/i);
  const candidate = match?.[1]?.trim();
  if (!candidate || looksTechnicalPublicName(candidate)) {
    return undefined;
  }
  return candidate;
}

/** Public Results/Detail title: never show raw technical IDs or broken &#039 entities. */
export function displayHotelName(offer: Pick<
  TravelOffer,
  'hotelName' | 'accommodation' | 'descriptionShort'
>): string {
  const decoded = repairBrokenApostropheEntities(
    decodeHtmlEntities(String(offer.hotelName ?? '')),
  ).trim();

  if (decoded && !looksTechnicalPublicName(decoded)) {
    return decoded;
  }

  const accommodation = offer.accommodation?.split(/[;|]/)[0]?.trim();
  if (accommodation && !looksTechnicalPublicName(accommodation)) {
    return repairBrokenApostropheEntities(decodeHtmlEntities(accommodation));
  }

  const fromDescription = nameFromDescriptionShort(offer.descriptionShort);
  if (fromDescription) {
    return repairBrokenApostropheEntities(decodeHtmlEntities(fromDescription));
  }

  return decoded || 'Accommodatie';
}
