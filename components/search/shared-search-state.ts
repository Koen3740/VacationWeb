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
    params.set('departureEnd', state.departureEnd ?? state.departureStart);
  }

  if (state.flexibilityDays > 0) {
    params.set('flexibilityDays', state.flexibilityDays.toString());
  }

  if (state.selectedDurations.length > 0) {
    params.set('nights', [...state.selectedDurations].sort((a, b) => a - b).join(','));
  }

  return `/results?${params.toString()}`;
}

export function sharedStateFromSearchForm(form: {
  countries: string[];
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
    selectedCountries: form.countries,
    departureStart: form.departureStart || null,
    departureEnd: form.departureEnd || null,
    flexibilityDays: 0,
    selectedDurations,
    travelers: { rooms },
  };
}

export function mergeSharedStateIntoSearchForm<T extends {
  countries: string[];
  region: string;
  departureStart: string;
  departureEnd: string;
  nightsMin: number;
  nightsMax: number;
  adults: number;
  children: number;
  rooms: number;
}>(form: T, shared: SharedSearchState): T {
  const countries = shared.selectedCountries.length > 0 ? shared.selectedCountries : form.countries;
  const totals = getTravelersTotals(shared.travelers.rooms);

  return {
    ...form,
    countries,
    region: '',
    departureStart: shared.departureStart ?? form.departureStart,
    departureEnd: shared.departureEnd ?? form.departureEnd,
    nightsMin: shared.selectedDurations.length > 0 ? Math.min(...shared.selectedDurations) : form.nightsMin,
    nightsMax: shared.selectedDurations.length > 0 ? Math.max(...shared.selectedDurations) : form.nightsMax,
    adults: totals.adults,
    children: totals.children,
    rooms: shared.travelers.rooms.length,
  };
}
