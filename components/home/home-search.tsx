'use client';

import { CalendarIcon, DurationIcon, LocationIcon, TravelersIcon } from '@/components/home/home-search-icons';
import { DestinationPopup } from '@/components/search/destination-popup/destination-popup';
import { formatSelectedCountriesLabel } from '@/components/search/destination-popup/destination-popup-utils';
import Link from 'next/link';
import { useMemo, useState, type ReactNode } from 'react';

const DURATION_OPTIONS = [
  { label: 'Hoe lang wil je weg?', nightsMin: 7, nightsMax: 12, placeholder: true },
  { label: '5-7 dagen', nightsMin: 5, nightsMax: 7, placeholder: false },
  { label: '7-9 dagen', nightsMin: 7, nightsMax: 9, placeholder: false },
  { label: '8-12 dagen', nightsMin: 8, nightsMax: 12, placeholder: false },
  { label: '10-14 dagen', nightsMin: 10, nightsMax: 14, placeholder: false },
];

function addDays(isoDate: string, days: number): string {
  const date = new Date(isoDate);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function SearchField({
  label,
  icon,
  children,
  className = '',
}: {
  label: string;
  icon: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex min-h-14 min-w-0 flex-1 flex-col justify-center px-4 py-3 lg:h-[72px] lg:px-0 lg:py-0 ${className}`}>
      <span className="text-sm font-semibold text-[#55647A]">{label}</span>
      <div className="mt-1 flex items-center gap-3">
        {icon}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

function Divider() {
  return <div className="hidden h-10 w-px shrink-0 bg-[#E6ECF3] lg:block" aria-hidden="true" />;
}

export function HomeSearch() {
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [popupOpen, setPopupOpen] = useState(false);
  const [departureStart, setDepartureStart] = useState('');
  const [durationIndex, setDurationIndex] = useState(0);
  const [adults, setAdults] = useState(2);

  const duration = DURATION_OPTIONS[durationIndex] ?? DURATION_OPTIONS[0];

  const destinationLabel = selectedCountries.length === 0
    ? 'Waar wil je naartoe?'
    : formatSelectedCountriesLabel(selectedCountries);

  const travelersLabel = adults === 1 ? '1 persoon' : `${adults} personen`;

  const searchHref = useMemo(() => {
    const params = new URLSearchParams({
      adults: adults.toString(),
    });

    if (selectedCountries[0]) {
      params.set('country', selectedCountries[0]);
    }

    if (departureStart) {
      params.set('departureStart', departureStart);
      params.set('departureEnd', addDays(departureStart, duration.nightsMax));
    }

    if (!duration.placeholder) {
      params.set('nightsMin', duration.nightsMin.toString());
      params.set('nightsMax', duration.nightsMax.toString());
    }

    return `/results?${params.toString()}`;
  }, [adults, departureStart, duration, selectedCountries]);

  return (
    <>
      <div className="w-full rounded-2xl bg-white px-4 py-3 shadow-[0_10px_30px_rgba(10,45,98,0.08)] lg:h-[72px] lg:px-6 lg:py-0">
        <div className="flex flex-col gap-3 lg:h-full lg:flex-row lg:items-center lg:gap-0">
          <button
            type="button"
            onClick={() => setPopupOpen(true)}
            className="w-full rounded-xl text-left transition hover:bg-[#F5F7FA] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E66F5] lg:min-w-0 lg:flex-1"
          >
            <SearchField label="Bestemming" icon={<LocationIcon />}>
              <span className={`block truncate text-base ${selectedCountries.length === 0 ? 'text-[#94A3B8]' : 'font-medium text-[#0D1B2A]'}`}>
                {destinationLabel}
              </span>
            </SearchField>
          </button>

          <Divider />

          <SearchField label="Vertrekdatum" icon={<CalendarIcon />}>
            <input
              type="date"
              value={departureStart}
              onChange={(event) => setDepartureStart(event.target.value)}
              placeholder="Kies je vertrekdatum"
              className={`w-full bg-transparent text-base outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E66F5] ${departureStart ? 'font-medium text-[#0D1B2A]' : 'text-[#94A3B8]'}`}
            />
          </SearchField>

          <Divider />

          <SearchField label="Reisduur" icon={<DurationIcon />}>
            <select
              value={durationIndex}
              onChange={(event) => setDurationIndex(Number(event.target.value))}
              className={`w-full cursor-pointer bg-transparent text-base outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E66F5] ${duration.placeholder ? 'text-[#94A3B8]' : 'font-medium text-[#0D1B2A]'}`}
            >
              {DURATION_OPTIONS.map((option, index) => (
                <option key={option.label} value={index}>
                  {option.label}
                </option>
              ))}
            </select>
          </SearchField>

          <Divider />

          <SearchField label="Reisgezelschap" icon={<TravelersIcon />}>
            <select
              value={adults}
              onChange={(event) => setAdults(Number(event.target.value))}
              className="w-full cursor-pointer bg-transparent text-base font-medium text-[#0D1B2A] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E66F5]"
            >
              {[1, 2, 3, 4, 5, 6].map((count) => (
                <option key={count} value={count}>
                  {count === 1 ? '1 persoon' : `${count} personen`}
                </option>
              ))}
            </select>
            <span className="sr-only">{travelersLabel}</span>
          </SearchField>

          <Link
            href={searchHref}
            className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-[#0A2D62] px-7 text-base font-semibold text-white transition hover:-translate-y-px hover:bg-[#082452] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E66F5] lg:ml-4 lg:w-auto lg:shrink-0"
          >
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
