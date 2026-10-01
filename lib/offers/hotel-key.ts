/**
 * Hotel key of an offer id: the first two dash-separated segments
 * (`corendon-8143`, `sunweb-39525`, `eliza-39209`). Offer ids rotate with
 * departure date, airport and board; the hotel key does not.
 */
export function hotelKeyFromOfferId(offerId: string): string | null {
  const parts = offerId.trim().split('-');
  if (parts.length < 2 || !parts[0] || !parts[1]) {
    return null;
  }
  return `${parts[0].toLowerCase()}-${parts[1]}`;
}