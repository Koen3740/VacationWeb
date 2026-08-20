/**
 * Proven "huurauto inbegrepen" for VacationWeb.
 * One canonical truth: offer.hasCarRental === true.
 * Derived only from structural feed fields at import/merge —
 * never from hotel name, marketing copy, searchText, or vacationTypes "Fly & Drive".
 */

export const CORENDON_FLY_DRIVE_TOKEN = 'Fly-Drive vakantie';
export const CAR_RENTAL_INCLUDED_LABEL = 'Inclusief huurauto';
export const HAS_CAR_RENTAL_PARAM = 'hasCarRental';
export const HAS_CAR_RENTAL_PARAM_VALUE = '1';

export function offerHasCarRental(offer: { hasCarRental?: boolean }): boolean {
  return offer.hasCarRental === true;
}

export function carRentalIncludedLabel(offer: { hasCarRental?: boolean }): string | undefined {
  return offer.hasCarRental === true ? CAR_RENTAL_INCLUDED_LABEL : undefined;
}

export function unionHasCarRental(
  records: ReadonlyArray<{ hasCarRental?: boolean }>,
): true | undefined {
  return records.some((record) => record.hasCarRental === true) ? true : undefined;
}

export function parseExplicitTrue(value: string | boolean | undefined | null): boolean {
  if (value === true) {
    return true;
  }
  if (typeof value !== 'string') {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'ja';
}

export function splitSubcategoryTokens(value: string | string[] | undefined): string[] {
  if (value == null) {
    return [];
  }
  const parts = Array.isArray(value) ? value.flatMap((item) => item.split(',')) : value.split(',');
  return parts.map((part) => part.trim()).filter(Boolean);
}

export function deriveSunwebHasCarRental(options: {
  transportType: string | undefined;
  hasCarRentalRaw: string | boolean | undefined;
}): true | undefined {
  if (options.transportType?.trim().toLowerCase() !== 'flight') {
    return undefined;
  }
  return parseExplicitTrue(options.hasCarRentalRaw) ? true : undefined;
}

export function deriveCorendonHasCarRental(options: {
  subcategories?: string | string[];
  flightIncluded?: string | boolean;
}): true | undefined {
  if (!parseExplicitTrue(options.flightIncluded)) {
    return undefined;
  }
  const tokens = splitSubcategoryTokens(options.subcategories);
  return tokens.includes(CORENDON_FLY_DRIVE_TOKEN) ? true : undefined;
}

/** URL: only `hasCarRental=1` activates the filter. Absent or any other value = off. */
export function parseHasCarRentalParam(raw: string | null | undefined): true | undefined {
  return raw === HAS_CAR_RENTAL_PARAM_VALUE ? true : undefined;
}

export function serializeHasCarRentalParam(value: boolean | undefined): string | undefined {
  return value === true ? HAS_CAR_RENTAL_PARAM_VALUE : undefined;
}
