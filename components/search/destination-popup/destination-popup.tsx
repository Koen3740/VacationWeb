'use client';

import { DestinationCountryChip } from '@/components/search/destination-popup/destination-country-chip';
import { DestinationCountryRow } from '@/components/search/destination-popup/destination-country-row';
import '@/components/search/destination-popup/destination-popup.css';
import { destinationPopupPoppins } from '@/components/search/destination-popup/destination-popup-font';
import {
  DestinationCountryOption,
  filterCountriesByQuery,
  loadDestinationCountries,
  loadPopularDestinationCountries,
} from '@/components/search/destination-popup/destination-popup-utils';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type DestinationPopupProps = {
  open: boolean;
  appliedCountries: string[];
  onClose: () => void;
  onApply: (countries: string[]) => void;
};

function SunIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4" fill="#1E88E5" />
      <path stroke="#1E88E5" strokeWidth="2" d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function PalmSectionIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3C10.5 6 8 7.5 5 8c3 1 5 3 5.5 6C8 13 6 11 4 8c2 3 5 5 8 5.5V21h2v-7.5c3-.5 6-2.5 8-5.5-2 3-4 5-6.5 6 .5-3 2.5-5 5.5-6-3-.5-5.5-2-7-5z"
        fill="#1E88E5"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="#6B7280" strokeWidth="2" />
      <path stroke="#6B7280" strokeWidth="2" strokeLinecap="round" d="M20 20l-3.5-3.5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="#111827" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function DestinationSection({
  title,
  icon,
  countries,
  selectedCountries,
  onToggle,
}: {
  title: string;
  icon: ReactNode;
  countries: DestinationCountryOption[];
  selectedCountries: Set<string>;
  onToggle: (name: string) => void;
}) {
  if (countries.length === 0) {
    return null;
  }

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h3 className="text-base font-semibold text-[#1E40AF]">{title}</h3>
      </div>
      <div>
        {countries.map((country) => (
          <DestinationCountryRow
            key={country.name}
            country={country}
            selected={selectedCountries.has(country.name)}
            onToggle={onToggle}
          />
        ))}
      </div>
    </section>
  );
}

export function DestinationPopup({
  open,
  appliedCountries,
  onClose,
  onApply,
}: DestinationPopupProps) {
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState('');
  const [draftSelection, setDraftSelection] = useState<string[]>(appliedCountries);

  const allCountries = useMemo(() => loadDestinationCountries(), []);
  const popularCountries = useMemo(
    () => loadPopularDestinationCountries(allCountries),
    [allCountries],
  );

  const filteredPopular = useMemo(
    () => filterCountriesByQuery(popularCountries, query),
    [popularCountries, query],
  );
  const filteredAll = useMemo(
    () => filterCountriesByQuery(allCountries, query),
    [allCountries, query],
  );

  const selectedSet = useMemo(() => new Set(draftSelection), [draftSelection]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      setDraftSelection(appliedCountries);
      setQuery('');
    }
  }, [appliedCountries, open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose, open]);

  const toggleCountry = (name: string) => {
    setDraftSelection((current) => (
      current.includes(name)
        ? current.filter((entry) => entry !== name)
        : [...current, name]
    ));
  };

  const removeCountry = (name: string) => {
    setDraftSelection((current) => current.filter((entry) => entry !== name));
  };

  if (!mounted || !open) {
    return null;
  }

  return createPortal(
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${destinationPopupPoppins.className}`}>
      <button
        type="button"
        className="absolute inset-0 bg-[rgba(0,0,0,0.4)]"
        aria-label="Sluit bestemmingspopup"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="destination-popup-title"
        className="relative flex h-[640px] w-[600px] flex-col overflow-hidden rounded-xl bg-white p-5 shadow-[0_8px_24px_rgba(0,0,0,0.15)]"
      >
        <div className="flex h-14 shrink-0 items-center justify-between">
          <h2 id="destination-popup-title" className="text-base font-semibold text-[#1E40AF]">
            Bestemming
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center"
            aria-label="Sluiten"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="relative mt-3 shrink-0">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2">
            <SearchIcon />
          </span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Zoek een bestemming..."
            className="h-12 w-full rounded-lg border border-[#D1D5DB] bg-white pl-11 pr-4 text-[15px] text-[#1F2937] outline-none placeholder:text-[#9CA3AF] focus:border-[#D1D5DB]"
          />
        </div>

        {draftSelection.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {draftSelection.map((country) => (
              <DestinationCountryChip
                key={country}
                country={country}
                onRemove={removeCountry}
              />
            ))}
          </div>
        ) : null}

        <div className="destination-popup-scroll mt-5 min-h-0 flex-1 overflow-y-auto">
          <div className="space-y-6">
            <DestinationSection
              title="Populaire bestemmingen"
              icon={<SunIcon />}
              countries={filteredPopular}
              selectedCountries={selectedSet}
              onToggle={toggleCountry}
            />
            <DestinationSection
              title="Alle bestemmingen"
              icon={<PalmSectionIcon />}
              countries={filteredAll}
              selectedCountries={selectedSet}
              onToggle={toggleCountry}
            />
          </div>
        </div>

        <div className="mt-5 flex shrink-0 justify-end">
          <button
            type="button"
            onClick={() => onApply(draftSelection)}
            className="h-11 w-40 rounded-md bg-[#2E7D32] text-sm font-semibold text-white"
          >
            OPSLAAN
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function DestinationPopupPreview() {
  const [open, setOpen] = useState(true);

  return (
    <DestinationPopup
      open={open}
      appliedCountries={['Spanje', 'Italië', 'Marokko']}
      onClose={() => setOpen(false)}
      onApply={() => setOpen(true)}
    />
  );
}
