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

export type AmenityPresence = 'present' | 'absent' | 'unknown';

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
  wifi: ['wifi', 'wi-fi', 'gratis wifi', 'free wifi', 'free wi-fi', 'wifi inbegrepen'],
  airco: ['airconditioning', 'airco', 'air-conditioning', 'climatisation'],
};

const ABSENCE_PHRASES: Partial<Record<AmenityValue, string[]>> = {
  wifi: ['geen wifi', 'zonder wifi', 'no wifi', 'without wifi', 'sans wifi'],
  airco: [
    'geen airconditioning',
    'geen airco',
    'zonder airconditioning',
    'zonder airco',
    'no air conditioning',
    'without air conditioning',
  ],
};

/** Amenities that must come from structured facility/taxonomy fields — not free copy or photos. */
const STRUCTURED_ONLY_AMENITIES = new Set<AmenityValue>(['aquapark']);

/** WiFi/Airco need explicit evidence; missing provider data is unknown, not absent. */
const EVIDENCE_BASED_AMENITIES = new Set<AmenityValue>(['wifi', 'airco']);

const NEGATION_BEFORE_KEYWORD = /(?:geen|zonder|no |not |without |sans )/;

/** Categories / USP / facilities tags only (no descriptionLong / image-derived copy). */
export function offerStructuredFacilityText(offer: TravelOffer): string {
  return [offer.categories?.join(' '), offer.subcategories]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function keywordPresentWithoutNegation(text: string, keyword: string): boolean {
  let searchFrom = 0;
  while (searchFrom < text.length) {
    const idx = text.indexOf(keyword, searchFrom);
    if (idx === -1) {
      return false;
    }
    const before = text.slice(Math.max(0, idx - 16), idx);
    if (!NEGATION_BEFORE_KEYWORD.test(before)) {
      return true;
    }
    searchFrom = idx + keyword.length;
  }
  return false;
}

function textHasAnyKeyword(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => keywordPresentWithoutNegation(text, keyword));
}

function textHasAnyPhrase(text: string, phrases: string[]): boolean {
  return phrases.some((phrase) => text.includes(phrase));
}

function amenitySearchText(offer: TravelOffer, amenity: AmenityValue): string {
  if (STRUCTURED_ONLY_AMENITIES.has(amenity)) {
    return offerStructuredFacilityText(offer);
  }
  if (EVIDENCE_BASED_AMENITIES.has(amenity)) {
    return [offerStructuredFacilityText(offer), offerSearchText(offer)].filter(Boolean).join(' ');
  }
  return offerSearchText(offer);
}

export function getAmenityPresence(offer: TravelOffer, amenity: AmenityValue): AmenityPresence {
  const text = amenitySearchText(offer, amenity);
  if (!text.trim()) {
    return 'unknown';
  }
  const absence = ABSENCE_PHRASES[amenity];
  if (absence && textHasAnyPhrase(text, absence)) {
    return 'absent';
  }
  if (textHasAnyKeyword(text, KEYWORDS[amenity])) {
    return 'present';
  }
  return 'unknown';
}

export function offerMatchesAmenity(offer: TravelOffer, amenity: AmenityValue): boolean {
  if (EVIDENCE_BASED_AMENITIES.has(amenity)) {
    return getAmenityPresence(offer, amenity) === 'present';
  }
  const text = amenitySearchText(offer, amenity);
  return textHasAnyKeyword(text, KEYWORDS[amenity]);
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
