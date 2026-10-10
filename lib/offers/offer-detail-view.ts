import { canonicalizeCountryName } from '@/lib/offers/canonical-country';
import { canonicalizeRegionName } from '@/lib/offers/canonical-region';
import { collectOrderedOfferImages } from '@/lib/offers/offer-images';
import { carRentalIncludedLabel } from '@/lib/offers/has-car-rental';
import {
  buildElizaOccupancyClickOutHref,
  isEliza,
  isElizaFourTravellerTwoRoomSearch,
} from '@/lib/providers/eliza/offer-context';
import {
  buildSunwebOccupancyClickOutHref,
  isSunweb,
  isSunwebFourTravellerTwoRoomSearch,
} from '@/lib/providers/sunweb/offer-context';
import {
  addCalendarDaysIso,
  catalogDurationUsesDays,
  catalogReturnDateOffsetDays,
  formatCatalogDurationDaysLabel,
} from '@/lib/offers/duration-semantics';
import { normalizeDepartureDateToIso } from '@/lib/search/departure-date';
import { formatDateDdMmYyyy, formatDeparturePresentation } from '@/lib/search/departure-presentation';
import { formatOfferDepartureAirportLabel } from '@/lib/search/departure-airports';
import { formatOccupancyCompositionNl } from '@/lib/search/occupancy-category';
import { isClickoutAllowedForSiteMarket, offerForSiteMarket } from '@/lib/search/market-inventory';
import { decodeHtmlEntities } from '@/lib/feeds/canonical/decode-html-entities';
import type { ProviderListing } from '@/lib/feeds/types/stored-offer';
import type { SearchParams, TravelOffer } from '@/types/travel';

/** Caption when Detail shows a proven live amount for the current occupancy. */
export const DETAIL_LIVE_PRICE_CAPTION = 'Actuele prijs voor deze samenstelling';

export type OfferDetailFact = {
  label: string;
  value: string;
};

export function buildGalleryImages(offer: TravelOffer): string[] {
  return collectOrderedOfferImages(offer);
}

export function formatDestination(offer: TravelOffer): string {
  const parts = [
    offer.destinationCity,
    canonicalizeRegionName(offer.destinationRegion),
    offer.destinationProvince,
    canonicalizeCountryName(offer.destinationCountry ?? ''),
  ]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));

  return parts.filter((part, index) => part !== parts[index - 1]).join(', ');
}

export function formatDepartureDate(value: string): string {
  return formatDateDdMmYyyy(value) ?? value;
}

function normalizeDescriptionText(value: string | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

export function getUniqueFeedDescription(offer: TravelOffer): string | undefined {
  const feedDescription = offer.feedDescription?.trim();
  if (!feedDescription) {
    return undefined;
  }

  const feedNormalized = normalizeDescriptionText(feedDescription);
  const shortNormalized = normalizeDescriptionText(offer.descriptionShort);
  const longNormalized = normalizeDescriptionText(offer.descriptionLong);

  if (shortNormalized && feedNormalized === shortNormalized) {
    return undefined;
  }

  if (longNormalized && feedNormalized === longNormalized) {
    return undefined;
  }

  return feedDescription;
}

export function formatFlightIncluded(value: string | undefined): string | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === 'ja' || normalized === '1') {
    return 'Vlucht inbegrepen';
  }
  if (normalized === 'false' || normalized === 'nee' || normalized === '0') {
    return 'Zonder vlucht';
  }

  return value.trim();
}

