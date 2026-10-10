'use client';

import {
  CalendarIcon,
  DurationIcon,
  TravelersIcon,
} from '@/components/home/home-search-icons';
import { DeparturePeriodPopup } from '@/components/search/departure-period-popup/departure-period-popup';
import { DurationPopup } from '@/components/search/duration-popup/duration-popup';
import { DepartureAirportPopup } from '@/components/search/departure-airport-popup/departure-airport-popup';
import { formatSelectedDepartureAirportsLabel } from '@/components/search/departure-airport-popup/departure-airport-popup-utils';
import { formatSelectedDurationsLabel } from '@/components/search/duration-popup/duration-popup-utils';
import { saveSharedSearchState } from '@/components/search/shared-search-state';
import { TravelersPopup } from '@/components/search/travelers-popup/travelers-popup';
import {
  formatRoomsLabel,
  formatTravelersLabel,
  isTravelersStateComplete,
} from '@/components/search/travelers-popup/travelers-popup-utils';
import { getDepartureDisplay } from '@/components/search/departure-display';
import {
  buildResultsBarHref,
  resultsQueryEqual,
  stateFromUrl,
  type ResultsBarSearchState,
} from '@/components/results-v2/results-search-bar-utils';
import { useReportResultsNavigationBusy } from '@/components/results/results-navigation-busy';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react';

export {
  buildResultsBarHref,
  resultsQueryEqual,
  stateFromUrl,
  type ResultsBarSearchState,
} from '@/components/results-v2/results-search-bar-utils';

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
      className="flex min-h-[52px] min-w-0 flex-1 items-center gap-3 border-[#efe9de] px-3 py-2 text-left transition hover:bg-[#fbf8f2] disabled:cursor-wait disabled:opacity-80 max-[900px]:border-b max-[900px]:border-r max-[900px]:[&:nth-child(2n)]:border-r-0 max-[900px]:[&:nth-child(n+3)]:border-b-0 min-[901px]:min-h-0 min-[901px]:border-r min-[901px]:px-[18px] min-[901px]:py-[11px] min-[901px]:last:border-r-0"
    >
      <span className="shrink-0 text-[#8a93a3] max-[900px]:hidden">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-semibold uppercase tracking-[0.07em] text-[#98a1b2]">
          {label}
        </span>
        <span className="block truncate text-[14px] font-semibold text-vw-navy">{value}</span>
        <span className="block truncate text-[11.5px] text-[#a0a8b6] max-[900px]:hidden">{hint}</span>
      </span>
    </button>
  );
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
  const navigationLockRef = useRef(false);
  const pendingApplyRef = useRef<ResultsBarSearchState | null>(null);
  const stateRef = useRef(state);

  stateRef.current = state;

  // Owner 25-09 23:03: no fullscreen loading overlay in the Results flow; busy only drives this control.
  const searchBusy = isSearching || isPending;
  useReportResultsNavigationBusy(searchBusy);

  useEffect(() => {
    const synced = stateFromUrl(new URLSearchParams(searchParams.toString()));
    setState(synced);
    stateRef.current = synced;
    navigationLockRef.current = false;
    setIsSearching(false);

    const pending = pendingApplyRef.current;
    if (!pending) {
      return;
    }
    pendingApplyRef.current = null;
    const href = buildResultsBarHref(pending, new URLSearchParams(searchParams.toString()), {
      liveQuery: typeof window === 'undefined' ? undefined : window.location.search,
    });
    const currentHref = `/results?${searchParams.toString()}`;
    if (resultsQueryEqual(href, currentHref)) {
      return;
    }
    navigationLockRef.current = true;
    setIsSearching(true);
    startTransition(() => {
      router.replace(href, { scroll: false });
    });
  }, [searchParams, router]);

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

  function applyBarState(next: ResultsBarSearchState) {
    if (navigationLockRef.current || searchBusy) {
      // Keep the latest commit; flush after the in-flight URL update settles.
      pendingApplyRef.current = next;
      return;
    }

    const href = buildResultsBarHref(next, new URLSearchParams(searchParams.toString()), {
      liveQuery: typeof window === 'undefined' ? undefined : window.location.search,
    });
    const currentHref = `/results?${searchParams.toString()}`;
    if (resultsQueryEqual(href, currentHref)) {
      pendingApplyRef.current = null;
      return;
    }

    navigationLockRef.current = true;
    setIsSearching(true);
    startTransition(() => {
      router.replace(href, { scroll: false });
    });
  }

  /** Commit after a multi-step popup closes (travelers / departure). */
  function applyAfterPopupClose() {
    // DEC-019: a child without an age is not a searchable party; keep the current results.
    if (!isTravelersStateComplete(stateRef.current.travelers)) {
      return;
    }
    applyBarState(stateRef.current);
  }

  return (
    <>
      <div className="overflow-hidden rounded-vw-panel border border-vw-line bg-white shadow-vw-search">
        <div className="flex items-stretch">
          <div className="grid min-w-0 flex-1 grid-cols-2 min-[901px]:flex min-[901px]:flex-row">
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
            <FieldButton
              label="Hoe lang"
              value={durationValue}
              hint="Flexibel"
              icon={<DurationIcon />}
              disabled={searchBusy}
              onClick={() => setDurationOpen(true)}
            />
            <FieldButton
              label="Reizigers"
              value={formatTravelersLabel(state.travelers)}
              hint={formatRoomsLabel(state.travelers)}
              icon={<TravelersIcon />}
              disabled={searchBusy}
              onClick={() => setTravelersOpen(true)}
            />
            <FieldButton
              label="Luchthaven"
              value={formatSelectedDepartureAirportsLabel(state.selectedDepartureAirports)}
              hint="Flexibel"
              icon={<PlaneIcon />}
              disabled={searchBusy}
              onClick={() => setAirportOpen(true)}
            />
          </div>
        </div>
      </div>

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
            applyAfterPopupClose();
          }, 100);
        }}
        onChange={(start, end, flexibility) => {
          // Draft only while open — apply when the popup closes (complete selection / confirm).
          setState((prev) => {
            const next = {
              ...prev,
              departureStart: start,
              departureEnd: end,
              flexibilityDays: flexibility !== undefined ? flexibility : prev.flexibilityDays,
            };
            stateRef.current = next;
            return next;
          });
        }}
      />

      <DurationPopup
        open={durationOpen}
        selectedDurations={state.selectedDurations}
        onClose={() => setDurationOpen(false)}
        onChange={(next) => {
          // OPSLAAN commits a complete selection — auto-apply immediately.
          const nextState = { ...stateRef.current, selectedDurations: next };
          stateRef.current = nextState;
          setState(nextState);
          applyBarState(nextState);
        }}
      />

      <TravelersPopup
        open={travelersOpen}
        travelers={state.travelers}
        onClose={() => {
          setTravelersOpen(false);
          // Multi-step edits apply once when the popup closes.
          window.setTimeout(() => {
            applyAfterPopupClose();
          }, 0);
        }}
        onChange={(next) => {
          const nextState = { ...stateRef.current, travelers: next };
          stateRef.current = nextState;
          setState(nextState);
        }}
      />

      <DepartureAirportPopup
        open={airportOpen}
        airports={departureAirports}
        selectedAirports={state.selectedDepartureAirports}
        onClose={() => setAirportOpen(false)}
        onChange={(next) => {
          // OPSLAAN commits a complete selection — auto-apply immediately.
          const nextState = { ...stateRef.current, selectedDepartureAirports: next };
          stateRef.current = nextState;
          setState(nextState);
          applyBarState(nextState);
        }}
      />
    </>
  );
}
