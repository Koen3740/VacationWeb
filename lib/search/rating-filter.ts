/**
 * Results guest-rating filter. `TravelOffer.rating` is the 0–10 guest score
 * already stored by the importers. Stars stay on `offer.stars`.
 * A minimum excludes offers with no numeric rating.
 */
export const RATING_FILTER_PARAM = 'ratingMin';

export const RATING_MIN_OPTIONS = [9, 8, 7, 6] as const;

export type RatingMinOption = (typeof RATING_MIN_OPTIONS)[number];

const ALLOWED = new Set<number>(RATING_MIN_OPTIONS);

export function parseRatingMinParam(value: string | null | undefined): RatingMinOption | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number(value.trim());
  if (!Number.isInteger(parsed) || !ALLOWED.has(parsed)) {
    return undefined;
  }
  return parsed as RatingMinOption;
}

export function ratingFilterOptionLabel(minimum: RatingMinOption): string {
  return `${minimum} of hoger`;
}

export function ratingFilterChipLabel(minimum: RatingMinOption): string {
  return `Beoordeling ${minimum}+`;
}

export function offerMeetsRatingMin(
  offer: { rating?: number | null },
  minimum: number,
): boolean {
  return typeof offer.rating === 'number' && Number.isFinite(offer.rating) && offer.rating >= minimum;
}
