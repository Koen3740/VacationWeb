'use client';

import {
  CalendarIcon,
  DurationIcon,
  TravelersIcon,
} from '@/components/home/home-search-icons';
import { DeparturePeriodPopup, type FlexibilityDays } from '@/components/search/departure-period-popup/departure-period-popup';
import { DurationPopup } from '@/components/search/duration-popup/duration-popup';
import { DepartureAirportPopup } from '@/components/search/departure-airport-popup/departure-airport-popup';
import {
  formatSelectedDepartureAirportsLabel,
  parseDepartureAirportsParam,
} from '@/components/search/departure-airport-popup/departure-airport-popup-utils';
import {
  formatSelectedDurationsLabel,
  parseDurationsFromSearchParams,
} from '@/components/search/duration-popup/duration-popup-utils';
import {
  buildResultsHref,
  saveSharedSearchState,
} from '@/components/search/shared-search-state';
import { occupancySearchParamsChanged } from '@/lib/search/filter-classification';
import { applyFilterNavigationPaging } from '@/lib/search/filter-navigation';
import {
  SEARCH_PROGRESS_DELAY_MS,
  SearchProgressOverlay,
  useDelayedBusyOverlay,
} from '@/components/search/search-progress-feedback';
import { TravelersPopup } from '@/components/search/travelers-popup/travelers-popup';
import {
  createDefaultTravelersState,
  formatRoomsLabel,
  formatTravelersLabel,
  parseTravelersFromQuery,
  type TravelersState,
} from '@/components/search/travelers-popup/travelers-popup-utils';
import { RESULTS_CTA, RESULTS_CTA_HOVER } from '@/components/results-v2/results-design-tokens';
import { getDepartureDisplay } from '@/components/search/departure-display';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react';

function PlaneIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
      <path
        d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0011.5 2 1.5 1.5 0 0010 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"
        fill="#64748B"
      />
    </svg>
  );
}

