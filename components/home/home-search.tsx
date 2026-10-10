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
  formatPlaceSelectionLabel,
  placeSelectionFromState,
  type DestinationPlaceSelection,
} from '@/components/search/destination-popup/destination-search';
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
  isTravelersStateComplete,
  type TravelersState,
} from '@/components/search/travelers-popup/travelers-popup-utils';
import { requestHomeLivePricePrefetch } from '@/components/home/home-live-price-prefetch-client';
import { useChromeCopy } from '@/components/i18n/ui-language-provider';
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
      className={`flex min-h-[52px] min-w-0 flex-1 items-center gap-2.5 px-3.5 py-2.5 lg:h-full lg:min-h-[68px] lg:px-4 ${className}`}
    >
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold uppercase leading-none tracking-[0.12em] text-white/80">
          {label}
        </span>
        <span
          className={`mt-1 block overflow-hidden text-ellipsis text-[15px] font-medium leading-snug text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.25)] ${valueClassName}`}
        >
          {value}
        </span>
        <span className="sr-only">{hint}</span>
      </span>
    </div>
  );
}

function Divider() {
  return <div className="hidden w-px shrink-0 self-stretch bg-white/30 lg:block" aria-hidden="true" />;
}

type HomeSearchProps = {
  countryCounts: Record<string, number>;
  departureAirports: string[];
  totalOffersLabel: string;
  /** AN-077 — server-resolved `HOME_LIVE_PRICE_PREFETCH_ENABLED` (default off). */
  livePricePrefetchEnabled?: boolean;
};

export function HomeSearch({
  countryCounts,
  departureAirports,
  totalOffersLabel,
  livePricePrefetchEnabled = false,
}: HomeSearchProps) {
  const router = useRouter();
  const t = useChromeCopy().search;
  const [isPending, startTransition] = useTransition();
  const initialState = getInitialHomeSearchState();
  const [selectedCountries, setSelectedCountries] = useState<string[]>(initialState.selectedCountries);
  const [selectedPlace, setSelectedPlace] = useState<DestinationPlaceSelection | null>(() =>
    placeSelectionFromState(initialState.selectedCountries, initialState.region, initialState.city),
  );
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

  const sharedState = useMemo(
    () => ({
      selectedCountries,
      ...(selectedPlace?.region ? { region: selectedPlace.region } : {}),
      ...(selectedPlace?.city ? { city: selectedPlace.city } : {}),
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
      selectedCountries,
      selectedDepartureAirports,
      selectedDurations,
      selectedPlace,
      travelers,
    ],
  );

  const popupsOpen =
    destinationPopupOpen ||
    departurePopupOpen ||
    durationPopupOpen ||
    airportPopupOpen ||
    travelersPopupOpen;

  useEffect(() => {
    saveSharedSearchState(sharedState);
  }, [sharedState]);

  // AN-077: fire-and-forget live-price prefetch when context is definitive and settled.
  useEffect(() => {
    requestHomeLivePricePrefetch(sharedState, {
      enabled: livePricePrefetchEnabled,
      popupsOpen,
    });
  }, [livePricePrefetchEnabled, popupsOpen, sharedState]);

  const destinationValue =
    selectedCountries.length === 0
      ? t.destinationPlaceholder
      : selectedPlace
        ? formatPlaceSelectionLabel(selectedPlace)
        : formatSelectedCountriesLabel(selectedCountries);
  const destinationHint =
    selectedCountries.length === 0
      ? t.destinationHintEmpty
      : selectedPlace
        ? t.oneDestination
        : selectedCountries.length === 1
          ? t.oneCountry
          : t.countries(selectedCountries.length);

  const departureDisplay = getDepartureDisplay({
    departureStart,
    departureEnd,
    flexibilityDays,
  });
  const departureValue = departureDisplay.label ?? t.whenDefault;
  const departureHint = departureDisplay.hint ?? t.whenHint;

  // No selection = no `nights` filter (internal URL semantics); it is never presented as a choice,
  // so the field shows a neutral placeholder. `nights` is in trip days for all providers.
  const durationValue =
    selectedDurations.length === 0 ? t.durationPlaceholder : formatSelectedDurationsLabel(selectedDurations);
  const airportValue = formatSelectedDepartureAirportsLabel(selectedDepartureAirports);
  const travelersValue = formatTravelersLabel(travelers);
  const travelersHint = formatRoomsLabel(travelers);

  const searchHref = useMemo(
    () =>
      buildResultsHref({
        selectedCountries,
        ...(selectedPlace?.region ? { region: selectedPlace.region } : {}),
        ...(selectedPlace?.city ? { city: selectedPlace.city } : {}),
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
      selectedPlace,
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
    if (!isTravelersStateComplete(travelers)) {
      // Every child needs an age; let the traveller popup ask for it.
      setTravelersPopupOpen(true);
      return;
    }
    searchStartedRef.current = true;
    setIsSearching(true);
    // Best-effort last chance prefetch; never awaited.
    requestHomeLivePricePrefetch(sharedState, {
      enabled: livePricePrefetchEnabled,
      popupsOpen: false,
    });
    startTransition(() => {
      router.push(searchHref);
    });
  };

  const fieldButtonClass =
    'w-full rounded-[14px] text-left transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white lg:min-w-0 lg:rounded-none lg:hover:bg-white/10';

  return (
    <>
      <div className="vw-glass-search box-border w-full p-1.5 sm:p-2">
        <div className="grid grid-cols-2 gap-1.5 lg:flex lg:items-stretch lg:gap-0">
          <div className="contents">
            <button
              type="button"
              onClick={() => setDestinationPopupOpen(true)}
              className={`${fieldButtonClass} col-span-2 lg:flex-[1.6]`}
            >
              <SearchField
                label={t.destinationLabel}
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
                label={t.whenLabel}
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
                label={t.durationLabel}
                value={durationValue}
                hint={t.durationHint}
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
                label={t.airportLabel}
                value={airportValue}
                hint={t.airportHint}
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
                label={t.travelersLabel}
                value={travelersValue}
                hint={travelersHint}
                icon={<TravelersIcon />}
              />
            </button>
          </div>

          <div className="col-span-2 flex shrink-0 items-center lg:h-auto lg:pl-2">
            <button
              type="button"
              onClick={handleSearch}
              disabled={searchBusy}
              aria-busy={searchBusy}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-white px-6 text-[15.5px] font-semibold text-vw-navy transition hover:-translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-wait disabled:opacity-80 motion-reduce:transform-none lg:h-full lg:w-auto lg:px-7"
            >
              {searchBusy ? t.busy : (<>{t.cta} <span aria-hidden>→</span></>)}
            </button>
          </div>
        </div>
      </div>

      {searchBusy ? <SearchProgressOverlay /> : null}

      <DestinationPopup
        open={destinationPopupOpen}
        appliedCountries={selectedCountries}
        appliedPlace={selectedPlace}
        countryCounts={countryCounts}
        totalOffersLabel={totalOffersLabel}
        onClose={() => setDestinationPopupOpen(false)}
        onApply={(countries, place) => {
          setSelectedCountries(countries);
          setSelectedPlace(place ?? null);
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
