import type { TravelOffer } from '@/types/travel';
import { offerHasCarRental } from '@/lib/offers/has-car-rental';
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

export const MAX_CARD_HIGHLIGHTS = 6;
export const CARD_HIGHLIGHT_COLUMNS = 3;
export const CARD_HIGHLIGHT_ROWS = 2;
export const CARD_HIGHLIGHT_SLOTS = CARD_HIGHLIGHT_COLUMNS * CARD_HIGHLIGHT_ROWS;

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

  if (offerHasCarRental(offer)) {
    if (out.length >= MAX_CARD_HIGHLIGHTS) {
      out[MAX_CARD_HIGHLIGHTS - 1] = 'Huurauto inclusief';
    } else {
      push('Huurauto inclusief');
    }
  }

  return out;
}

/**
 * Pack highlights into a fixed 3×2 slot matrix (row-major).
 * The two longest labels share column 0 (slots 0 and 3) so short labels keep
 * horizontal room and full phrases stay on one line with whitespace-nowrap.
 */
export function layoutCardHighlightSlots(labels: readonly string[]): (string | null)[] {
  const items = labels.slice(0, CARD_HIGHLIGHT_SLOTS);
  const slots: (string | null)[] = Array.from({ length: CARD_HIGHLIGHT_SLOTS }, () => null);
  if (items.length === 0) {
    return slots;
  }

  const byLength = [...items].sort((a, b) => b.length - a.length || a.localeCompare(b));
  const longest = byLength.slice(0, Math.min(2, items.length));
  const longestSet = new Set(longest);
  slots[0] = longest[0] ?? null;
  if (longest[1]) {
    slots[3] = longest[1];
  }

  const rest = items.filter((label) => !longestSet.has(label));
  let restIndex = 0;
  for (let slot = 0; slot < CARD_HIGHLIGHT_SLOTS && restIndex < rest.length; slot += 1) {
    if (slots[slot] == null) {
      slots[slot] = rest[restIndex] ?? null;
      restIndex += 1;
    }
  }

  return slots;
}
