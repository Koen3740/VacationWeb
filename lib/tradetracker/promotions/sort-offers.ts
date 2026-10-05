/**
 * Newest offer first. No provider rank and no hero slot.
 *
 * `listedAt` is the date already on the stream card:
 * a creative's TradeTracker `validFromDate`, or a news item's `publishDate`.
 * A date-only value is the UTC calendar day. A full timestamp is parsed as absolute time.
 * An offer with no usable date sorts after every dated offer.
 * Equal dates, and offers with no date, break the tie by id descending so the order stays stable.
 */

export type DatedOffer = {
  id: string;
  listedAt: string | null;
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

export function sortOffersNewestFirst<T extends DatedOffer>(offers: readonly T[]): T[] {
  return [...offers].sort((a, b) => {
    const aMs = offerListedAtMs(a.listedAt);
    const bMs = offerListedAtMs(b.listedAt);
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
