'use client';

import '@/components/search/departure-airport-popup/departure-airport-popup.css';
import {
  formatDepartureAirportOptionLabel,
  getCountriesWithSelectedAirports,
  getPublicPickerCountryGroups,
  setDepartureAirportsSelection,
  toggleCountryExpanded,
  toggleDepartureAirport,
} from '@/components/search/departure-airport-popup/departure-airport-popup-utils';
import { destinationPopupPoppins } from '@/components/search/destination-popup/destination-popup-font';
import type { AirportCountryCode } from '@/lib/search/departure-airports';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type DepartureAirportPopupProps = {
  open: boolean;
  /**
   * Legacy catalog-derived list. The public picker uses the canonical registry
   * land→airport tree; this prop is kept for call-site compatibility.
   */
  airports?: string[];
  selectedAirports: string[];
  onClose: () => void;
  onChange: (selectedAirports: string[]) => void;
};

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 4l8 8M12 4L4 12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={`dap__chevron ${expanded ? 'dap__chevron--expanded' : ''}`}
    >
      <path
        d="M6 4l4 4-4 4"
        stroke="#475569"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckboxMark({ selected, indeterminate }: { selected: boolean; indeterminate?: boolean }) {
  return (
    <span
      className={`dap__checkbox ${
        selected || indeterminate ? 'dap__checkbox--selected' : 'dap__checkbox--default'
      }`}
      aria-hidden="true"
    >
      {indeterminate && !selected ? '–' : '✓'}
    </span>
  );
}

function AirportRow({
  code,
  selected,
  onToggle,
}: {
  code: string;
  selected: boolean;
  onToggle: (code: string) => void;
}) {
  const iata = code.toUpperCase();
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onToggle(code);
      }}
      className={`dap__airport ${selected ? 'dap__airport--selected' : ''}`}
      aria-pressed={selected}
    >
      <CheckboxMark selected={selected} />
      <span className="dap__airport-name">{formatDepartureAirportOptionLabel(code)}</span>
      <span className="dap__airport-iata">{iata}</span>
    </button>
  );
}

