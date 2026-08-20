import type { FlexibilityDays } from '@/components/search/departure-period-popup/departure-period-popup';
import {
  createDefaultTravelersState,
  getTravelersTotals,
  normalizeTravelersState,
  serializeTravelersToQuery,
  type TravelersState,
} from '@/components/search/travelers-popup/travelers-popup-utils';

export type SharedSearchState = {
  selectedCountries: string[];
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

    return {
      selectedCountries: Array.isArray(parsed.selectedCountries) ? parsed.selectedCountries : [],
      departureStart: typeof parsed.departureStart === 'string' ? parsed.departureStart : null,
      departureEnd: typeof parsed.departureEnd === 'string' ? parsed.departureEnd : null,
      flexibilityDays: parsed.flexibilityDays === 1 || parsed.flexibilityDays === 2 ? parsed.flexibilityDays : 0,
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
  const travelers = normalizeTravelersState(state.travelers);
  const party = serializeTravelersToQuery(travelers);
  const params = new URLSearchParams({
    adults: party.adults,
    dob: party.dob,
  });

  if (party.rooms) {
    params.set('rooms', party.rooms);
  }

  if (party.partyRooms) {
    params.set('partyRooms', party.partyRooms);
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

  if (state.selectedDepartureAirports.length > 0) {
    params.set('departureAirport', state.selectedDepartureAirports.join(','));
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

  const travellerCount = Math.max(1, Math.floor(form.adults) + Math.floor(form.children));
  const travellers = Array.from({ length: Math.min(9, travellerCount) }, (_, index) => ({
    id: `t-${index + 1}`,
    dateOfBirth: null,
  }));

  return {
    selectedCountries: form.countries,
    departureStart: form.departureStart || null,
    departureEnd: form.departureEnd || null,
    flexibilityDays: 0,
    selectedDurations,
    selectedDepartureAirports: [],
    travelers: normalizeTravelersState({
      travellers,
      roomCount: form.rooms,
      roomAssignments: [],
    }),
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
  const travelers = normalizeTravelersState(shared.travelers);
  const totals = getTravelersTotals(travelers);

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
    rooms: travelers.roomCount,
  };
}
