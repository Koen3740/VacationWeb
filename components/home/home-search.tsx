'use client';

import {
  CalendarIcon,
  DurationIcon,
  LocationIcon,
  PlaneIcon,
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
      className={`flex min-h-[52px] min-w-0 flex-1 items-center gap-2.5 px-3 py-2 lg:h-full lg:min-h-0 lg:px-3.5 ${className}`}
    >
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] font-bold leading-none tracking-tight text-[#0A2D62]">
          {label}
        </span>
        <span
          className={`mt-1 block text-[13.5px] font-medium leading-snug text-[#64748B] ${valueClassName}`}
        >
          {value}
        </span>
        <span className="sr-only">{hint}</span>
      </span>
    </div>
  );
}

function Divider() {
  return <div className="hidden w-px shrink-0 self-stretch bg-[#E0E2E7] lg:block" aria-hidden="true" />;
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
    selectedCountries.length === 0 ? 'Waar wil je naartoe?' : formatSelectedCountriesLabel(selectedCountries);
  const destinationHint =
    selectedCountries.length === 0
      ? 'Land of regio — jij kiest'
      : selectedCountries.length === 1
        ? '1 land'
        : `${selectedCountries.length} landen`;

  const departureDisplay = getDepartureDisplay({
    departureStart,
    departureEnd,
    flexibilityDays,
  });
  const departureValue = departureDisplay.label ?? 'Data flexibel';
  const departureHint = departureDisplay.hint ?? 'Datum of periode';

  const durationValue =
    selectedDurations.length === 0
      ? '7–14 nachten'
      : formatSelectedDurationsLabel(selectedDurations);
  const airportRaw = formatSelectedDepartureAirportsLabel(selectedDepartureAirports);
  const airportValue =
    selectedDepartureAirports.length === 0 || airportRaw === 'Alle luchthavens' || airportRaw === 'Luchthaven'
      ? 'Vanaf Amsterdam'
      : airportRaw;
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
      <div className="mx-auto box-border w-[80vw] rounded-[16px] bg-[#FEFAF6] p-1 shadow-[0_12px_32px_rgba(10,45,98,0.12)] ring-1 ring-black/[0.06] lg:h-[98px] lg:min-h-[98px] lg:p-1">
        <div className="flex flex-col gap-0 lg:h-full lg:flex-row lg:items-stretch">
          <div className="flex min-w-0 flex-1 flex-col divide-y divide-[#E0E2E7] lg:h-full lg:flex-row lg:divide-x lg:divide-y-0 lg:divide-[#E0E2E7]">
            <button
              type="button"
              onClick={() => setDestinationPopupOpen(true)}
              className={`${fieldButtonClass} lg:flex-1`}
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
              className={`${fieldButtonClass} lg:flex-1`}
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
                label="Duur"
                value={durationValue}
                hint="Bijv. 7–14 nachten"
                icon={<DurationIcon />}
              />
            </button>

            <Divider />

            <button
              type="button"
              onClick={() => setAirportPopupOpen(true)}
              className={`${fieldButtonClass} lg:flex-1`}
            >
              <SearchField
                label="Luchthaven"
                value={airportValue}
                hint="Vanaf Amsterdam"
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

          <div className="flex shrink-0 items-center p-1 lg:h-full lg:pl-2">
            <button
              type="button"
              onClick={handleSearch}
              disabled={searchBusy}
              aria-busy={searchBusy}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[12px] bg-[#3779B3] px-5 text-[13.5px] font-semibold text-white transition hover:bg-[#2F6A9E] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3779B3] disabled:cursor-wait disabled:opacity-80 lg:h-[56px] lg:w-[250px] lg:min-w-[250px] lg:px-4"
            >
              {searchBusy ? 'Zoeken…' : (<>Vakanties vergelijken <span aria-hidden>→</span></>)}
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
