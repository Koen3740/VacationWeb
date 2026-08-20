/**
 * Catalog departure dates vs search ISO dates.
 *
 * Evidenced formats only:
 * - ISO `YYYY-MM-DD` (search params and most providers)
 * - Corendon feed `DD/MM/YYYY`
 *
 * Unknown formats return null. Do not invent extra provider calendars.
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