function FieldButton({
  label,
  value,
  hint,
  icon,
  onClick,
  disabled = false,
}: {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-[60px] min-w-0 flex-1 items-center gap-2.5 px-3.5 py-2 text-left transition hover:bg-[#F8FAFC] disabled:cursor-wait disabled:opacity-80"
    >
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-[#94A3B8]">
          {label}
        </span>
        <span className="mt-0.5 block truncate text-[13px] font-semibold text-[#0A2D62]">{value}</span>
        <span className="mt-0.5 block truncate text-[11px] text-[#94A3B8]">{hint}</span>
      </span>
    </button>
  );
}

function Divider() {
  return <div className="hidden w-px self-stretch bg-[#E8ECF2] lg:block" aria-hidden />;
}

/** Applied criteria from the URL only — single source of truth with summary/filters. */
function stateFromUrl(searchParams: URLSearchParams) {
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

type ResultsSearchBarProps = {
  departureAirports: string[];
};

export function ResultsSearchBar({ departureAirports }: ResultsSearchBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState(() => stateFromUrl(new URLSearchParams(searchParams.toString())));
  const [departureOpen, setDepartureOpen] = useState(false);
  const [durationOpen, setDurationOpen] = useState(false);
  const [travelersOpen, setTravelersOpen] = useState(false);
  const [airportOpen, setAirportOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const suppressDepartureOpenRef = useRef(false);
  const searchStartedRef = useRef(false);

  const searchBusy = isSearching || isPending;
  const showProgressOverlay = useDelayedBusyOverlay(searchBusy, SEARCH_PROGRESS_DELAY_MS);

  useEffect(() => {
    setState(stateFromUrl(new URLSearchParams(searchParams.toString())));
    searchStartedRef.current = false;
    setIsSearching(false);
  }, [searchParams]);

  useEffect(() => {
    saveSharedSearchState({
      selectedCountries: state.selectedCountries,
      departureStart: state.departureStart,
      departureEnd: state.departureEnd,
      flexibilityDays: state.flexibilityDays,
      selectedDurations: state.selectedDurations,
      selectedDepartureAirports: state.selectedDepartureAirports,
      travelers: state.travelers,
    });
  }, [state]);

  const departureDisplay = getDepartureDisplay({
    departureStart: state.departureStart,
    departureEnd: state.departureEnd,
    flexibilityDays: state.flexibilityDays,
  });
  const wanneerValue = departureDisplay.label ?? 'Kies periode';
  const wanneerHint = departureDisplay.hint ?? 'Kies een datum of periode';

  const durationLabel = formatSelectedDurationsLabel(state.selectedDurations);
  const durationValue = durationLabel;

  const searchHref = useMemo(() => {
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
    // Preserve non-duration filter params from current URL (no new filter logic)
    const preserve = [
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
    ];
    for (const key of preserve) {
      const value = searchParams.get(key);
      if (value) params.set(key, value);
    }
    // Duration: only `nights` when consciously selected — never pollute with nightsMin/Max
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
    if (occupancySearchParamsChanged(searchParams, params)) {
      params.delete('page1Ids');
    } else {
      applyFilterNavigationPaging(params, {
        preservePage1Ids: true,
        liveQuery: typeof window === 'undefined' ? undefined : window.location.search,
      });
    }
    return `/results?${params.toString()}`;
  }, [searchParams, state]);

  function runSearch() {
    if (searchStartedRef.current || searchBusy) {
      return;
    }
    searchStartedRef.current = true;
    setIsSearching(true);
    startTransition(() => {
      router.push(searchHref);
    });
  }

  return (
    <>
      <div className="rounded-[16px] bg-white p-1 shadow-[0_10px_28px_rgba(10,45,98,0.12)] ring-1 ring-black/[0.04]">
        <div className="flex flex-col lg:flex-row lg:items-stretch">
          <div className="flex min-w-0 flex-1 flex-col divide-y divide-[#EEF2F6] lg:flex-row lg:divide-x lg:divide-y-0">
            <FieldButton
              label="Wanneer"
              value={wanneerValue}
              hint={wanneerHint}
              icon={<CalendarIcon />}
              disabled={searchBusy}
              onClick={() => {
                if (!suppressDepartureOpenRef.current) setDepartureOpen(true);
              }}
            />
            <Divider />
            <FieldButton
              label="Hoe lang"
              value={durationValue}
              hint="Flexibel"
              icon={<DurationIcon />}
              disabled={searchBusy}
              onClick={() => setDurationOpen(true)}
            />
            <Divider />
            <FieldButton
              label="Reizigers"
              value={formatTravelersLabel(state.travelers)}
              hint={formatRoomsLabel(state.travelers)}
              icon={<TravelersIcon />}
              disabled={searchBusy}
              onClick={() => setTravelersOpen(true)}
            />
            <Divider />
            <FieldButton
              label="Luchthaven"
              value={formatSelectedDepartureAirportsLabel(state.selectedDepartureAirports)}
              hint="Flexibel"
              icon={<PlaneIcon />}
              disabled={searchBusy}
              onClick={() => setAirportOpen(true)}
            />
          </div>

          <button
            type="button"
            onClick={runSearch}
            disabled={searchBusy}
            aria-busy={searchBusy}
            className="mt-1 inline-flex h-11 shrink-0 items-center justify-center rounded-[12px] px-6 text-[14px] font-semibold text-white transition disabled:cursor-wait disabled:opacity-80 lg:mt-0 lg:h-auto lg:min-w-[104px] lg:self-stretch lg:rounded-[12px]"
            style={{ backgroundColor: RESULTS_CTA }}
            onMouseEnter={(e) => {
              if (searchBusy) return;
              e.currentTarget.style.backgroundColor = RESULTS_CTA_HOVER;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = RESULTS_CTA;
            }}
          >
            {searchBusy ? 'Zoeken…' : 'Zoeken'}
          </button>
        </div>
      </div>

      {showProgressOverlay ? <SearchProgressOverlay /> : null}

      <DeparturePeriodPopup
        open={departureOpen}
        startDate={state.departureStart}
        endDate={state.departureEnd}
        flexibilityDays={state.flexibilityDays}
        onClose={() => {
          suppressDepartureOpenRef.current = true;
          setDepartureOpen(false);
          window.setTimeout(() => {
            suppressDepartureOpenRef.current = false;
          }, 100);
        }}
        onChange={(start, end, flexibility) => {
          setState((prev) => ({
            ...prev,
            departureStart: start,
            departureEnd: end,
            flexibilityDays: flexibility !== undefined ? flexibility : prev.flexibilityDays,
          }));
        }}
      />

      <DurationPopup
        open={durationOpen}
        selectedDurations={state.selectedDurations}
        onClose={() => setDurationOpen(false)}
        onChange={(next) => {
          setState((prev) => ({ ...prev, selectedDurations: next }));
        }}
      />

      <TravelersPopup
        open={travelersOpen}
        travelers={state.travelers}
        onClose={() => setTravelersOpen(false)}
        onChange={(next) => {
          setState((prev) => ({ ...prev, travelers: next }));
        }}
      />

      <DepartureAirportPopup
        open={airportOpen}
        airports={departureAirports}
        selectedAirports={state.selectedDepartureAirports}
        onClose={() => setAirportOpen(false)}
        onChange={(next) => {
          setState((prev) => ({ ...prev, selectedDepartureAirports: next }));
        }}
      />
    </>
  );
}
