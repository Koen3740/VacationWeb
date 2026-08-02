import type { FlexibilityDays } from '@/components/search/departure-period-popup/departure-period-popup';
import {
  createDefaultTravelersState,
  getTravelersTotals,
  type TravelersState,
} from '@/components/search/travelers-popup/travelers-popup-utils';

export type SharedSearchState = {
  selectedCountries: string[];
  departureStart: string | null;
  departureEnd: string | null;
  flexibilityDays: FlexibilityDays;
  selectedDurations: number[];
  travelers: TravelersState;
};

const STORAGE_KEY = 'vacationweb.shared-search-state';

function addDays(isoDate: string, days: number): string {
  const date = new Date(isoDate);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function createDefaultSharedSearchState(): SharedSearchState {
  return {
    selectedCountries: [],
    departureStart: null,
    departureEnd: null,
    flexibilityDays: 0,
    selectedDurations: [],
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
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.travelers?.rooms)) {
      return null;
    }

    return {
      selectedCountries: Array.isArray(parsed.selectedCountries) ? parsed.selectedCountries : [],
      departureStart: typeof parsed.departureStart === 'string' ? parsed.departureStart : null,
      departureEnd: typeof parsed.departureEnd === 'string' ? parsed.departureEnd : null,
      flexibilityDays: parsed.flexibilityDays === 1 || parsed.flexibilityDays === 2 ? parsed.flexibilityDays : 0,
      selectedDurations: Array.isArray(parsed.selectedDurations)
        ? parsed.selectedDurations.filter((value): value is number => typeof value === 'number')
        : [],
      travelers: parsed.travelers,
    };
  } catch {
    return null;
  }
}

export function saveSharedSearchState(state: SharedSearchState): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function buildResultsHref(state: SharedSearchState): string {
  const travelerTotals = getTravelersTotals(state.travelers.rooms);
  const params = new URLSearchParams({
    adults: travelerTotals.adults.toString(),
  });

  if (travelerTotals.children > 0) {
    params.set('children', travelerTotals.children.toString());
  }

  if (travelerTotals.babies > 0) {
    params.set('babies', travelerTotals.babies.toString());
  }

  if (state.travelers.rooms.length > 1) {
    params.set('rooms', state.travelers.rooms.length.toString());
  }

  if (state.selectedCountries.length > 0) {
    params.set('country', state.selectedCountries.join(','));
  }

  if (state.departureStart) {
    params.set('departureStart', state.departureStart);
    if (state.departureEnd) {
      params.set('departureEnd', state.departureEnd);
    } else {
      const fallbackNightsMax = state.selectedDurations.length > 0
        ? Math.max(...state.selectedDurations)
        : 12;
      params.set('departureEnd', addDays(state.departureStart, fallbackNightsMax));
    }
  }

  if (state.flexibilityDays > 0) {
    params.set('flexibilityDays', state.flexibilityDays.toString());
  }

  if (state.selectedDurations.length > 0) {
    params.set('nightsMin', Math.min(...state.selectedDurations).toString());
    params.set('nightsMax', Math.max(...state.selectedDurations).toString());
  }

  return `/results?${params.toString()}`;
}

export function sharedStateFromSearchForm(form: {
  country: string;
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

  const rooms = Array.from({ length: Math.max(1, form.rooms) }, (_, index) => ({
    adults: index === 0 ? form.adults : 2,
    children: index === 0 ? form.children : 0,
    babies: 0,
  }));

  if (rooms[0]) {
    rooms[0].adults = form.adults;
    rooms[0].children = form.children;
  }

  return {
    selectedCountries: form.country ? [form.country] : [],
    departureStart: form.departureStart || null,
    departureEnd: form.departureEnd || null,
    flexibilityDays: 0,
    selectedDurations,
    travelers: { rooms },
  };
}

export function mergeSharedStateIntoSearchForm<T extends {
  country: string;
  region: string;
  departureStart: string;
  departureEnd: string;
  nightsMin: number;
  nightsMax: number;
  adults: number;
  children: number;
  rooms: number;
}>(form: T, shared: SharedSearchState, regionsByCountry: Record<string, string[]>): T {
  const country = shared.selectedCountries[0] ?? form.country;
  const region = regionsByCountry[country]?.[0] ?? form.region;
  const totals = getTravelersTotals(shared.travelers.rooms);

  return {
    ...form,
    country,
    region,
    departureStart: shared.departureStart ?? form.departureStart,
    departureEnd: shared.departureEnd ?? form.departureEnd,
    nightsMin: shared.selectedDurations.length > 0 ? Math.min(...shared.selectedDurations) : form.nightsMin,
    nightsMax: shared.selectedDurations.length > 0 ? Math.max(...shared.selectedDurations) : form.nightsMax,
    adults: totals.adults,
    children: totals.children,
    rooms: shared.travelers.rooms.length,
  };
}
