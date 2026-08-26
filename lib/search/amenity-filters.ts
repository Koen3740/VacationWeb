import type { TravelOffer } from '@/types/travel';
import { offerMatchesAnyKeyword, offerSearchText } from '@/lib/search/offer-text';

/** Amenity filter keys with enough evidence for a first IA version. */
export const AMENITY_VALUES = [
  'pool_indoor',
  'pool_outdoor',
  'aquapark',
  'pool_kids',
  'sauna',
  'hammam',
  'jacuzzi',
  'fitness',
  'tennis',
  'golf',
  'watersport',
  'wifi',
  'airco',
] as const;

export type AmenityValue = (typeof AMENITY_VALUES)[number];

export const AMENITY_LABELS: Record<AmenityValue, string> = {
  pool_indoor: 'Binnenzwembad',
  pool_outdoor: 'Buitenzwembad',
  aquapark: 'Aquapark',
  pool_kids: 'Kinderbad',
  sauna: 'Sauna',
  hammam: 'Hammam',
  jacuzzi: 'Jacuzzi',
  fitness: 'Fitness',
  tennis: 'Tennis',
  golf: 'Golf',
  watersport: 'Watersport',
  wifi: 'Wifi',
  airco: 'Airco',
};

export const AMENITY_GROUPS: { id: string; label: string; items: AmenityValue[] }[] = [
  {
    id: 'pool',
    label: 'Zwembad',
    items: ['pool_indoor', 'pool_outdoor', 'aquapark', 'pool_kids'],
  },
  {
    id: 'wellness',
    label: 'Wellness',
    items: ['sauna', 'hammam', 'jacuzzi'],
  },
  {
    id: 'sport',
    label: 'Sport',
    items: ['fitness', 'tennis', 'golf', 'watersport'],
  },
  {
    id: 'services',
    label: 'Services',
    items: ['wifi', 'airco'],
  },
];

const KEYWORDS: Record<AmenityValue, string[]> = {
  pool_indoor: ['binnenzwembad', 'indoor pool', 'overdekt zwembad', 'binnenbad'],
  pool_outdoor: ['buitenzwembad', 'outdoor pool', 'buitenbad'],
  aquapark: ['aquapark', 'aqua park', 'waterpark', 'water park'],
  pool_kids: ['kinderbad', 'kinderzwembad', 'kids pool', 'children pool', 'peuterbad'],
  sauna: ['sauna'],
  hammam: ['hammam', 'hamam'],
  jacuzzi: ['jacuzzi', 'whirlpool', 'bubbelbad'],
  fitness: ['fitness', 'gym', 'sportschool'],
  tennis: ['tennis'],
  golf: ['golfbaan', 'golf course', 'golfhotel'],
  watersport: ['watersport', 'watersports', 'kitesurf', 'windsurf', 'duiken', 'snorkel'],
  wifi: ['gratis wifi', 'free wifi', 'free wi-fi', 'wifi inbegrepen'],
  airco: ['airconditioning', 'airco', 'air-conditioning'],
};

/** Amenities that must come from structured facility/taxonomy fields — not free copy or photos. */
const STRUCTURED_ONLY_AMENITIES = new Set<AmenityValue>(['aquapark']);

/** Categories / USP / facilities tags only (no descriptionLong / image-derived copy). */
export function offerStructuredFacilityText(offer: TravelOffer): string {
  return [offer.categories?.join(' '), offer.subcategories]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function offerMatchesAmenity(offer: TravelOffer, amenity: AmenityValue): boolean {
  const text = STRUCTURED_ONLY_AMENITIES.has(amenity)
    ? offerStructuredFacilityText(offer)
    : offerSearchText(offer);
  return offerMatchesAnyKeyword(text, KEYWORDS[amenity]);
}

/**
 * AND across selected amenities: every chosen facility must match.
 * OR previously allowed "sauna" to enlarge a set that already had other amenities.
 */
export function offerMatchesAnyAmenity(offer: TravelOffer, amenities: AmenityValue[]): boolean {
  if (amenities.length === 0) {
    return true;
  }
  return amenities.every((amenity) => offerMatchesAmenity(offer, amenity));
}

export function parseAmenitiesParam(value: string | null | undefined): AmenityValue[] {
  if (!value) {
    return [];
  }
  const selected = new Set<AmenityValue>();
  for (const part of value.split(',')) {
    const trimmed = part.trim() as AmenityValue;
    if ((AMENITY_VALUES as readonly string[]).includes(trimmed)) {
      selected.add(trimmed);
    }
  }
  return AMENITY_VALUES.filter((item) => selected.has(item));
}

export function serializeAmenitiesParam(amenities: AmenityValue[] | undefined): string | undefined {
  if (!amenities?.length) {
    return undefined;
  }
  const normalized = parseAmenitiesParam(amenities.join(','));
  return normalized.length > 0 ? normalized.join(',') : undefined;
}
