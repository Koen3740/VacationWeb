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
import Link from 'next/link';
import { useMemo, useRef, useState, type ReactNode } from 'react';

const DURATION_OPTIONS = [
  { label: '5-7 dagen', nightsMin: 5, nightsMax: 7 },
  { label: '7-9 dagen', nightsMin: 7, nightsMax: 9 },
  { label: '8-12 dagen', nightsMin: 8, nightsMax: 12 },
  { label: '10-14 dagen', nightsMin: 10, nightsMax: 14 },
];

const TRAVELER_OPTIONS = [
  { label: '1 persoon', adults: 1 },
  { label: '2 personen', adults: 2 },
  { label: '3 personen', adults: 3 },
  { label: '4 personen', adults: 4 },
  { label: '5 personen', adults: 5 },
  { label: '6 personen', adults: 6 },
];

function addDays(isoDate: string, days: number): string {
  const date = new Date(isoDate);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
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

export function HomeSearch() {
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [popupOpen, setPopupOpen] = useState(false);
  const [departureStart, setDepartureStart] = useState('');
  const [durationIndex, setDurationIndex] = useState<number | null>(null);
  const [travelerIndex, setTravelerIndex] = useState<number | null>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const durationSelectRef = useRef<HTMLSelectElement>(null);
  const travelerSelectRef = useRef<HTMLSelectElement>(null);

  const duration = durationIndex !== null ? DURATION_OPTIONS[durationIndex] : null;
  const travelers = travelerIndex !== null ? TRAVELER_OPTIONS[travelerIndex] : null;

  const destinationText = selectedCountries.length === 0
    ? 'Bestemming'
    : formatSelectedCountriesLabel(selectedCountries);

  const departureText = departureStart ? formatDate(departureStart) : 'Vertrekdatum';
  const durationText = duration ? duration.label : 'Reisduur';
  const travelersText = travelers ? travelers.label : 'Reisgezelschap';

  const searchHref = useMemo(() => {
    const params = new URLSearchParams({
      adults: (travelers?.adults ?? 2).toString(),
    });

    if (selectedCountries[0]) {
      params.set('country', selectedCountries[0]);
    }

    if (departureStart) {
      params.set('departureStart', departureStart);
      params.set('departureEnd', addDays(departureStart, duration?.nightsMax ?? 12));
    }

    if (duration) {
      params.set('nightsMin', duration.nightsMin.toString());
      params.set('nightsMax', duration.nightsMax.toString());
    }

    return `/results?${params.toString()}`;
  }, [departureStart, duration, selectedCountries, travelers]);

  return (
    <>
      <div className="w-full rounded-full bg-white py-1.5 pl-1.5 pr-1.5 shadow-[0_8px_32px_rgba(10,45,98,0.12)] lg:pr-2">
        <div className="flex flex-col gap-1 lg:flex-row lg:items-center lg:gap-0">
          <button
            type="button"
            onClick={() => setPopupOpen(true)}
            className="w-full rounded-full text-left transition hover:bg-[#F8FAFC] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E66F5] lg:min-w-0 lg:flex-1"
          >
            <SearchField displayText={destinationText} icon={<LocationIcon />} />
          </button>

          <Divider />

          <button
            type="button"
            onClick={() => dateInputRef.current?.showPicker?.() ?? dateInputRef.current?.click()}
            className="relative w-full rounded-full text-left transition hover:bg-[#F8FAFC] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E66F5] lg:min-w-0 lg:flex-1"
          >
            <SearchField displayText={departureText} icon={<CalendarIcon />}>
              <input
                ref={dateInputRef}
                type="date"
                value={departureStart}
                onChange={(event) => setDepartureStart(event.target.value)}
                className="pointer-events-none absolute inset-0 opacity-0"
                tabIndex={-1}
                aria-hidden="true"
              />
            </SearchField>
          </button>

          <Divider />

          <div className="relative w-full lg:min-w-0 lg:flex-1">
            <SearchField displayText={durationText} icon={<DurationIcon />} />
            <select
              ref={durationSelectRef}
              value={durationIndex ?? ''}
              onChange={(event) => setDurationIndex(event.target.value === '' ? null : Number(event.target.value))}
              className="absolute inset-0 cursor-pointer opacity-0"
              aria-label="Reisduur"
            >
              <option value="" disabled hidden>
                Reisduur
              </option>
              {DURATION_OPTIONS.map((option, index) => (
                <option key={option.label} value={index}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <Divider />

          <div className="relative w-full lg:min-w-0 lg:flex-1">
            <SearchField displayText={travelersText} icon={<TravelersIcon />} />
            <select
              ref={travelerSelectRef}
              value={travelerIndex ?? ''}
              onChange={(event) => setTravelerIndex(event.target.value === '' ? null : Number(event.target.value))}
              className="absolute inset-0 cursor-pointer opacity-0"
              aria-label="Reisgezelschap"
            >
              <option value="" disabled hidden>
                Reisgezelschap
              </option>
              {TRAVELER_OPTIONS.map((option, index) => (
                <option key={option.label} value={index}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <Link
            href={searchHref}
            className="inline-flex h-12 w-full shrink-0 items-center justify-center gap-2 rounded-full bg-[#0A2D62] px-6 text-sm font-semibold text-white transition hover:bg-[#082452] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E66F5] lg:ml-1 lg:h-14 lg:w-auto lg:px-8"
          >
            <SearchButtonIcon />
            Vakanties zoeken
          </Link>
        </div>
      </div>

      <DestinationPopup
        open={popupOpen}
        appliedCountries={selectedCountries}
        onClose={() => setPopupOpen(false)}
        onApply={(countries) => {
          setSelectedCountries(countries);
          setPopupOpen(false);
        }}
      />
    </>
  );
}
