'use client';

import {
  CalendarIcon,
  DurationIcon,
  LocationIcon,
  PlaneIcon,
  SearchButtonIcon,
  TravelersIcon,
} from '@/components/home/home-search-icons';
import { DepartureAirportPopup } from '@/components/search/departure-airport-popup/departure-airport-popup';
import { formatSelectedDepartureAirportsLabel } from '@/components/search/departure-airport-popup/departure-airport-popup-utils';
import { DestinationPopup } from '@/components/search/destination-popup/destination-popup';
import { formatSelectedCountriesLabel } from '@/components/search/destination-popup/destination-popup-utils';
import {
  DeparturePeriodPopup,
  type FlexibilityDays,
} from '@/components/search/departure-period-popup/departure-period-popup';
import { getDepartureDisplay } from '@/components/search/departure-display';
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
  formatRoomsLabel,
  formatTravelersLabel,
  type TravelersState,
} from '@/components/search/travelers-popup/travelers-popup-utils';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react';

function getInitialHomeSearchState() {
  const shared = loadSharedSearchState();
  if (!shared) {
    return createDefaultSharedSearchState();
  }

  return shared;
}

/**
 * Homepage field chrome aligned with ResultsSearchBar FieldButton
 * (label / value / hint hierarchy, height, padding, icon gap).
 */
function SearchField({
  label,
  value,
  hint,
  icon,
  className = '',
  valueClassName = '',
}: {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
  className?: string;
  /** Extra classes for the value line (e.g. date segment: never ellipsize on desktop). */
  valueClassName?: string;
}) {
  return (
    <div
      className={`flex min-h-[60px] min-w-0 flex-1 items-center gap-2.5 px-3.5 py-2 ${className}`}
    >
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-[#94A3B8]">
          {label}
        </span>
        <span
          className={`mt-0.5 block text-[13px] font-semibold leading-snug text-[#0A2D62] ${valueClassName}`}
        >
          {value}
        </span>
        <span className="mt-0.5 block text-[11px] leading-snug text-[#94A3B8]">{hint}</span>
      </span>
    </div>
  );
}

function Divider() {
  return <div className="hidden w-px shrink-0 self-stretch bg-[#E8ECF2] lg:block" aria-hidden="true" />;
}

type HomeSearchProps = {
  countryCounts: Record<string, number>;
  departureAirports: string[];
  totalOffersLabel: string;
};

export function HomeSearch({ countryCounts, departureAirports, totalOffersLabel }: HomeSearchProps) {
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
  const [selectedDepartureAirports, setSelectedDepartureAirports] = useState<string[]>(
    initialState.selectedDepartureAirports,
  );
  const [airportPopupOpen, setAirportPopupOpen] = useState(false);
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
      selectedDepartureAirports,
      travelers,
    });
  }, [
    departureEnd,
    departureStart,
    flexibilityDays,
    selectedCountries,
    selectedDepartureAirports,
    selectedDurations,
    travelers,
  ]);

  const destinationValue =
    selectedCountries.length === 0 ? 'Kies bestemming' : formatSelectedCountriesLabel(selectedCountries);
  const destinationHint =
    selectedCountries.length === 0
      ? 'Land of regio'
      : selectedCountries.length === 1
        ? '1 land'
        : `${selectedCountries.length} landen`;

  const departureDisplay = getDepartureDisplay({
    departureStart,
    departureEnd,
    flexibilityDays,
  });
  const departureValue = departureDisplay.label ?? 'Kies periode';
  const departureHint = departureDisplay.hint ?? 'Kies een datum of periode';

  const durationValue = formatSelectedDurationsLabel(selectedDurations);
  const airportValue = formatSelectedDepartureAirportsLabel(selectedDepartureAirports);
  const travelersValue = formatTravelersLabel(travelers);
  const travelersHint = formatRoomsLabel(travelers);

  const searchHref = useMemo(
    () =>
      buildResultsHref({
        selectedCountries,
        departureStart,
        departureEnd,
        flexibilityDays,
        selectedDurations,
        selectedDepartureAirports,
        travelers,
      }),
    [
      departureEnd,
      departureStart,
      flexibilityDays,
      selectedDepartureAirports,
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

  const fieldButtonClass =
    'w-full text-left transition hover:bg-[#F8FAFC] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E66F5] lg:min-w-0';

  return (
    <>
      <div className="rounded-[16px] bg-white p-1 shadow-[0_10px_28px_rgba(10,45,98,0.12)] ring-1 ring-black/[0.04]">
        <div className="flex flex-col gap-0 lg:flex-row lg:items-stretch">
          <div className="flex min-w-0 flex-1 flex-col divide-y divide-[#EEF2F6] lg:flex-row lg:divide-x lg:divide-y-0">
            <button
              type="button"
              onClick={() => setDestinationPopupOpen(true)}
              className={`${fieldButtonClass} lg:flex-[1.05]`}
            >
              <SearchField
                label="Bestemming"
                value={destinationValue}
                hint={destinationHint}
                icon={<LocationIcon />}
              />
            </button>

            <Divider />

            <button
              type="button"
              onClick={openDeparturePopup}
              className={`${fieldButtonClass} lg:min-w-[11.5rem] lg:flex-[1.45]`}
            >
              <SearchField
                label="Wanneer"
                value={departureValue}
                hint={departureHint}
                icon={<CalendarIcon />}
                // Desktop: full period visible (no ellipsis). Mobile may wrap rather than clip.
                valueClassName="whitespace-normal sm:whitespace-nowrap"
              />
            </button>

            <Divider />

            <button
              type="button"
              onClick={openDurationPopup}
              className={`${fieldButtonClass} lg:flex-1`}
            >
              <SearchField
                label="Reisduur"
                value={durationValue}
                hint="Flexibel"
                icon={<DurationIcon />}
              />
            </button>

            <Divider />

            <button
              type="button"
              onClick={() => setAirportPopupOpen(true)}
              className={`${fieldButtonClass} lg:min-w-[9rem] lg:flex-[1.15]`}
            >
              <SearchField
                label="Luchthaven"
                value={airportValue}
                hint="Flexibel"
                icon={<PlaneIcon />}
                valueClassName="whitespace-normal sm:whitespace-nowrap"
              />
            </button>

            <Divider />

            <button
              type="button"
              onClick={() => setTravelersPopupOpen(true)}
              className={`${fieldButtonClass} lg:flex-1`}
            >
              <SearchField
                label="Reizigers"
                value={travelersValue}
                hint={travelersHint}
                icon={<TravelersIcon />}
              />
            </button>
          </div>

          <div className="flex shrink-0 items-center p-1 lg:pl-2">
            <button
              type="button"
              onClick={handleSearch}
              disabled={searchBusy}
              aria-busy={searchBusy}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[12px] bg-[#0A2D62] px-6 text-sm font-semibold text-white transition hover:bg-[#082452] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E66F5] disabled:cursor-wait disabled:opacity-80 lg:h-[52px] lg:w-auto lg:min-w-[11.5rem] lg:px-7"
            >
              <SearchButtonIcon />
              {searchBusy ? 'Zoeken…' : 'Vakanties zoeken'}
            </button>
          </div>
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

      <DepartureAirportPopup
        open={airportPopupOpen}
        airports={departureAirports}
        selectedAirports={selectedDepartureAirports}
        onClose={() => setAirportPopupOpen(false)}
        onChange={setSelectedDepartureAirports}
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
