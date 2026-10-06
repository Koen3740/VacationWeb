import type { TravelOffer } from '../feeds/canonical/travel-offer';
import { addCalendarDaysIso, catalogReturnDateIso } from '../offers/duration-semantics';
import { normalizeDepartureDateToIso } from '../search/departure-date';

/**
 * DEC-019: VacationWeb never collects a full date of birth. When a provider
 * technically requires one, a synthetic DOB is derived here. It is internal
 * and provider-technical only: it is never stored, shown, or put in a
 * VacationWeb URL.
 *
 * - adult: fixed dummy {@link SYNTHETIC_ADULT_DOB}
 * - child: calculated return date minus the child's age in years
 *   (29 Feb in a non-leap year becomes 28 Feb, never 1 Mar)
 */
export const SYNTHETIC_ADULT_DOB = '1986-01-01';

/** One person of a search party: `age === null` is an adult (count only). */
export type SyntheticDobMember = { age: number | null; roomIndex: number };

/** Trip reference a provider adapter needs to derive child DOBs. */
export type TripDobReference = { returnDate: string | null };

const ISO_YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0');
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Pure return-date calculation: departure (ISO) + whole days. Delegates to the single
 * calendar helper in duration-semantics.ts (no own date arithmetic here).
 */
export function calculateReturnDate(departureIso: string, offsetDays: number): string | null {
  return addCalendarDaysIso(departureIso, offsetDays);
}

/**
 * Return date (last travel day) of an offer = the central offer end date
 * (`catalogReturnDateIso` / `catalogReturnDateOffsetDays` in duration-semantics.ts, DEC-018:
 * days offers end on departure + days - 1, nights offers on departure + nights). Same
 * calculation as result cards and detail page. `departureOverride` is the exact provider trip
 * date (landing query / Corendon fragment) when known.
 */
export function calculateOfferReturnDate(
  offer: Pick<TravelOffer, 'provider' | 'nights' | 'durationType' | 'departureDate'>,
  departureOverride?: string | null,
): string | null {
  const departureIso =
    normalizeDepartureDateToIso(departureOverride) ?? normalizeDepartureDateToIso(offer.departureDate);
  if (!departureIso) {
    return null;
  }
  return catalogReturnDateIso(offer, departureIso);
}

/** Trip reference for the provider adapters (returnDate stays null when unknown). */
export function tripDobReferenceForOffer(
  offer: Pick<TravelOffer, 'provider' | 'nights' | 'durationType' | 'departureDate'>,
  departureOverride?: string | null,
): TripDobReference {
  return { returnDate: calculateOfferReturnDate(offer, departureOverride) };
}

/** Child DOB = return date minus age years; 29 Feb in a non-leap target year -> 28 Feb. */
export function syntheticChildDob(returnDate: string, age: number): string | null {
  const match = ISO_YMD.exec(returnDate);
  if (!match || !Number.isInteger(age) || age < 0 || age > 17) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  const birthYear = year - age;
  const birthDay = month === 2 && day === 29 && !isLeapYear(birthYear) ? 28 : day;
  return `${pad(birthYear, 4)}-${pad(month, 2)}-${pad(birthDay, 2)}`;
}

/**
 * Synthetic DOB for one party member. Adults never need a date; a child needs a
 * return date and otherwise yields `null` (callers fail closed).
 */
export function syntheticDobForMember(
  member: Pick<SyntheticDobMember, 'age'>,
  reference: TripDobReference | undefined,
): string | null {
  if (member.age === null) {
    return SYNTHETIC_ADULT_DOB;
  }
  const returnDate = reference?.returnDate;
  return returnDate ? syntheticChildDob(returnDate, member.age) : null;
}

/** True when every party member can get a synthetic DOB with this reference. */
export function partyHasValidAges(party: ReadonlyArray<Pick<SyntheticDobMember, 'age'>>): boolean {
  return party.every(
    (member) =>
      member.age === null || (Number.isInteger(member.age) && member.age >= 0 && member.age <= 17),
  );
}