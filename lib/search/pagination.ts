export const RESULTS_PAGE_DEFAULT = 1;
export const RESULTS_PAGE_SIZE_DEFAULT = 24;
export const RESULTS_PAGE_SIZE_MIN = 1;
export const RESULTS_PAGE_SIZE_MAX = 100;

function parsePositiveInteger(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return fallback;
  }

  const parsed = Number(raw);

  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < min) {
    return fallback;
  }

  return Math.min(parsed, max);
}

export function parseResultsPageParam(raw: string | undefined): number {
  return parsePositiveInteger(raw, RESULTS_PAGE_DEFAULT, 1, Number.MAX_SAFE_INTEGER);
}

export function parseResultsPageSizeParam(raw: string | undefined): number {
  return parsePositiveInteger(
    raw,
    RESULTS_PAGE_SIZE_DEFAULT,
    RESULTS_PAGE_SIZE_MIN,
    RESULTS_PAGE_SIZE_MAX,
  );
}

export function paginateResults<T>(items: T[], page: number, pageSize: number): T[] {
  const startIndex = (page - 1) * pageSize;

  if (startIndex >= items.length || pageSize <= 0) {
    return [];
  }

  return items.slice(startIndex, startIndex + pageSize);
}
