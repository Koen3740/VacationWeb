/**
 * Catalog departure dates vs search ISO dates.
 *
 * Evidenced formats only:
 * - ISO `YYYY-MM-DD` (search params and most providers)
 * - Corendon feed `DD/MM/YYYY`
 *
 * Unknown formats return null. Do not invent extra provider calendars.
 *
 * Bookable search rule: earliest selectable departure is tomorrow (local calendar).
 * Today and earlier are not valid departure dates.
 */
const ISO_YMD = /^(\d{4})-(\d{2})-(\d{2})$/;
const CORENDON_DMY = /^(\d{2})\/(\d{2})\/(\d{4})$/;

function isValidUtcYmd(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function toLocalIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function normalizeDepartureDateToIso(
  raw: string | undefined | null,
): string | null {
  if (!raw) {
    return null;
  }

  const trimmed = raw.trim();
  const iso = ISO_YMD.exec(trimmed);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    if (!isValidUtcYmd(year, month, day)) {
      return null;
    }
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }

  const dmy = CORENDON_DMY.exec(trimmed);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    if (!isValidUtcYmd(year, month, day)) {
      return null;
    }
    return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  }

  return null;
}

/** First calendar day that may be chosen as a departure (tomorrow, local). */
export function earliestSelectableDepartureIso(now: Date = new Date()): string {
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return toLocalIsoDate(tomorrow);
}

export function isSelectableDepartureIso(
  raw: string | undefined | null,
  now: Date = new Date(),
): boolean {
  const iso = normalizeDepartureDateToIso(raw);
  if (!iso) {
    return false;
  }
  return iso >= earliestSelectableDepartureIso(now);
}

export type SanitizedDepartureWindow = {
  /** False when the request window has no bookable future day. */
  valid: boolean;
  departureStart?: string;
  departureEnd?: string;
};

/**
 * Normalize a Results departure window to bookable dates.
 * - No dates → valid (open search).
 * - Window ends before tomorrow → invalid (not a normal Results search).
 * - Window overlaps tomorrow+ → clamp start (and end if needed) to tomorrow+.
 */
export function sanitizeDepartureSearchWindow(
  departureStart: string | undefined | null,
  departureEnd: string | undefined | null,
  now: Date = new Date(),
): SanitizedDepartureWindow {
  const startIso = normalizeDepartureDateToIso(departureStart);
  const endIso = normalizeDepartureDateToIso(departureEnd) ?? startIso;

  if (!startIso && !endIso) {
    return { valid: true };
  }

  if (!startIso || !endIso) {
    return { valid: false };
  }

  const orderedStart = startIso <= endIso ? startIso : endIso;
  const orderedEnd = startIso <= endIso ? endIso : startIso;
  const minIso = earliestSelectableDepartureIso(now);

  if (orderedEnd < minIso) {
    return {
      valid: false,
      departureStart: orderedStart,
      departureEnd: orderedEnd,
    };
  }

  return {
    valid: true,
    departureStart: orderedStart < minIso ? minIso : orderedStart,
    departureEnd: orderedEnd,
  };
}
