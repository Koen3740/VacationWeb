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
  catalogDurationUsesDays,
  catalogReturnDateOffsetDays,
  formatCatalogDurationDaysLabel,
} from '@/lib/offers/duration-semantics';
import { normalizeDepartureDateToIso } from '@/lib/search/departure-date';
import { formatDateDdMmYyyy, formatDeparturePresentation } from '@/lib/search/departure-presentation';
import { formatOfferDepartureAirportLabel } from '@/lib/search/departure-airports';
import { formatOccupancyCompositionNl } from '@/lib/search/occupancy-category';
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

export function formatDateOfBirthLabel(value: string | null | undefined): string {
  if (!value?.trim()) {
    return 'geboortedatum niet ingevuld';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatTravelerLines(params: SearchParams): string[] {
  if (!params.party?.length) {
    return [];
  }
  return params.party.map((traveller, index) => {
    const room = traveller.roomIndex + 1;
    return `Reiziger ${index + 1}: ${formatDateOfBirthLabel(traveller.dateOfBirth)} • kamer ${room}`;
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
  if (/\b(?:undefined|null|\[object Object\])\b/.test(trimmed)) {
    return true;
  }
  return false;
}

/** Strip feed HTML/CSS so Overview never shows selectors or declarations. */
export function stripSimpleHtml(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  let next = trimmed
    .replace(STYLE_OR_SCRIPT_BLOCK, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
  next = next.replace(CSS_SELECTOR_BLOCK, ' ');
  next = next.replace(/<[^>]+>/g, ' ');
  next = next.replace(CSS_DECLARATION, ' ');
  next = next.replace(/[{}]/g, ' ').replace(/\s+/g, ' ').trim();

  if (!next || looksLikeTechnicalDisplayText(next)) {
    return undefined;
  }

  return next;
}

export function formatReturnDateLabel(
  departureDate: string | undefined,
  nights: number | undefined,
): string | undefined {
  if (!nights || nights < 1) {
    return undefined;
  }
  const iso = normalizeDepartureDateToIso(departureDate);
  if (!iso) {
    return undefined;
  }
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) {
    return undefined;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + nights);
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

export function collectThemeLabels(offer: TravelOffer): string[] {
  const themes = (offer.subcategories ?? '')
    .split(',')
    .map((theme) => theme.trim())
    .filter((theme) => theme.length > 0);
  const categories = (offer.categories ?? [])
    .map((category) => category.trim())
    .filter((category) => category.length > 0);

  const seen = new Set<string>();
  const out: string[] = [];
  for (const label of [...themes, ...categories]) {
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

export function affiliateHref(offer: TravelOffer, params?: SearchParams): string | undefined {
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
