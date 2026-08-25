import { normalizeDepartureDateToIso } from './departure-date';
import type { SearchParams } from '../../types/travel';

export type DeparturePresentation = {
  mode: 'none' | 'exact' | 'period';
  /** Full user-facing sentence for Results and Detail. */
  phrase: string | undefined;
};

function formatDdMmYyyy(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

/**
 * Display date as DD/MM/YYYY from ISO or Corendon DD/MM/YYYY catalog values.
 * Unknown formats return null — do not invent calendars.
 */
export function formatDateDdMmYyyy(raw: string | undefined | null): string | undefined {
  const iso = normalizeDepartureDateToIso(raw);
  return iso ? formatDdMmYyyy(iso) : undefined;
}

function normalizedSearchWindow(params?: Pick<SearchParams, 'departureStart' | 'departureEnd'> | null): {
  start: string | null;
  end: string | null;
} {
  const start = normalizeDepartureDateToIso(params?.departureStart) ?? null;
  const end = normalizeDepartureDateToIso(params?.departureEnd) ?? start;
  return { start, end };
}

/**
 * One presentation rule for Results cards and Detail.
 *
 * Offer-specific departure date always wins when present (ResultCard / Detail).
 * The search window (departureStart/End) is only used when the offer has no
 * concrete date — e.g. summary copy without an offer. A flexible search range
 * must never replace a catalog trip's own departure date on a card.
 */
export function formatDeparturePresentation(
  params?: Pick<SearchParams, 'departureStart' | 'departureEnd'> | null,
  offerDepartureDate?: string | null,
): DeparturePresentation {
  const offer = formatDateDdMmYyyy(offerDepartureDate);
  if (offer) {
    return {
      mode: 'exact',
      phrase: `Vertrek op ${offer}`,
    };
  }

  const { start, end } = normalizedSearchWindow(params);

  if (start && end && start !== end) {
    return {
      mode: 'period',
      phrase: `Vertrek tussen ${formatDdMmYyyy(start)} en ${formatDdMmYyyy(end)}`,
    };
  }

  if (start) {
    return {
      mode: 'exact',
      phrase: `Vertrek op ${formatDdMmYyyy(start)}`,
    };
  }

  return { mode: 'none', phrase: undefined };
}
