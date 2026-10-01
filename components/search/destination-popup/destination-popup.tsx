'use client';

import { DestinationCountryChip } from '@/components/search/destination-popup/destination-country-chip';
import { DestinationPopupFlag } from '@/components/search/destination-popup/destination-popup-flag';
import { DestinationCountryRow } from '@/components/search/destination-popup/destination-country-row';
import '@/components/search/destination-popup/destination-popup.css';
import { destinationPopupPoppins } from '@/components/search/destination-popup/destination-popup-font';
import {
  DestinationCountryOption,
  filterCountriesByQuery,
  loadDestinationCountries,
  loadPopularDestinationCountries,
} from '@/components/search/destination-popup/destination-popup-utils';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

type DestinationPopupProps = {
  open: boolean;
  appliedCountries: string[];
  countryCounts: Record<string, number>;
  /** Kept for API compatibility; the marketing side panel is no longer rendered in the popup. */
  totalOffersLabel: string;
  onClose: () => void;
  onApply: (countries: string[]) => void;
};

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="#94A3B8" strokeWidth="2" />
      <path stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" d="M20 20l-3.5-3.5" />
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

type DestinationPopupSectionProps = {
  countries: DestinationCountryOption[];
  selectedCountries: Set<string>;
  onToggle: (name: string) => void;
};

/** Variant A: popular destinations as compact toggle chips with a small flag (same selection state as the list). */
function PopularDestinationChips({ countries, selectedCountries, onToggle }: DestinationPopupSectionProps) {
  if (countries.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="destination-popular-title" className="shrink-0">
      <h3 id="destination-popular-title" className="mb-2 text-[12px] font-semibold uppercase tracking-[0.04em] text-[#0A2D62]">
        Populaire bestemmingen
      </h3>
      <div className="flex flex-wrap gap-2" data-testid="destination-popular">
        {countries.map((country) => {
          const selected = selectedCountries.has(country.name);
          return (
            <button
              key={country.name}
              type="button"
              aria-pressed={selected}
              onClick={() => onToggle(country.name)}
              className={`inline-flex h-10 items-center gap-1.5 rounded-full border px-3 text-[13.5px] transition sm:h-8 sm:px-2.5 sm:text-[13px] ${
                selected
                  ? 'border-[#1E40AF] bg-[#1E40AF] text-white'
                  : 'border-[#E0E2E7] bg-white text-[#111827] hover:border-[#93C5FD]'
              }`}
            >
              {selected ? <span aria-hidden="true">✓</span> : <DestinationPopupFlag country={country.name} />}
              {country.name}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function DestinationPopup({
  open,
  appliedCountries,
  countryCounts,
  onClose,
  onApply,
}: DestinationPopupProps) {
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState('');
  const [draftSelection, setDraftSelection] = useState<string[]>(appliedCountries);

  const allCountries = useMemo(
    () => loadDestinationCountries(countryCounts),
    [countryCounts],
  );
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

  const trimmedQuery = query.trim();
  const noMatches = trimmedQuery.length > 0 && filteredAll.length === 0 && filteredPopular.length === 0;

  return createPortal(
    <div className={`fixed inset-0 z-50 flex items-stretch justify-center sm:items-center sm:p-4 ${destinationPopupPoppins.className}`}>
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
        data-testid="destination-popup"
        className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-white px-4 pt-[max(18px,env(safe-area-inset-top))] shadow-[0_12px_32px_rgba(0,0,0,0.25)] sm:h-[min(640px,calc(100dvh-2rem))] sm:w-[620px] sm:max-w-[calc(100vw-2rem)] sm:rounded-2xl sm:px-7 sm:pt-6"
      >
        <div className="flex shrink-0 items-start justify-between gap-3">
          <div>
            <h2 id="destination-popup-title" className="text-base font-semibold text-[#1E40AF]">
              Bestemming
            </h2>
            <p className="mt-1 text-[13px] text-[#64748B]">Kies één of meerdere bestemmingen.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 -mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-[#F1F5F9]"
            aria-label="Sluiten"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="relative mt-3 shrink-0">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
            <SearchIcon />
          </span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Zoek een bestemming…"
            aria-label="Zoek een bestemming"
            className="h-11 w-full rounded-lg border border-[#E0E2E7] bg-white pl-10 pr-4 text-[16px] text-[#111827] outline-none placeholder:text-[#94A3B8] focus:border-[#1E88E5] sm:text-[14px]"
          />
        </div>

        {draftSelection.length > 0 ? (
          <div className="mt-2.5 flex shrink-0 flex-wrap gap-1.5" data-testid="destination-selected">
            {draftSelection.map((country) => (
              <DestinationCountryChip
                key={country}
                country={country}
                onRemove={removeCountry}
              />
            ))}
          </div>
        ) : null}

        {noMatches ? (
          <div className="mt-5 min-h-0 flex-1" data-testid="destination-empty">
            <p className="text-[14px] font-semibold text-[#0A2D62]">Deze bestemming is momenteel niet beschikbaar.</p>
          </div>
        ) : (
          <>
            {filteredPopular.length > 0 ? (
              <div className="mt-3.5 shrink-0">
                <PopularDestinationChips
                  countries={filteredPopular}
                  selectedCountries={selectedSet}
                  onToggle={toggleCountry}
                />
              </div>
            ) : null}

            {filteredAll.length > 0 ? (
              <section aria-labelledby="destination-all-title" className="mt-3.5 flex min-h-0 flex-1 flex-col">
                <div className="flex shrink-0 items-baseline justify-between border-b border-[#F1F5F9] pb-2">
                  <h3 id="destination-all-title" className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[#0A2D62]">
                    Alle bestemmingen
                  </h3>
                  <span className="text-[11px] text-[#64748B]" data-testid="destination-all-count">
                    {trimmedQuery ? `${filteredAll.length} van ${allCountries.length}` : allCountries.length}
                  </span>
                </div>
                <div className="destination-popup-scroll min-h-0 flex-1 overflow-y-auto" data-testid="destination-all-list">
                  {filteredAll.map((country) => (
                    <DestinationCountryRow
                      key={country.name}
                      country={country}
                      selected={selectedSet.has(country.name)}
                      onToggle={toggleCountry}
                      flag={<DestinationPopupFlag country={country.name} />}
                    />
                  ))}
                </div>
              </section>
            ) : (
              <div className="min-h-0 flex-1" />
            )}
          </>
        )}

        <div className="mt-2 flex shrink-0 items-center justify-between gap-3 border-t border-[#F1F5F9] pb-[max(16px,env(safe-area-inset-bottom))] pt-3 sm:pb-6 sm:pt-3.5">
          <p className="min-w-0 text-[13px] text-[#475569]">
            {draftSelection.length > 0 ? (
              <>
                <b className="text-[#0A2D62]">{draftSelection.length}</b> geselecteerd
                <button
                  type="button"
                  onClick={() => setDraftSelection([])}
                  className="ml-3 font-medium text-[#1E40AF] underline underline-offset-2"
                >
                  Wissen
                </button>
              </>
            ) : (
              'Nog geen bestemming gekozen'
            )}
          </p>
          <button
            type="button"
            onClick={() => onApply(draftSelection)}
            className="h-11 min-w-[140px] shrink-0 rounded-md bg-[#2E7D32] px-7 text-sm font-semibold text-white"
          >
            {draftSelection.length > 0 ? `OPSLAAN (${draftSelection.length})` : 'OPSLAAN'}
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
      countryCounts={{}}
      totalOffersLabel="69.000+ vakanties"
      onClose={() => setOpen(false)}
      onApply={() => setOpen(true)}
    />
  );
}