function CountryGroupBlock({
  countryCode,
  countryLabel,
  airportCodes,
  selectedSet,
  expanded,
  onToggleExpand,
  onToggleAirport,
  onToggleCountry,
}: {
  countryCode: AirportCountryCode;
  countryLabel: string;
  airportCodes: readonly string[];
  selectedSet: Set<string>;
  expanded: boolean;
  onToggleExpand: (countryCode: AirportCountryCode) => void;
  onToggleAirport: (code: string) => void;
  onToggleCountry: (codes: readonly string[], select: boolean) => void;
}) {
  const selectedCount = airportCodes.filter((code) => selectedSet.has(code.toUpperCase())).length;
  const allSelected = selectedCount === airportCodes.length && airportCodes.length > 0;
  const someSelected = selectedCount > 0 && !allSelected;

  return (
    <div className="dap__group">
      <div className="dap__country">
        <button
          type="button"
          className="dap__expand"
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Inklappen' : 'Uitklappen'} ${countryLabel}`}
          onClick={(event) => {
            event.stopPropagation();
            onToggleExpand(countryCode);
          }}
        >
          <ChevronIcon expanded={expanded} />
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleCountry(airportCodes, !allSelected);
          }}
          className={`dap__country-toggle ${allSelected ? 'dap__country-toggle--selected' : ''}`}
          aria-pressed={allSelected}
          aria-label={`${countryLabel}${allSelected ? ', alle geselecteerd' : someSelected ? ', deels geselecteerd' : ''}`}
        >
          <CheckboxMark selected={allSelected} indeterminate={someSelected} />
          <span className="dap__country-label">{countryLabel}</span>
        </button>
      </div>
      {expanded ? (
        <div className="dap__airports">
          {airportCodes.map((code) => (
            <AirportRow
              key={code}
              code={code}
              selected={selectedSet.has(code.toUpperCase())}
              onToggle={onToggleAirport}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DepartureAirportPopupPanel({
  selectedAirports,
  onClose,
  onToggle,
  onToggleCountry,
  onSave,
}: {
  selectedAirports: string[];
  onClose: () => void;
  onToggle: (code: string) => void;
  onToggleCountry: (codes: readonly string[], select: boolean) => void;
  onSave: () => void;
}) {
  const groups = useMemo(() => getPublicPickerCountryGroups(), []);
  const selectedSet = useMemo(
    () => new Set(selectedAirports.map((code) => code.toUpperCase())),
    [selectedAirports],
  );
  const [expandedCountries, setExpandedCountries] = useState<Set<AirportCountryCode>>(() => {
    const withSelected = getCountriesWithSelectedAirports(selectedAirports, groups);
    if (withSelected.size > 0) return withSelected;
    // Empty selection: open the full tree so hierarchy (name + IATA) is immediately scannable.
    return new Set(groups.map((group) => group.countryCode));
  });

  const handleToggleExpand = (countryCode: AirportCountryCode) => {
    setExpandedCountries((current) => toggleCountryExpanded(current, countryCode));
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="departure-airport-popup-title"
      className={`dap ${destinationPopupPoppins.className}`}
    >
      <div className="dap__header">
        <h2 id="departure-airport-popup-title" className="dap__title">
          Vertrekluchthaven
        </h2>
        <button type="button" onClick={onClose} className="dap__close" aria-label="Sluiten">
          <CloseIcon />
        </button>
      </div>

      <div className="dap__scroll">
        {groups.map((group) => (
          <CountryGroupBlock
            key={group.countryCode}
            countryCode={group.countryCode}
            countryLabel={group.displayNameNl}
            airportCodes={group.airports.map((airport) => airport.iata)}
            selectedSet={selectedSet}
            expanded={expandedCountries.has(group.countryCode)}
            onToggleExpand={handleToggleExpand}
            onToggleAirport={onToggle}
            onToggleCountry={onToggleCountry}
          />
        ))}
      </div>

      <div className="dap__footer">
        <button type="button" onClick={onSave} className="dap__save">
          OPSLAAN
        </button>
      </div>
    </div>
  );
}

export function DepartureAirportPopup({
  open,
  selectedAirports,
  onClose,
  onChange,
}: DepartureAirportPopupProps) {
  const [mounted, setMounted] = useState(false);
  const [draftAirports, setDraftAirports] = useState<string[]>(selectedAirports);
  const overlayReadyRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      overlayReadyRef.current = false;
      return undefined;
    }

    setDraftAirports(selectedAirports);
    overlayReadyRef.current = false;
    const overlayTimer = window.setTimeout(() => {
      overlayReadyRef.current = true;
    }, 0);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.clearTimeout(overlayTimer);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
    // Seed draft only when the popup opens; multi-select edits stay local until OPSLAAN.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selectedAirports read on open
  }, [onClose, open]);

  const handleToggle = (code: string) => {
    setDraftAirports((current) => toggleDepartureAirport(current, code));
  };

  const handleToggleCountry = (codes: readonly string[], select: boolean) => {
    setDraftAirports((current) => setDepartureAirportsSelection(current, codes, select));
  };

  const handleSave = () => {
    onChange(draftAirports);
    onClose();
  };

  if (!open || !mounted) {
    return null;
  }

  return createPortal(
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${destinationPopupPoppins.className}`}>
      <button
        type="button"
        className="absolute inset-0 bg-[rgba(0,0,0,0.4)]"
        aria-label="Sluit vertrekluchthaven-popup"
        onClick={() => {
          if (overlayReadyRef.current) {
            onClose();
          }
        }}
      />
      <div className="relative z-10" onClick={(event) => event.stopPropagation()}>
        <DepartureAirportPopupPanel
          selectedAirports={draftAirports}
          onClose={onClose}
          onToggle={handleToggle}
          onToggleCountry={handleToggleCountry}
          onSave={handleSave}
        />
      </div>
    </div>,
    document.body,
  );
}
