/**
 * Central presentation rules for departure date vs departure period.
 * Used by results search bar + results summary — keep in sync via this module only.
 */

export type DepartureDisplayInput = {
  departureStart: string | null | undefined;
  departureEnd: string | null | undefined;
  /** 0 = exact, 1 = ±1 day, 2 = ±2 days — only meaningful for a single exact date */
  flexibilityDays?: number | null;
};

export type DepartureDisplay = {
  mode: 'none' | 'exact' | 'period';
  /** Primary date/period label (search bar value) */
  label: string | null;
  /** Secondary line under "Wanneer" in the search bar */
  hint: string | null;
  /** Date/period segment for the results summary line (without bullet separators) */
  summarySegment: string | null;
};

function defaultFormatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}

function normalizeFlexibility(value: number | null | undefined): 0 | 1 | 2 {
  if (value === 1 || value === 2) return value;
  return 0;
}

function exactFlexibilityHint(flexibilityDays: 0 | 1 | 2): string {
  if (flexibilityDays === 1) return 'Flexibel ± 1 dag';
  if (flexibilityDays === 2) return 'Flexibel ± 2 dagen';
  return 'Exacte vertrekdatum';
}

function exactSummarySuffix(flexibilityDays: 0 | 1 | 2): string {
  if (flexibilityDays === 1) return ' (± 1 dag)';
  if (flexibilityDays === 2) return ' (± 2 dagen)';
  return '';
}

/**
 * Derive departure labels from selected start/end + flexibility.
 * Period (start ≠ end) never shows ± flexibility — that only applies to one exact date.
 */
export function getDepartureDisplay(
  input: DepartureDisplayInput,
  formatDate: (iso: string) => string = defaultFormatDate,
): DepartureDisplay {
  const start = input.departureStart?.trim() || null;
  const end = input.departureEnd?.trim() || null;
  const flexibilityDays = normalizeFlexibility(input.flexibilityDays);

  if (!start) {
    return {
      mode: 'none',
      label: null,
      hint: null,
      summarySegment: null,
    };
  }

  const startLabel = formatDate(start);
  const endLabel = end ? formatDate(end) : null;
  const isPeriod = Boolean(end && end !== start);

  if (isPeriod && endLabel) {
    const range = `${startLabel} – ${endLabel}`;
    return {
      mode: 'period',
      label: range,
      hint: 'Flexibele vertrekperiode',
      summarySegment: range,
    };
  }

  return {
    mode: 'exact',
    label: startLabel,
    hint: exactFlexibilityHint(flexibilityDays),
    summarySegment: `${startLabel}${exactSummarySuffix(flexibilityDays)}`,
  };
}
