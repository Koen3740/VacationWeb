'use client';

import {
  DURATION_CHIPS,
  DURATION_MAX,
  DURATION_MIN,
  clearDurationDraft,
  durationChipAriaLabel,
  durationDaysFromDraft,
  durationDraftFromApplied,
  formatSelectedDurationsLabel,
  sameDurationSelection,
  stepCustomDurationDraft,
  toggleCustomDurationDraft,
  toggleDurationChipDraft,
  type DurationChip,
  type DurationChoiceDraft,
} from '@/components/search/duration-popup/duration-popup-utils';
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type DurationPopupProps = {
  open: boolean;
  selectedDurations: number[];
  onClose: () => void;
  /** Existing `nights` representation: a list of trip days. Empty = no duration filter. */
  onChange: (selectedDurations: number[]) => void;
};

function CloseIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function chipClass(selected: boolean): string {
  const base = 'min-h-12 rounded-vw-panel border px-2 text-base font-semibold transition-colors';
  return selected
    ? `${base} border-vw-navy bg-vw-navy text-white`
    : `${base} border-vw-line bg-white text-vw-navy hover:border-vw-navy`;
}

export function DurationPopupPanel({
  draft,
  onClose,
  onToggleChip,
  onToggleCustom,
  onStepCustom,
  onClear,
  onSave,
}: {
  draft: DurationChoiceDraft;
  onClose: () => void;
  onToggleChip: (chip: DurationChip) => void;
  onToggleCustom: () => void;
  onStepCustom: (delta: number) => void;
  onClear: () => void;
  onSave: () => void;
}) {
  const days = durationDaysFromDraft(draft);
  const customDay = draft.customDay ?? DURATION_MIN;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="duration-popup-title"
      data-testid="duration-popup"
      className="flex w-[min(420px,calc(100vw-1.5rem))] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-vw-panel bg-vw-card p-4 font-vw-sans shadow-vw-panel sm:p-5"
    >
      <div className="flex shrink-0 items-center justify-between">
        <h2 id="duration-popup-title" className="font-vw-serif text-lg font-semibold text-vw-navy">
          Reisduur
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-vw-navy hover:bg-vw-bg"
          aria-label="Sluiten"
        >
          <CloseIcon />
        </button>
      </div>

      <p className="mt-1 text-sm text-vw-muted">Aantal dagen</p>

      <div role="group" aria-label="Aantal dagen" className="mt-3 grid grid-cols-2 gap-2">
        {DURATION_CHIPS.map((chip) => {
          const selected = draft.chipIds.includes(chip.id);
          return (
            <button
              key={chip.id}
              type="button"
              aria-pressed={selected}
              aria-label={durationChipAriaLabel(chip)}
              data-testid={`duration-chip-${chip.id}`}
              onClick={() => onToggleChip(chip)}
              className={chipClass(selected)}
            >
              {chip.label}
            </button>
          );
        })}
        <button
          type="button"
          aria-pressed={draft.customOpen}
          aria-expanded={draft.customOpen}
          data-testid="duration-custom"
          onClick={onToggleCustom}
          className={chipClass(draft.customOpen)}
        >
          Ander aantal
        </button>
      </div>

      {draft.customOpen ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-vw-control border border-vw-line bg-white px-3 py-2" data-testid="duration-custom-stepper">
          <span className="text-sm font-medium text-vw-navy" id="duration-custom-label">
            Aantal dagen
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-vw-line bg-white text-lg text-vw-navy disabled:text-vw-muted"
              aria-label="Aantal dagen verlagen"
              data-testid="duration-custom-dec"
              disabled={customDay <= DURATION_MIN}
              onClick={() => onStepCustom(-1)}
            >
              −
            </button>
            <span className="min-w-[4.5rem] text-center text-base font-semibold tabular-nums text-vw-navy" aria-live="polite" data-testid="duration-custom-value">
              {customDay}
              <span className="ml-1 text-xs font-medium text-vw-muted">dagen</span>
            </span>
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-vw-line bg-white text-lg text-vw-navy disabled:text-vw-muted"
              aria-label="Aantal dagen verhogen"
              data-testid="duration-custom-inc"
              disabled={customDay >= DURATION_MAX}
              onClick={() => onStepCustom(1)}
            >
              +
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex shrink-0 items-center justify-between gap-3">
        <p className="min-w-0 text-[13px] text-vw-muted" data-testid="duration-footer">
          {days.length > 0 ? (
            <>
              <span data-testid="duration-summary" className="font-semibold text-vw-navy">
                {formatSelectedDurationsLabel(days)}
              </span>
              <button
                type="button"
                onClick={onClear}
                data-testid="duration-clear"
                className="ml-3 font-medium text-vw-navy underline underline-offset-2"
              >
                Wissen
              </button>
            </>
          ) : (
            <span data-testid="duration-summary">Optioneel</span>
          )}
        </p>
        <button
          type="button"
          onClick={onSave}
          className="h-11 shrink-0 rounded-vw-control bg-vw-green px-6 text-sm font-semibold text-white"
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
  const [draft, setDraft] = useState<DurationChoiceDraft>(() => durationDraftFromApplied(selectedDurations));
  const overlayReadyRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Seed the draft only on the closed->open transition. Kept separate from the listener effect
  // below (which re-runs when the parent passes a new inline onClose), so a parent re-render
  // while the popup is open can never reset an edited value before OPSLAAN.
  useEffect(() => {
    if (!open) {
      return;
    }
    setDraft(durationDraftFromApplied(selectedDurations));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selectedDurations read on open only
  }, [open]);

  useEffect(() => {
    if (!open) {
      overlayReadyRef.current = false;
      return undefined;
    }

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
  }, [onClose, open]);

  const handleSave = () => {
    const next = durationDaysFromDraft(draft);
    if (!sameDurationSelection(next, selectedDurations)) {
      onChange(next);
    }
    onClose();
  };

  if (!open || !mounted) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 font-vw-sans sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-[rgba(10,45,98,0.4)]"
        aria-label="Sluit reisduur-popup"
        onClick={() => {
          if (overlayReadyRef.current) {
            onClose();
          }
        }}
      />
      <div className="relative z-10" onClick={(event) => event.stopPropagation()}>
        <DurationPopupPanel
          draft={draft}
          onClose={onClose}
          onToggleChip={(chip) => setDraft((current) => toggleDurationChipDraft(current, chip))}
          onToggleCustom={() => setDraft((current) => toggleCustomDurationDraft(current))}
          onStepCustom={(delta) => setDraft((current) => stepCustomDurationDraft(current, delta))}
          onClear={() => setDraft(clearDurationDraft())}
          onSave={handleSave}
        />
      </div>
    </div>,
    document.body,
  );
}