export function formatDurationType(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  const normalized = trimmed.toLowerCase();
  if (
    normalized === 'dagen' ||
    normalized === 'dag' ||
    normalized === 'days' ||
    normalized === 'day' ||
    normalized === 'jours' ||
    normalized === 'jour'
  ) {
    return undefined;
  }

  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export function formatNightsLabel(
  nights: number | undefined,
  durationType?: string,
  provider?: string,
): string | undefined {
  if (!nights) {
    return undefined;
  }
  const usesDays = catalogDurationUsesDays({
    provider: provider ?? '',
    durationType,
  });
  if (usesDays) {
    const base = formatCatalogDurationDaysLabel(nights);
    const durationTypeLabel = formatDurationType(durationType);
    return durationTypeLabel ? `${base} • ${durationTypeLabel}` : base;
  }
  const durationTypeLabel = formatDurationType(durationType);
  return durationTypeLabel ? `${nights} nachten • ${durationTypeLabel}` : `${nights} nachten`;
}

export function formatOfferReturnDateLabel(offer: TravelOffer): string | undefined {
  return formatReturnDateLabel(offer.departureDate, catalogReturnDateOffsetDays(offer));
}

/** Weekday + short date for the detail journey lines. Same ISO calendar as the return-date SSOT. */
export function formatTripDateNl(raw: string | undefined): string | undefined {
  const iso = normalizeDepartureDateToIso(raw);
  if (!iso) {
    return undefined;
  }
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toLocaleDateString('nl-NL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Detail click-out label. Results cards keep their own label. */
export function detailBookCtaLabel(provider: string): string {
  return `Bekijk en boek bij ${provider.trim()}`;
}

export function formatDepartureAirport(offer: TravelOffer): string | undefined {
  return formatOfferDepartureAirportLabel(offer);
}

export function formatAdditionalAirport(offer: TravelOffer): string | undefined {
  if (formatOfferDepartureAirportLabel(offer)) {
    return undefined;
  }

  const airport = offer.airport?.trim();
  if (!airport) {
    return undefined;
  }

  const departure = offer.departureAirport?.trim();
  if (!departure) {
    return airport;
  }

  const airportLower = airport.toLowerCase();
  const departureLower = departure.toLowerCase();
  if (
    airportLower === departureLower
    || departureLower.includes(airportLower)
    || airportLower.includes(departureLower)
  ) {
    return undefined;
  }

  return airport;
}

export function isLastMinuteOffer(offer: TravelOffer): boolean {
  const normalized = (offer.lastMinute ?? '').trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

export function formatPriceNl(value: number, fractionDigits = 0): string {
  return new Intl.NumberFormat('nl-NL', {
    style: 'decimal',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatOccupancySummary(params: SearchParams): string | undefined {
  return formatOccupancyCompositionNl(params, { includeRooms: true }) || undefined;
}

/**
 * Traveller label from the age on the calculated return date (DEC-019).
 * `null` = adult (counted, no age). No date of birth is involved.
 */
export function formatTravelerAgeLabel(age: number | null | undefined): string {
  if (age === null || age === undefined) {
    return 'volwassene';
  }
  if (!Number.isInteger(age) || age < 0 || age > 17) {
    return 'leeftijd onbekend';
  }
  if (age < 2) {
    return 'baby';
  }
  return `${age} jaar`;
}

export function formatTravelerLines(params: SearchParams): string[] {
  if (!params.party?.length) {
    return [];
  }
  return params.party.map((traveller, index) => {
    const room = traveller.roomIndex + 1;
    return `Reiziger ${index + 1}: ${formatTravelerAgeLabel(traveller.age)} • kamer ${room}`;
  });
}

const STYLE_OR_SCRIPT_BLOCK = /<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi;
const CSS_SELECTOR_BLOCK =
  /(?:^|[\s>])(?:\.[A-Za-z_-][\w-]*|#[A-Za-z_-][\w-]*)(?:\s+[A-Za-z_-][\w-]*)*\s*\{[^}]*\}/g;
const CSS_DECLARATION =
  /(?:^|\s)(?:list-style|margin(?:-[a-z]+)?|padding(?:-[a-z]+)?|font-family|font-size|border(?:-radius|-color|-width|-style)?|content|display|width|height|color|background(?:-color)?|text-align|vertical-align|white-space|letter-spacing|box-sizing|float|clear|position|top|left|right|bottom|z-index|opacity|overflow(?:-[xy])?|flex(?:-direction|-wrap|-grow|-shrink|-basis)?|justify-content|align-items|gap|grid(?:-template(?:-columns|-rows)?)?)\s*:\s*[^;{}]+;?/gi;

export function looksLikeTechnicalDisplayText(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return true;
  }
  if (/<style\b|<script\b|<\/style>|<\/script>/i.test(trimmed)) {
    return true;
  }
  if (/(?:^|\s)(?:\.[A-Za-z_-][\w-]*|#[A-Za-z_-][\w-]*)(?:\s|:|\{)/.test(trimmed)) {
    return true;
  }
  if (/[{}].*:.*;/.test(trimmed) && /(?:list-style|font-family|border-radius|margin-left)\s*:/i.test(trimmed)) {
    return true;
  }
  if (trimmed.includes('[object Object]') || /\b(?:undefined|null)\b/.test(trimmed)) {
    return true;
  }
  return false;
}

const BREAK_TAG = /<\s*br\b[^>]*>/gi;
const BLOCK_BOUNDARY = /<\s*\/?\s*(?:p|div|li|h[1-6]|tr|ul|ol)\b[^>]*>/gi;

function decodeProviderEntities(value: string): string {
  let next = value;
  for (let pass = 0; pass < 2 && next.includes('&'); pass += 1) {
    const decoded = decodeHtmlEntities(next);
    if (decoded === next) {
      break;
    }
    next = decoded;
  }
  return next;
}

/**
 * Provider copy as plain paragraphs.
 * `<br>` and block tags become separate blocks. Every other tag is removed.
 * The result is text only — callers must not inject it as HTML.
 */
export function providerTextBlocks(value: string | undefined): string[] {
  const trimmed = value?.trim();
  if (!trimmed) {
    return [];
  }

  let next = decodeProviderEntities(trimmed)
    .replace(STYLE_OR_SCRIPT_BLOCK, '\n')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
  next = next.replace(BREAK_TAG, '\n').replace(BLOCK_BOUNDARY, '\n');
  next = next.replace(CSS_SELECTOR_BLOCK, ' ');
  next = next.replace(/<[^>]*>/g, ' ');
  next = next.replace(CSS_DECLARATION, ' ');
  next = next.replace(/[{}]/g, ' ');

  return next
    .split(/\n+/)
    .map((block) => block.replace(/[ \t\u00A0]+/g, ' ').trim())
    .filter((block) => block.length > 0 && !looksLikeTechnicalDisplayText(block));
}

/** Strip feed HTML/CSS so Overview never shows selectors or declarations. */
export function stripSimpleHtml(value: string | undefined): string | undefined {
  const blocks = providerTextBlocks(value);
  if (blocks.length === 0) {
    return undefined;
  }

  const next = blocks.join(' ');
  if (looksLikeTechnicalDisplayText(next)) {
    return undefined;
  }

  return next;
}

function humanDisplayPart(value: string | undefined): string | undefined {
  const parts = (value ?? '')
    .split(/\s*(?:;|•)\s*/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !/^\d+$/.test(part) && !looksLikeTechnicalDisplayText(part));
  return parts.length > 0 ? parts.join(' • ') : undefined;
}

/**
 * Reis-grid accommodation label. A bare provider id such as `40348` is omitted.
 * A human type or name is kept. Nothing human means the fact stays hidden.
 */
export function formatDetailAccommodation(
  accommodationType: string | undefined,
  accommodation: string | undefined,
): string | undefined {
  const type = humanDisplayPart(accommodationType);
  const name = humanDisplayPart(accommodation);
  if (!type) {
    return name;
  }
  if (!name || type.toLowerCase() === name.toLowerCase()) {
    return type;
  }
  return `${type} • ${name}`;
}

/** Formats departure + `offsetDays` (from `catalogReturnDateOffsetDays`); no own offset logic. */
export function formatReturnDateLabel(
  departureDate: string | undefined,
  offsetDays: number | undefined,
): string | undefined {
  if (!offsetDays || offsetDays < 1) {
    return undefined;
  }
  const iso = normalizeDepartureDateToIso(departureDate);
  const endIso = iso ? addCalendarDaysIso(iso, offsetDays) : null;
  if (!endIso) {
    return undefined;
  }
  const [year, month, day] = endIso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatCoordinates(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): string | undefined {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return undefined;
  }
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return undefined;
  }
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

/**
 * User-facing room names from stored `variations` JSON.
 * Raw JSON is never shown.
 */
export function parseVariationRoomNames(raw: string | undefined): string[] {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return [];
  }

  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return [trimmed];
  }

  try {
    const parsed: unknown = JSON.parse(trimmed);
    const names: string[] = [];
    const seen = new Set<string>();

    const visit = (value: unknown): void => {
      if (!value) {
        return;
      }
      if (Array.isArray(value)) {
        for (const item of value) {
          visit(item);
        }
        return;
      }
      if (typeof value !== 'object') {
        return;
      }
      const record = value as Record<string, unknown>;
      if (typeof record.roomName === 'string' && record.roomName.trim()) {
        const name = record.roomName.trim();
        const key = name.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          names.push(name);
        }
      }
      if (Array.isArray(record.property)) {
        const roomNameProp = record.property.find(
          (item) =>
            item
            && typeof item === 'object'
            && (item as { name?: unknown }).name === 'roomName'
            && typeof (item as { value?: unknown }).value === 'string',
        ) as { value: string } | undefined;
        if (roomNameProp?.value.trim()) {
          const name = roomNameProp.value.trim();
          const key = name.toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            names.push(name);
          }
        }
      }
      for (const nested of Object.values(record)) {
        if (nested && typeof nested === 'object') {
          visit(nested);
        }
      }
    };

    visit(parsed);
    return names;
  } catch {
    return [];
  }
}

/** String label, or an object's `label` / `name` / `title`. Drops `[object Object]` and other non-labels. */
function readThemeLabel(value: unknown, depth = 0): string | undefined {
  if (depth > 2) {
    return undefined;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || /^\d+$/.test(trimmed) || looksLikeTechnicalDisplayText(trimmed)) {
      return undefined;
    }
    return trimmed;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  for (const key of ['label', 'name', 'title', 'value', '#text']) {
    const nested = readThemeLabel(record[key], depth + 1);
    if (nested) {
      return nested;
    }
  }
  return undefined;
}

export function collectThemeLabels(offer: TravelOffer): string[] {
  const rawSubcategories = offer.subcategories as unknown;
  const subcategoryValues = Array.isArray(rawSubcategories)
    ? rawSubcategories
    : typeof rawSubcategories === 'string'
      ? rawSubcategories.split(',')
      : [];
  const categoryValues = (offer.categories ?? []) as unknown[];
  const labels = [...subcategoryValues, ...categoryValues]
    .map((value) => readThemeLabel(value))
    .filter((label): label is string => Boolean(label));

  const seen = new Set<string>();
  const out: string[] = [];
  for (const label of labels) {
    const key = label.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(label);
  }
  return out;
}

export function buildBasisFacts(offer: TravelOffer): OfferDetailFact[] {
  const hasRating = typeof offer.rating === 'number';
  const departureAirportLabel = formatDepartureAirport(offer);
  const additionalAirport = formatAdditionalAirport(offer);
  const flightIncludedLabel = formatFlightIncluded(offer.flightIncluded);
  const durationTypeLabel = formatDurationType(offer.durationType);
  const coordinates = formatCoordinates(offer.latitude, offer.longitude);
  const variationNames = parseVariationRoomNames(offer.variations);

  return [
    { label: 'Aanbieder', value: offer.provider },
    { label: 'Stad', value: offer.destinationCity },
    { label: 'Regio', value: canonicalizeRegionName(offer.destinationRegion) || undefined },
    { label: 'Provincie', value: offer.destinationProvince },
    { label: 'Land', value: canonicalizeCountryName(offer.destinationCountry ?? '') || undefined },
    { label: 'Valuta', value: offer.currency?.trim() },
    { label: 'Verzorging', value: offer.boardType },
    { label: 'Accommodatie', value: offer.accommodation },
    { label: 'Accommodatietype', value: offer.accommodationType },
    {
      label: catalogDurationUsesDays(offer) ? 'Reisduur' : 'Aantal nachten',
      value: formatNightsLabel(offer.nights, offer.durationType, offer.provider),
    },
    { label: 'Duurtype', value: durationTypeLabel },
    { label: 'Vlucht', value: flightIncludedLabel },
    { label: 'Huurauto', value: carRentalIncludedLabel(offer) },
    {
      label: 'Vertrekdatum',
      value: formatDeparturePresentation(undefined, offer.departureDate).phrase,
    },
    {
      label: 'Vertrekvenster',
      value:
        offer.departureWindowStart || offer.departureWindowEnd
          ? [offer.departureWindowStart, offer.departureWindowEnd].filter(Boolean).join(' – ')
          : undefined,
    },
    { label: 'Vertrekluchthaven', value: departureAirportLabel },
    { label: 'Luchthaven', value: additionalAirport },
    { label: 'Beoordeling', value: hasRating ? String(offer.rating) : undefined },
    { label: 'Locatie', value: coordinates },
    {
      label: 'Kamervarianten',
      value: variationNames.length > 0 ? variationNames.join(', ') : undefined,
    },
  ].filter((fact): fact is OfferDetailFact => Boolean(fact.value));
}

/**
 * Listing that live-price already bound onto the offer (`listingHost`).
 * Language/UI must not pick a different host.
 */
export function selectedProviderListing(offer: TravelOffer): ProviderListing | undefined {
  const host = offer.listingHost?.trim().toLowerCase();
  if (!host || !offer.providerListings?.length) {
    return undefined;
  }
  return offer.providerListings.find(
    (listing) => listing.host.toLowerCase() === host && listing.deepLink.trim() !== '',
  );
}

/** User-facing booking host, without inventing a market label. */
export function formatListingHostLabel(host: string | undefined): string | undefined {
  const trimmed = host?.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.replace(/^www\./i, '');
}

export function bookingCtaLabel(offer: TravelOffer): string {
  return `Boek bij ${offer.provider}`;
}

export function bookingVacationCtaLabel(offer: TravelOffer): string {
  return `Boek deze vakantie bij ${offer.provider}`;
}

/**
 * SUB 33D: on vacationweb.be / .nl the click-out must leave through that market's own
 * TradeTracker site. A foreign href (e.g. a stale overlay) falls back to the offer's own
 * market listing, else no click-out.
 */
export function affiliateHref(offer: TravelOffer, params?: SearchParams): string | undefined {
  const href = unscopedAffiliateHref(offer, params);
  const market = params?.siteMarket;
  if (!market || isClickoutAllowedForSiteMarket(href, market)) {
    return href;
  }
  const own = offerForSiteMarket(offer, market);
  const fallback = own?.deepLink?.trim();
  return fallback && isClickoutAllowedForSiteMarket(fallback, market) ? fallback : undefined;
}

function unscopedAffiliateHref(offer: TravelOffer, params?: SearchParams): string | undefined {
  const selected = selectedProviderListing(offer);
  if (selected) {
    return selected.deepLink.trim();
  }

  if (
    params &&
    isSunweb(offer) &&
    (params.rooms ?? 1) === 2 &&
    isSunwebFourTravellerTwoRoomSearch(params)
  ) {
    return buildSunwebOccupancyClickOutHref(offer, params) ?? undefined;
  }

  if (
    params &&
    isEliza(offer) &&
    (params.rooms ?? 1) === 2 &&
    isElizaFourTravellerTwoRoomSearch(params)
  ) {
    return buildElizaOccupancyClickOutHref(offer, params) ?? undefined;
  }

  const href = offer.deepLink?.trim();
  return href || undefined;
}
