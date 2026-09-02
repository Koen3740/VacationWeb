import type { FlexibilityDays } from '@/components/search/departure-period-popup/departure-period-popup';
import { parseDepartureAirportsParam } from '@/components/search/departure-airport-popup/departure-airport-popup-utils';
import { parseDurationsFromSearchParams } from '@/components/search/duration-popup/duration-popup-utils';
import { buildResultsHref } from '@/components/search/shared-search-state';
import {
  createDefaultTravelersState,
  parseTravelersFromQuery,
  type TravelersState,
} from '@/components/search/travelers-popup/travelers-popup-utils';
import { occupancySearchParamsChanged } from '@/lib/search/filter-classification';
import { applyFilterNavigationPaging } from '@/lib/search/filter-navigation';

export type ResultsBarSearchState = {
  selectedCountries: string[];
  departureStart: string | null;
  departureEnd: string | null;
  flexibilityDays: FlexibilityDays;
  selectedDurations: number[];
  selectedDepartureAirports: string[];
  travelers: TravelersState;
};

/** Applied criteria from the URL only — single source of truth with summary/filters. */
export function stateFromUrl(searchParams: URLSearchParams): ResultsBarSearchState {
  const country = searchParams.get('country');
  const departureStart = searchParams.get('departureStart');
  const departureEnd = searchParams.get('departureEnd');
  const flexibilityRaw = Number(searchParams.get('flexibilityDays') || 0);
  const selectedCountries = country
    ? country.split(',').map((c) => c.trim()).filter(Boolean)
    : [];

  const selectedDurations = parseDurationsFromSearchParams(searchParams);

  const travelers: TravelersState =
    parseTravelersFromQuery({
      dob: searchParams.get('dob') ?? undefined,
      partyRooms: searchParams.get('partyRooms') ?? undefined,
      adults: searchParams.get('adults') ?? undefined,
      children: searchParams.get('children') ?? undefined,
      babies: searchParams.get('babies') ?? undefined,
      rooms: searchParams.get('rooms') ?? undefined,
    }) ?? createDefaultTravelersState();

  return {
    selectedCountries,
    departureStart: departureStart || null,
    departureEnd: departureEnd || null,
    flexibilityDays: (flexibilityRaw === 1 || flexibilityRaw === 2 ? flexibilityRaw : 0) as FlexibilityDays,
    selectedDurations,
    selectedDepartureAirports: parseDepartureAirportsParam(searchParams.get('departureAirport')),
    travelers,
  };
}

const PRESERVE_FILTER_KEYS = [
  'budgetMin',
  'budgetMax',
  'region',
  'city',
  'boardTypes',
  'accommodationTypes',
  'stars',
  'vacationTypes',
  'beachLocation',
  'centerLocation',
  'amenities',
  'sort',
  'hasCarRental',
] as const;

/**
 * Build a Results URL from the parameter-bar state while preserving active
 * sidebar filters/sort. Resets `page` (and occupancy-sensitive `page1Ids`).
 */
export function buildResultsBarHref(
  state: ResultsBarSearchState,
  currentSearchParams: URLSearchParams,
  options: { liveQuery?: string } = {},
): string {
  const href = buildResultsHref({
    selectedCountries: state.selectedCountries,
    departureStart: state.departureStart,
    departureEnd: state.departureEnd,
    flexibilityDays: state.flexibilityDays,
    selectedDurations: state.selectedDurations,
    selectedDepartureAirports: state.selectedDepartureAirports,
    travelers: state.travelers,
  });
  const params = new URLSearchParams(href.split('?')[1] || '');

  for (const key of PRESERVE_FILTER_KEYS) {
    const value = currentSearchParams.get(key);
    if (value) params.set(key, value);
  }

  params.delete('nightsMin');
  params.delete('nightsMax');
  if (state.selectedDurations.length === 0) {
    params.delete('nights');
  }
  if (state.selectedDepartureAirports.length > 0) {
    params.set('departureAirport', state.selectedDepartureAirports.join(','));
  } else {
    params.delete('departureAirport');
  }

  params.delete('page');
  if (occupancySearchParamsChanged(currentSearchParams, params)) {
    params.delete('page1Ids');
  } else {
    applyFilterNavigationPaging(params, {
      preservePage1Ids: true,
      liveQuery: options.liveQuery,
    });
  }

  return `/results?${params.toString()}`;
}

export function resultsQueryEqual(a: string, b: string): boolean {
  const left = new URLSearchParams(a.startsWith('/results?') ? a.slice('/results?'.length) : a);
  const right = new URLSearchParams(b.startsWith('/results?') ? b.slice('/results?'.length) : b);
  const leftKeys = [...left.keys()].sort();
  const rightKeys = [...right.keys()].sort();
  if (leftKeys.length !== rightKeys.length) return false;
  for (let i = 0; i < leftKeys.length; i += 1) {
    if (leftKeys[i] !== rightKeys[i]) return false;
    if (left.get(leftKeys[i]) !== right.get(rightKeys[i])) return false;
  }
  return true;
}
