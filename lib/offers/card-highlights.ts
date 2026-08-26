import type { TravelOffer } from '@/types/travel';
import { AMENITY_LABELS, offerMatchesAmenity, type AmenityValue } from '@/lib/search/amenity-filters';
import { offerMatchesAnyBeachLocation } from '@/lib/search/location-filters';

const CARD_AMENITY_ORDER: AmenityValue[] = [
  'pool_outdoor',
  'pool_kids',
  'pool_indoor',
  'airco',
  'wifi',
];

const CARD_AMENITY_DISPLAY: Partial<Record<AmenityValue, string>> = {
  pool_outdoor: 'Zwembad buiten',
  pool_indoor: 'Zwembad binnen',
  pool_kids: 'Kinderzwembad',
  airco: 'Airco',
  wifi: 'WiFi',
};

const WELLNESS_AMENITIES: AmenityValue[] = ['sauna', 'hammam', 'jacuzzi'];

const BEACH_PROXIMITY_BUCKETS = ['direct', 'lt150', 'lt500', 'lt1000'] as const;

const MAX_CARD_HIGHLIGHTS = 6;

/**
 * Scanbare kaartkenmerken — zelfde canonical matchers als filters, geen vrije marketingtekst.
 */
export function collectCardHighlights(offer: TravelOffer): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  const push = (label: string) => {
    const key = label.toLowerCase();
    if (seen.has(key) || out.length >= MAX_CARD_HIGHLIGHTS) {
      return;
    }
    seen.add(key);
    out.push(label);
  };

  for (const amenity of CARD_AMENITY_ORDER) {
    if (offerMatchesAmenity(offer, amenity)) {
      push(CARD_AMENITY_DISPLAY[amenity] ?? AMENITY_LABELS[amenity]);
    }
  }

  if (offerMatchesAnyBeachLocation(offer, [...BEACH_PROXIMITY_BUCKETS])) {
    push('Nabij strand');
  }

  if (WELLNESS_AMENITIES.some((amenity) => offerMatchesAmenity(offer, amenity))) {
    push('Spa');
  }

  return out;
}
