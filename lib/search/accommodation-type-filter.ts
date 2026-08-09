/**
 * High-volume accommodation types shown in Verblijf filter.
 * Camping / Vakantiepark / Bungalow omitted: combined ~0.83% and Prijsvrij-only.
 */
export const ACCOMMODATION_TYPE_FILTER_VALUES = [
  'Hotel',
  'Appartement',
  'Aparthotel',
  'Resort',
  'Villa',
] as const;

export type AccommodationTypeFilter = (typeof ACCOMMODATION_TYPE_FILTER_VALUES)[number];

export function parseAccommodationTypesParam(
  value: string | null | undefined,
): AccommodationTypeFilter[] {
  if (!value) {
    return [];
  }
  const selected = new Set<AccommodationTypeFilter>();
  for (const part of value.split(',')) {
    const trimmed = part.trim();
    const match = ACCOMMODATION_TYPE_FILTER_VALUES.find(
      (item) => item.toLowerCase() === trimmed.toLowerCase(),
    );
    if (match) {
      selected.add(match);
    }
  }
  return ACCOMMODATION_TYPE_FILTER_VALUES.filter((item) => selected.has(item));
}

export function serializeAccommodationTypesParam(
  types: AccommodationTypeFilter[] | undefined,
): string | undefined {
  if (!types?.length) {
    return undefined;
  }
  const normalized = parseAccommodationTypesParam(types.join(','));
  return normalized.length > 0 ? normalized.join(',') : undefined;
}

export function offerMatchesAccommodationType(
  offerType: string | undefined,
  selected: AccommodationTypeFilter[],
): boolean {
  if (selected.length === 0) {
    return true;
  }
  const normalized = (offerType || '').trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return selected.some((type) => normalized === type.toLowerCase());
}
