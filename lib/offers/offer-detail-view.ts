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
import { formatDateDdMmYyyy, formatDeparturePresentation } from '@/lib/search/departure-presentation';
import { formatOfferDepartureAirportLabel } from '@/lib/search/departure-airports';
import { formatOccupancyCompositionNl } from '@/lib/search/occupancy-category';
import type { SearchParams, TravelOffer } from '@/types/travel';

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
    offer.destinationRegion,
    offer.destinationProvince,
    offer.destinationCountry,
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

  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
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

export function stripSimpleHtml(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }
  const stripped = trimmed.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return stripped || undefined;
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
    { label: 'Regio', value: offer.destinationRegion },
    { label: 'Provincie', value: offer.destinationProvince },
    { label: 'Land', value: offer.destinationCountry },
    { label: 'Valuta', value: offer.currency?.trim() },
    { label: 'Verzorging', value: offer.boardType },
    { label: 'Accommodatie', value: offer.accommodation },
    { label: 'Accommodatietype', value: offer.accommodationType },
    { label: 'Aantal nachten', value: offer.nights ? `${offer.nights} nachten` : undefined },
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

export function affiliateHref(offer: TravelOffer, params?: SearchParams): string | undefined {
  if (offer.listingHost && offer.providerListings?.length) {
    const host = offer.listingHost.toLowerCase();
    const selected = offer.providerListings.find(
      (listing) => listing.host.toLowerCase() === host && listing.deepLink.trim() !== '',
    );
    if (selected) {
      return selected.deepLink.trim();
    }
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
