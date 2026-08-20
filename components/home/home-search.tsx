'use client';

import {
  CalendarIcon,
  ChevronDownIcon,
  DurationIcon,
  LocationIcon,
  SearchButtonIcon,
  TravelersIcon,
} from '@/components/home/home-search-icons';
import { DestinationPopup } from '@/components/search/destination-popup/destination-popup';
import { formatSelectedCountriesLabel } from '@/components/search/destination-popup/destination-popup-utils';
import {
  DeparturePeriodPopup,
  type FlexibilityDays,
} from '@/components/search/departure-period-popup/departure-period-popup';
import { DurationPopup } from '@/components/search/duration-popup/duration-popup';
import { formatSelectedDurationsLabel } from '@/components/search/duration-popup/duration-popup-utils';
import { SearchProgressOverlay } from '@/components/search/search-progress-feedback';
import {
  buildResultsHref,
  createDefaultSharedSearchState,
  loadSharedSearchState,
  saveSharedSearchState,
} from '@/components/search/shared-search-state';
import { TravelersPopup } from '@/components/search/travelers-popup/travelers-popup';
import {
  createDefaultTravelersState,
  formatTravelersLabel,
  type TravelersState,
} from '@/components/search/travelers-popup/travelers-popup-utils';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react';

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getInitialHomeSearchState() {
  const shared = loadSharedSearchState();
  if (!shared) {
    return createDefaultSharedSearchState();
  }

  return shared;
}

