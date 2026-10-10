/**
 * Visible Results summary under the count: period · days · travellers.
 * Destination stays in the filter chips. Date text comes from the shared
 * departure display so the search bar and this line stay in sync.
 */
import { getDepartureDisplay } from '@/components/search/departure-display';
import {
  expandDurationRange,
  formatSelectedDurationsLabel,
} from '@/components/search/duration-popup/duration-popup-utils';
import { formatOccupancySummaryParts } from '@/lib/search/occupancy-category';
import type { SearchParams } from '@/types/travel';

const SEPARATOR = ' · ';

export function buildResultsTripSummary(params: SearchParams): string {
  const parts: string[] = [];

  const departure = getDepartureDisplay({
    departureStart: params.departureStart,
    departureEnd: params.departureEnd,
    flexibilityDays: params.flexibilityDays,
  }).summarySegment;
  if (departure) {
    parts.push(departure);
  }

  const activeDurations = params.nights?.length
    ? params.nights
    : params.nightsMin != null && params.nightsMax != null
      ? expandDurationRange(params.nightsMin, params.nightsMax)
      : [];
  if (activeDurations.length > 0) {
    parts.push(formatSelectedDurationsLabel(activeDurations));
  }

  parts.push(...formatOccupancySummaryParts(params, { includeRooms: false }));

  return parts.join(SEPARATOR);
}
