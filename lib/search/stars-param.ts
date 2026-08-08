/** Exact star ratings selectable in Results filters. */
export const STAR_FILTER_VALUES = [5, 4, 3] as const;

export type StarFilterValue = (typeof STAR_FILTER_VALUES)[number];

const ALLOWED = new Set<number>(STAR_FILTER_VALUES);

/**
 * Parse the `stars` URL query param into exact star values.
 *
 * Supported forms:
 * - `stars=4`       → [4]   (legacy single value; now exact, not "and higher")
 * - `stars=3,5`     → [3, 5]
 * - `stars=3,4,5`   → [3, 4, 5]
 *
 * Invalid / out-of-range values are ignored. Order is normalized to 5 → 4 → 3.
 */
export function parseStarsParam(value: string | null | undefined): number[] {
  if (!value) {
    return [];
  }

  const selected = new Set<number>();

  for (const part of value.split(',')) {
    const trimmed = part.trim();
    if (!trimmed) {
      continue;
    }
    const n = Number(trimmed);
    if (Number.isFinite(n) && ALLOWED.has(n)) {
      selected.add(n);
    }
  }

  return STAR_FILTER_VALUES.filter((star) => selected.has(star));
}

export function serializeStarsParam(stars: number[] | undefined): string | undefined {
  if (!stars?.length) {
    return undefined;
  }

  const normalized = parseStarsParam(stars.join(','));
  return normalized.length > 0 ? normalized.join(',') : undefined;
}