function SearchField({
  displayText,
  icon,
  children,
  className = '',
}: {
  displayText: string;
  icon: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative flex min-w-0 flex-1 items-center gap-3 px-4 py-3 lg:px-5 lg:py-4 ${className}`}>
      {icon}
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#0A2D62]">{displayText}</span>
      {children}
      <ChevronDownIcon />
    </div>
  );
}

function Divider() {
  return <div className="hidden h-10 w-px shrink-0 bg-[#E2E8F0] lg:block" aria-hidden="true" />;
}

type HomeSearchProps = {
  countryCounts: Record<string, number>;
  totalOffersLabel: string;
};

export function HomeSearch({ countryCounts, totalOffersLabel }: HomeSearchProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const initialState = getInitialHomeSearchState();
  const [selectedCountries, setSelectedCountries] = useState<string[]>(initialState.selectedCountries);
  const [destinationPopupOpen, setDestinationPopupOpen] = useState(false);
  const [departurePopupOpen, setDeparturePopupOpen] = useState(false);
  const [departureStart, setDepartureStart] = useState<string | null>(initialState.departureStart);
  const [departureEnd, setDepartureEnd] = useState<string | null>(initialState.departureEnd);
  const [flexibilityDays, setFlexibilityDays] = useState<FlexibilityDays>(initialState.flexibilityDays);
  const [selectedDurations, setSelectedDurations] = useState<number[]>(initialState.selectedDurations);
  const [durationPopupOpen, setDurationPopupOpen] = useState(false);
  const [travelers, setTravelers] = useState<TravelersState>(
    () => initialState.travelers ?? createDefaultTravelersState(),
  );
  const [travelersPopupOpen, setTravelersPopupOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const suppressDepartureOpenRef = useRef(false);
  const searchStartedRef = useRef(false);

  const searchBusy = isSearching || isPending;

  useEffect(() => {
    saveSharedSearchState({
      selectedCountries,
      departureStart,
      departureEnd,
      flexibilityDays,
      selectedDurations,
      selectedDepartureAirports: [],
      travelers,
    });
  }, [
    departureEnd,
    departureStart,
    flexibilityDays,
    selectedCountries,
    selectedDurations,
    travelers,
  ]);

  const destinationText =
    selectedCountries.length === 0 ? 'Bestemming' : formatSelectedCountriesLabel(selectedCountries);

  const departureText = departureStart
    ? departureEnd
      ? `${formatDate(departureStart)} – ${formatDate(departureEnd)}`
      : formatDate(departureStart)
    : 'Vertrekdatum';
  const durationText = formatSelectedDurationsLabel(selectedDurations);
  const travelersText = formatTravelersLabel(travelers);

  const searchHref = useMemo(
    () =>
      buildResultsHref({
        selectedCountries,
        departureStart,
        departureEnd,
        flexibilityDays,
        selectedDurations,
        selectedDepartureAirports: [],
        travelers,
      }),
    [
      departureEnd,
      departureStart,
      flexibilityDays,
      selectedDurations,
      selectedCountries,
      travelers,
    ],
  );

  const openDeparturePopup = () => {
    if (suppressDepartureOpenRef.current) {
      return;
    }
    setDeparturePopupOpen(true);
  };

  const closeDeparturePopup = () => {
    suppressDepartureOpenRef.current = true;
    setDeparturePopupOpen(false);
    window.setTimeout(() => {
      suppressDepartureOpenRef.current = false;
    }, 100);
  };

  const openDurationPopup = () => {
    setDurationPopupOpen(true);
  };

  const handleSearch = () => {
    if (searchStartedRef.current || searchBusy) {
      return;
    }
    searchStartedRef.current = true;
    setIsSearching(true);
    startTransition(() => {
      router.push(searchHref);
    });
  };

  return (
    <>
      <div className="w-full rounded-full bg-white py-1.5 pl-1.5 pr-1.5 shadow-[0_8px_32px_rgba(10,45,98,0.12)] lg:pr-2">
        <div className="flex flex-col gap-1 lg:flex-row lg:items-center lg:gap-0">
          <button
            type="button"
            onClick={() => setDestinationPopupOpen(true)}
            className="w-full rounded-full text-left transition hover:bg-[#F8FAFC] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E66F5] lg:min-w-0 lg:flex-1"
          >
            <SearchField displayText={destinationText} icon={<LocationIcon />} />
          </button>

          <Divider />

          <button
            type="button"
            onClick={openDeparturePopup}
            className="w-full rounded-full text-left transition hover:bg-[#F8FAFC] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E66F5] lg:min-w-0 lg:flex-1"
          >
            <SearchField displayText={departureText} icon={<CalendarIcon />} />
          </button>

          <Divider />

          <button
            type="button"
            onClick={openDurationPopup}
            className="w-full rounded-full text-left transition hover:bg-[#F8FAFC] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E66F5] lg:min-w-0 lg:flex-1"
          >
            <SearchField displayText={durationText} icon={<DurationIcon />} />
          </button>

          <Divider />

          <button
            type="button"
            onClick={() => setTravelersPopupOpen(true)}
            className="w-full rounded-full text-left transition hover:bg-[#F8FAFC] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E66F5] lg:min-w-0 lg:flex-1"
          >
            <SearchField displayText={travelersText} icon={<TravelersIcon />} />
          </button>

          <button
            type="button"
            onClick={handleSearch}
            disabled={searchBusy}
            aria-busy={searchBusy}
            className="inline-flex h-12 w-full shrink-0 items-center justify-center gap-2 rounded-full bg-[#0A2D62] px-6 text-sm font-semibold text-white transition hover:bg-[#082452] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E66F5] disabled:cursor-wait disabled:opacity-80 lg:ml-1 lg:h-14 lg:w-auto lg:px-8"
          >
            <SearchButtonIcon />
            {searchBusy ? 'Zoeken…' : 'Vakanties zoeken'}
          </button>
        </div>
      </div>

      {searchBusy ? <SearchProgressOverlay /> : null}

      <DestinationPopup
        open={destinationPopupOpen}
        appliedCountries={selectedCountries}
        countryCounts={countryCounts}
        totalOffersLabel={totalOffersLabel}
        onClose={() => setDestinationPopupOpen(false)}
        onApply={(countries) => {
          setSelectedCountries(countries);
          setDestinationPopupOpen(false);
        }}
      />

      <DeparturePeriodPopup
        open={departurePopupOpen}
        startDate={departureStart}
        endDate={departureEnd}
        flexibilityDays={flexibilityDays}
        onClose={closeDeparturePopup}
        onChange={(start, end, flexibility) => {
          setDepartureStart(start);
          setDepartureEnd(end);
          if (flexibility !== undefined) {
            setFlexibilityDays(flexibility);
          }
        }}
      />

      <DurationPopup
        open={durationPopupOpen}
        selectedDurations={selectedDurations}
        onClose={() => setDurationPopupOpen(false)}
        onChange={setSelectedDurations}
      />

      <TravelersPopup
        open={travelersPopupOpen}
        travelers={travelers}
        onClose={() => setTravelersPopupOpen(false)}
        onChange={setTravelers}
      />
    </>
  );
}
