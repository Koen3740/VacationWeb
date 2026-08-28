/** Official VacationWeb accommodation types (provider terminology, no cross-type merging). */
export const ACCOMMODATION_TYPE_FILTER_VALUES = [
  'Villa',
  'Vakantiewoning',
  'Bungalow',
  'Appartement',
  'Aparthotel',
  'Hotel',
  'Camping',
  'Vakantiepark',
  'Resort',
  'Hostel',
] as const;

export type AccommodationTypeFilter = (typeof ACCOMMODATION_TYPE_FILTER_VALUES)[number];

/** Feed synonyms → canonical sidebar value (case-insensitive). */
const ACCOMMODATION_TYPE_SYNONYMS: ReadonlyArray<[RegExp, AccommodationTypeFilter]> = [
  [/^hôtel$/i, 'Hotel'],
  [/^hotel(?:kamer| room)?$/i, 'Hotel'],
  [/^studio$/i, 'Appartement'],
  [/^appartement$/i, 'Appartement'],
  [/^apartment$/i, 'Appartement'],
  [/^aparthotel$/i, 'Aparthotel'],
  [/^resort$/i, 'Resort'],
  [/^villa$/i, 'Villa'],
];

export function canonicalizeAccommodationType(
  raw: string | undefined,
): AccommodationTypeFilter | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return undefined;
  }
  const direct = ACCOMMODATION_TYPE_FILTER_VALUES.find(
    (item) => item.toLowerCase() === trimmed.toLowerCase(),
  );
  if (direct) {
    return direct;
  }
  for (const [pattern, canonical] of ACCOMMODATION_TYPE_SYNONYMS) {
    if (pattern.test(trimmed)) {
      return canonical;
    }
  }
  return undefined;
}

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

/**
 * Full canonical selection (or every type available in the current catalog scope)
 * is equivalent to no accommodation-type restriction.
 */
export function effectiveAccommodationTypesForFilter(
  selected: AccommodationTypeFilter[],
  scope: readonly AccommodationTypeFilter[] = ACCOMMODATION_TYPE_FILTER_VALUES,
): AccommodationTypeFilter[] {
  if (selected.length === 0 || scope.length === 0) {
    return [];
  }
  const scopeSet = new Set(scope);
  const selectedInScope = selected.filter((type) => scopeSet.has(type));
  if (selectedInScope.length === 0) {
    return [];
  }
  if (scope.every((type) => selectedInScope.includes(type))) {
    return [];
  }
  return selectedInScope;
}

export function offerMatchesAccommodationType(
  offerType: string | undefined,
  selected: AccommodationTypeFilter[],
): boolean {
  if (selected.length === 0) {
    return true;
  }
  const canonical = canonicalizeAccommodationType(offerType);
  if (!canonical) {
    return false;
  }
  return selected.some((type) => canonical === type);
}

/** NL card label; maps BE-FR feed values (e.g. Hôtel) to canonical sidebar labels. */
export function displayAccommodationTypeForCard(raw: string | undefined): string | undefined {
  const canonical = canonicalizeAccommodationType(raw);
  if (canonical) {
    return canonical;
  }
  const trimmed = raw?.trim();
  return trimmed || undefined;
}
