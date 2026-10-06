/**
 * Newest active offer first. No provider rank.
 *
 * Each offer uses the first date it actually has, in this order:
 * 1. publish or start date
 * 2. validity start
 * 3. ingest time
 *
 * A date-only value is the UTC calendar day. A full timestamp is absolute time.
 * An offer with none of these dates sorts after every dated offer.
 * Remaining ties break by id descending.
 */

export type DatedOffer = {
  id: string;
  publishedAt: string | null;
  validFrom: string | null;
  ingestedAt: string | null;
};

export function offerListedAtMs(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const text = value.trim();
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (dateOnly) {
    return Date.UTC(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  }
  const ms = Date.parse(text);
  return Number.isFinite(ms) ? ms : null;
}

export function offerSortMs(offer: DatedOffer): number | null {
  return offerListedAtMs(offer.publishedAt) ?? offerListedAtMs(offer.validFrom) ?? offerListedAtMs(offer.ingestedAt);
}

export function sortOffersNewestFirst<T extends DatedOffer>(offers: readonly T[]): T[] {
  return [...offers].sort((a, b) => {
    const aMs = offerSortMs(a);
    const bMs = offerSortMs(b);
    if (aMs !== null && bMs !== null && aMs !== bMs) {
      return bMs - aMs;
    }
    if (aMs !== null && bMs === null) {
      return -1;
    }
    if (aMs === null && bMs !== null) {
      return 1;
    }
    return b.id.localeCompare(a.id, 'nl');
  });
}
