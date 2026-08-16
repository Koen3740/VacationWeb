import type { TravelOffer } from '../../types/travel';

/**
 * Long descriptive fields stored in the compact runtime as `searchText`
 * so Results does not download descriptionLong/feedDescription.
 * Duplicate / contained strings are stored once; keyword `.includes` is unchanged.
 */
export function buildCompactSearchText(offer: TravelOffer): string | undefined {
  const parts = [offer.descriptionLong, offer.feedDescription, offer.accommodation]
    .map((value) => value?.trim().toLowerCase())
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => right.length - left.length);

  const unique: string[] = [];
  for (const part of parts) {
    if (unique.some((existing) => existing.includes(part))) {
      continue;
    }
    unique.push(part);
  }

  if (unique.length === 0) {
    return undefined;
  }

  return unique.join(' ');
}

/** Shared lowercase blob used by feature/location/amenity matchers. */
export function offerSearchText(offer: TravelOffer): string {
  return [
    offer.categories?.join(' '),
    offer.subcategories,
    offer.descriptionShort,
    offer.searchText ? undefined : offer.descriptionLong,
    offer.extraInfo,
    offer.searchText ? undefined : offer.feedDescription,
    offer.hotelName,
    offer.searchText ? undefined : offer.accommodation,
    offer.accommodationType,
    offer.boardType,
    offer.destinationRegion,
    offer.destinationCity,
    offer.destinationProvince,
    offer.searchText,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function offerMatchesAnyKeyword(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}
