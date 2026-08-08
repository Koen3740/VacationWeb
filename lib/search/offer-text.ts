import type { TravelOffer } from '@/types/travel';

/** Shared lowercase blob used by feature/location/amenity matchers. */
export function offerSearchText(offer: TravelOffer): string {
  return [
    offer.categories?.join(' '),
    offer.subcategories,
    offer.descriptionShort,
    offer.descriptionLong,
    offer.extraInfo,
    offer.feedDescription,
    offer.hotelName,
    offer.accommodation,
    offer.accommodationType,
    offer.boardType,
    offer.destinationRegion,
    offer.destinationCity,
    offer.destinationProvince,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function offerMatchesAnyKeyword(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}
