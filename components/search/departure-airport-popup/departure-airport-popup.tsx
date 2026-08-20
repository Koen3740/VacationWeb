'use client';

import '@/components/search/duration-popup/duration-popup.css';
import {
  formatDepartureAirportOptionLabel,
  toggleDepartureAirport,
} from '@/components/search/departure-airport-popup/departure-airport-popup-utils';
import { destinationPopupPoppins } from '@/components/search/destination-popup/destination-popup-font';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type DepartureAirportPopupProps = {
  open: boolean;
  airports: string[];
  selectedAirports: string[];
  onClose: () => void;
  onChange: (selectedAirports: string[]) => void;
};

function CloseIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="#111827" strokeWidth="2" strokeLinecap="round" />
    </svg>
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
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onToggle(code);
      }}
      className={`duration-popup__row ${selected ? 'duration-popup__row--selected' : ''}`}
      aria-pressed={selected}
    >
      <span
        className={`duration-popup__checkbox ${
          selected
            ? 'duration-popup__checkbox--selected'
            : 'duration-popup__checkbox--default'
        }`}
        aria-hidden="true"
      >
        ✓
      </span>
      <span className="duration-popup__label">{formatDepartureAirportOptionLabel(code)}</span>
    </button>
  );
}

function DepartureAirportPopupPanel({
  airports,
  selectedAirports,
  onClose,
  onToggle,
  onSave,
}: {
  airports: string[];
  selectedAirports: string[];
  onClose: () => void;
  onToggle: (code: string) => void;
  onSave: () => void;
}) {
  const selectedSet = useMemo(
    () => new Set(selectedAirports.map((code) => code.toUpperCase())),
    [selectedAirports],
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="departure-airport-popup-title"
      className={`flex w-[360px] flex-col overflow-hidden rounded-xl bg-white p-5 shadow-[0_8px_24px_rgba(0,0,0,0.15)] ${destinationPopupPoppins.className}`}
    >
      <div className="mb-4 flex shrink-0 items-center justify-between">
        <h2 id="departure-airport-popup-title" className="text-base font-semibold text-[#1E40AF]">
          Vertrekluchthaven
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

      <div className="duration-popup-scroll max-h-[308px] min-h-0 overflow-y-auto">
        {airports.map((code) => (
          <AirportRow
            key={code}
            code={code}
            selected={selectedSet.has(code.toUpperCase())}
            onToggle={onToggle}
          />
        ))}
      </div>

      <div className="mt-5 flex shrink-0 justify-end">
        <button
          type="button"
          onClick={onSave}
          className="h-11 w-40 rounded-md bg-[#2E7D32] text-sm font-semibold text-white"
        >
          OPSLAAN
        </button>
      </div>
    </div>
  );
}

export function DepartureAirportPopup({
  open,
  airports,
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
          airports={airports}
          selectedAirports={draftAirports}
          onClose={onClose}
          onToggle={handleToggle}
          onSave={handleSave}
        />
      </div>
    </div>,
    document.body,
  );
}
