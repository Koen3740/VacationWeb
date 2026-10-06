import type { FlexibilityDays } from '@/components/search/departure-period-popup/departure-period-popup';
import {
  flexibilityForSelection,
} from '@/components/search/departure-period-popup/departure-period-popup-utils';
import {
  createDefaultTravelersState,
  getTravelersTotals,
  normalizeTravelersState,
  writeTravelersToQuery,
  type TravelersState,
} from '@/components/search/travelers-popup/travelers-popup-utils';
import { sanitizeDepartureSearchWindow } from '@/lib/search/departure-date';

export type SharedSearchState = {
  selectedCountries: string[];
  /** One region/island OR one place, always together with exactly one parent country. */
  region?: string;
  city?: string;
  departureStart: string | null;
  departureEnd: string | null;
  flexibilityDays: FlexibilityDays;
  selectedDurations: number[];
  selectedDepartureAirports: string[];
  travelers: TravelersState;
};

const STORAGE_KEY = 'vacationweb.shared-search-state';

export function createDefaultSharedSearchState(): SharedSearchState {
  return {
    selectedCountries: [],
    departureStart: null,
    departureEnd: null,
    flexibilityDays: 0,
    selectedDurations: [],
    selectedDepartureAirports: [],
    travelers: createDefaultTravelersState(),
  };
}

export function loadSharedSearchState(): SharedSearchState | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as SharedSearchState;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const departureStart = typeof parsed.departureStart === 'string' ? parsed.departureStart : null;
    const departureEnd = typeof parsed.departureEnd === 'string' ? parsed.departureEnd : null;

    return {
      selectedCountries: Array.isArray(parsed.selectedCountries) ? parsed.selectedCountries : [],
      ...(typeof parsed.region === 'string' && parsed.region ? { region: parsed.region } : {}),
      ...(typeof parsed.city === 'string' && parsed.city ? { city: parsed.city } : {}),
      departureStart,
      departureEnd,
      // ± only for one fixed date; a stored period never carries a margin (Search Architecture v2.13).
      flexibilityDays: flexibilityForSelection(departureStart, departureEnd, parsed.flexibilityDays),
      selectedDurations: Array.isArray(parsed.selectedDurations)
        ? parsed.selectedDurations.filter((value): value is number => typeof value === 'number')
        : [],
      selectedDepartureAirports: Array.isArray(parsed.selectedDepartureAirports)
        ? parsed.selectedDepartureAirports.filter((value): value is string => typeof value === 'string')
        : [],
      travelers: normalizeTravelersState(parsed.travelers),
    };
  } catch {
    return null;
  }
}

export function saveSharedSearchState(state: SharedSearchState): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...state,
      travelers: normalizeTravelersState(state.travelers),
    }),
  );
}

export function buildResultsHref(state: SharedSearchState): string {
  const params = new URLSearchParams();
  // DEC-019: adults count + child ages (+ derived children/babies, rooms). Never a date of birth.
  writeTravelersToQuery(params, normalizeTravelersState(state.travelers));

  if (state.selectedCountries.length > 0) {
    params.set('country', state.selectedCountries.join(','));
    // Existing single-value contract (country=A&region=X / country=A&city=P): only with one parent country.
    if (state.selectedCountries.length === 1) {
      if (state.region) {
        params.set('region', state.region);
      }
      if (state.city) {
        params.set('city', state.city);
      }
    }
  }

  if (state.departureStart) {
    const window = sanitizeDepartureSearchWindow(
      state.departureStart,
      state.departureEnd ?? state.departureStart,
    );
    if (window.valid && window.departureStart && window.departureEnd) {
      params.set('departureStart', window.departureStart);
      params.set('departureEnd', window.departureEnd);
    }
  }

  if (state.flexibilityDays > 0) {
    params.set('flexibilityDays', state.flexibilityDays.toString());
  }

  if (state.selectedDurations.length > 0) {
    params.set('nights', [...state.selectedDurations].sort((a, b) => a - b).join(','));
  }

  if (state.selectedDepartureAirports.length > 0) {
    params.set('departureAirport', state.selectedDepartureAirports.join(','));
  }

  return `/results?${params.toString()}`;
}

export function sharedStateFromSearchForm(form: {
  countries: string[];
  region?: string;
  city?: string;
  departureStart: string;
  departureEnd: string;
  nightsMin: number;
  nightsMax: number;
  adults: number;
  children: number;
  rooms: number;
}): SharedSearchState {
  const selectedDurations = form.nightsMin === form.nightsMax
    ? [form.nightsMin]
    : [form.nightsMin, form.nightsMax];

  // Legacy count-based form: children have no known age (null) until the popup sets it.
  const adults = Math.max(1, Math.floor(form.adults));
  const childAges = Array.from({ length: Math.max(0, Math.floor(form.children)) }, () => null);

  return {
    selectedCountries: form.countries,
    ...(form.region ? { region: form.region } : {}),
    ...(form.city ? { city: form.city } : {}),
    departureStart: form.departureStart || null,
    departureEnd: form.departureEnd || null,
    flexibilityDays: 0,
    selectedDurations,
    selectedDepartureAirports: [],
    travelers: normalizeTravelersState({
      adults,
      childAges,
      roomCount: form.rooms,
      roomAssignments: [],
    }),
  };
}

export function mergeSharedStateIntoSearchForm<T extends {
  countries: string[];
  region: string;
  city?: string;
  departureStart: string;
  departureEnd: string;
  nightsMin: number;
  nightsMax: number;
  adults: number;
  children: number;
  rooms: number;
}>(form: T, shared: SharedSearchState): T {
  const countries = shared.selectedCountries.length > 0 ? shared.selectedCountries : form.countries;
  const travelers = normalizeTravelersState(shared.travelers);
  const totals = getTravelersTotals(travelers);

  return {
    ...form,
    countries,
    region: shared.selectedCountries.length === 1 ? shared.region ?? '' : '',
    city: shared.selectedCountries.length === 1 ? shared.city ?? '' : '',
    departureStart: shared.departureStart ?? form.departureStart,
    departureEnd: shared.departureEnd ?? form.departureEnd,
    nightsMin: shared.selectedDurations.length > 0 ? Math.min(...shared.selectedDurations) : form.nightsMin,
    nightsMax: shared.selectedDurations.length > 0 ? Math.max(...shared.selectedDurations) : form.nightsMax,
    adults: totals.adults,
    children: totals.children + totals.babies,
    rooms: travelers.roomCount,
  };
}
