'use client';

import '@/components/search/duration-popup/duration-popup.css';
import {
  buildDurationOptions,
  toggleDuration,
} from '@/components/search/duration-popup/duration-popup-utils';
import { destinationPopupPoppins } from '@/components/search/destination-popup/destination-popup-font';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type DurationPopupProps = {
  open: boolean;
  selectedDurations: number[];
  onClose: () => void;
  onChange: (selectedDurations: number[]) => void;
};

function CloseIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="#111827" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function DurationRow({
  days,
  selected,
  onToggle,
}: {
  days: number;
  selected: boolean;
  onToggle: (days: number) => void;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onToggle(days);
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
      <span className="duration-popup__label">{days} dagen</span>
    </button>
  );
}

function DurationPopupPanel({
  selectedDurations,
  onClose,
  onToggle,
  onSave,
}: {
  selectedDurations: number[];
  onClose: () => void;
  onToggle: (days: number) => void;
  onSave: () => void;
}) {
  const options = useMemo(() => buildDurationOptions(), []);
  const selectedSet = useMemo(() => new Set(selectedDurations), [selectedDurations]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="duration-popup-title"
      className={`flex w-[360px] flex-col overflow-hidden rounded-xl bg-white p-5 shadow-[0_8px_24px_rgba(0,0,0,0.15)] ${destinationPopupPoppins.className}`}
    >
      <div className="mb-4 flex shrink-0 items-center justify-between">
        <h2 id="duration-popup-title" className="text-base font-semibold text-[#1E40AF]">
          Reisduur
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
        {options.map((days) => (
          <DurationRow
            key={days}
            days={days}
            selected={selectedSet.has(days)}
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

export function DurationPopup({
  open,
  selectedDurations,
  onClose,
  onChange,
}: DurationPopupProps) {
  const [mounted, setMounted] = useState(false);
  const [draftDurations, setDraftDurations] = useState<number[]>(selectedDurations);
  const overlayReadyRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      overlayReadyRef.current = false;
      return undefined;
    }

    setDraftDurations(selectedDurations);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selectedDurations read on open
  }, [onClose, open]);

  const handleToggle = (days: number) => {
    setDraftDurations((current) => toggleDuration(current, days));
  };

  const handleSave = () => {
    onChange(draftDurations);
    onClose();
  };

  if (!open) {
    return null;
  }

  if (!mounted) {
    return null;
  }

  return createPortal(
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${destinationPopupPoppins.className}`}>
      <button
        type="button"
        className="absolute inset-0 bg-[rgba(0,0,0,0.4)]"
        aria-label="Sluit reisduur-popup"
        onClick={() => {
          if (overlayReadyRef.current) {
            onClose();
          }
        }}
      />
      <div className="relative z-10" onClick={(event) => event.stopPropagation()}>
        <DurationPopupPanel
          selectedDurations={draftDurations}
          onClose={onClose}
          onToggle={handleToggle}
          onSave={handleSave}
        />
      </div>
    </div>,
    document.body,
  );
}
