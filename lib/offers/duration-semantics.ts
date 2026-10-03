import type { TravelOffer } from '../feeds/canonical/travel-offer';

// Catalog provider names: PROVIDERS.eliza.name is 'Eliza was here' (lib/feeds/providers.ts);
// the short 'Eliza' is kept for older callers/tests.
const CATALOG_DURATION_DAYS_PROVIDERS = new Set(['Corendon', 'Sunweb', 'Eliza', 'Eliza was here']);

function normalizeDurationType(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.toLowerCase();
}

/** Catalog `offer.nights` stores trip days for Corendon, Sunweb and Eliza. */
export function catalogDurationUsesDays(
  offer: Pick<TravelOffer, 'provider' | 'durationType'>,
): boolean {
  const durationType = normalizeDurationType(offer.durationType);
  if (
    durationType === 'dagen'
    || durationType === 'dag'
    || durationType === 'days'
    || durationType === 'day'
  ) {
    return true;
  }
  return CATALOG_DURATION_DAYS_PROVIDERS.has(offer.provider);
}

export function formatCatalogDurationDaysLabel(days: number): string {
  return `${days} ${days === 1 ? 'dag' : 'dagen'}`;
}

/**
 * SSOT (t355u): calendar-day offset from departure to the LAST travel day (return date)
 * of an offer. Used by result cards, detail page and the synthetic-DOB reference date.
 * - days offers (durationType dagen/days, or Corendon/Sunweb/Eliza): `nights` counts trip
 *   DAYS with departure and return day both included -> return = departure + days - 1
 *   (10 Oct + 8 days = 17 Oct).
 * - nights offers: `nights` counts NIGHTS -> return = departure + nights
 *   (10 Oct + 7 nights = 17 Oct).
 */
export function catalogReturnDateOffsetDays(
  offer: Pick<TravelOffer, 'provider' | 'nights' | 'durationType'>,
): number | undefined {
  if (!Number.isFinite(offer.nights) || offer.nights < 1) {
    return undefined;
  }
  return catalogDurationUsesDays(offer) ? offer.nights - 1 : offer.nights;
}

const ISO_YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Pure calendar arithmetic on an ISO date (UTC, no DST); null for invalid input. */
export function addCalendarDaysIso(iso: string, days: number): string | null {
  const match = ISO_YMD.exec(iso);
  if (!match || !Number.isInteger(days) || days < 0) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  date.setUTCDate(date.getUTCDate() + days);
  const pad = (value: number, width: number) => String(value).padStart(width, '0');
  return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1, 2)}-${pad(date.getUTCDate(), 2)}`;
}

/** Return date (ISO) of an offer for an ISO departure date; the only offer end-date calculation. */
export function catalogReturnDateIso(
  offer: Pick<TravelOffer, 'provider' | 'nights' | 'durationType'>,
  departureIso: string,
): string | null {
  const offset = catalogReturnDateOffsetDays(offer);
  return offset === undefined ? null : addCalendarDaysIso(departureIso, offset);
}
