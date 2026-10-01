'use client';

import '@/components/search/duration-popup/duration-popup.css';
import {
  DURATION_HANDLE_SIZE,
  DURATION_MAX,
  DURATION_MIN,
  durationHandleCenterX,
  durationHandleCssLeft,
  durationModeFromSelection,
  durationSelectionFromExact,
  durationValueCssLeft,
  durationValueFromHandleX,
  clampExactDuration,
  exactDurationFromSelection,
  expandDurationRange,
  flexibleRangeFromExact,
  flexibleRangeFromSelection,
  formatDurationRangeLabel,
  isFullDurationRange,
  normalizeDurationRange,
  normalizeFlexibleDurationRange,
  pickDurationHandle,
  type DurationHandle,
  type DurationMode,
  type DurationRange,
} from '@/components/search/duration-popup/duration-popup-utils';
import { destinationPopupPoppins } from '@/components/search/destination-popup/destination-popup-font';
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';

export type DurationPopupProps = {
  open: boolean;
  selectedDurations: number[];
  onClose: () => void;
  /** Receives the existing `nights` representation: [8] (exact) or a contiguous list 7..10 (flexible); empty = no duration filter. */
  onChange: (selectedDurations: number[]) => void;
};

type Handle = DurationHandle;

const TICKS = [DURATION_MIN, 7, 14, 21, DURATION_MAX];

function CloseIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="#111827" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function DurationStepper({
  handle,
  label,
  value,
  canDecrease,
  canIncrease,
  onStep,
}: {
  handle: Handle;
  label: string;
  value: number;
  canDecrease: boolean;
  canIncrease: boolean;
  onStep: (handle: Handle, delta: number) => void;
}) {
  return (
    <div className="duration-popup__stepper">
      <span className="duration-popup__stepper-label" id={`duration-${handle}-label`}>
        {label}
      </span>
      <div className="duration-popup__stepper-row">
        <button
          type="button"
          className="duration-popup__stepper-button"
          aria-label={`${label} verlagen`}
          data-testid={`duration-${handle}-dec`}
          disabled={!canDecrease}
          onClick={() => onStep(handle, -1)}
        >
          −
        </button>
        <span className="duration-popup__stepper-value" aria-live="polite" data-testid={`duration-${handle}-value`}>
          {value}
          <small>dagen</small>
        </span>
        <button
          type="button"
          className="duration-popup__stepper-button"
          aria-label={`${label} verhogen`}
          data-testid={`duration-${handle}-inc`}
          disabled={!canIncrease}
          onClick={() => onStep(handle, 1)}
        >
          +
        </button>
      </div>
    </div>
  );
}

/**
 * Dual-handle range slider (pointer events → mouse, touch and pen) on ONE track. The min handle
 * sits left of its value position and the max handle right of it (see duration-popup-utils), so
 * the handles never overlap, also at 7–8 or 7–7. The whole 44px-high slider is the hit area: the
 * nearest handle (split at the midpoint between both handles) is picked and follows the pointer.
 * Grabbing a handle keeps the grab offset (no jump); tapping the track moves the nearest handle
 * there. min <= max is enforced. Handles are keyboard operable (role="slider").
 */
function DurationRangeSlider({
  range,
  onChange,
}: {
  range: DurationRange;
  onChange: (next: DurationRange) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const rangeRef = useRef(range);
  rangeRef.current = range;
  const dragRef = useRef<{ pointerId: number; handle: Handle; grabOffset: number } | null>(null);
  const [activeHandle, setActiveHandle] = useState<Handle | null>(null);

  const trackMetrics = (): { left: number; width: number } | null => {
    const rect = trackRef.current?.getBoundingClientRect();
    return rect && rect.width > 0 ? { left: rect.left, width: rect.width } : null;
  };

  const moveHandle = (handle: Handle, value: number) => {
    const current = rangeRef.current;
    const next = handle === 'min'
      ? normalizeDurationRange(value, current.max, 'min')
      : normalizeDurationRange(current.min, value, 'max');
    if (next.min !== current.min || next.max !== current.max) {
      rangeRef.current = next;
      onChange(next);
    }
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.pointerType === 'mouse') {
      return;
    }
    const metrics = trackMetrics();
    if (!metrics) {
      return;
    }
    event.preventDefault();
    const x = event.clientX - metrics.left;
    const handle = pickDurationHandle(x, rangeRef.current, metrics.width);
    const center = durationHandleCenterX(handle, rangeRef.current[handle], metrics.width);
    // On the handle itself: keep the grab offset. On the track: the handle jumps to the pointer.
    const grabOffset = Math.abs(x - center) <= DURATION_HANDLE_SIZE / 2 ? x - center : 0;
    dragRef.current = { pointerId: event.pointerId, handle, grabOffset };
    event.currentTarget.setPointerCapture(event.pointerId);
    setActiveHandle(handle);
    if (grabOffset === 0) {
      moveHandle(handle, durationValueFromHandleX(handle, x, metrics.width));
    }
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    const metrics = trackMetrics();
    if (!metrics) {
      return;
    }
    const x = event.clientX - metrics.left - drag.grabOffset;
    moveHandle(drag.handle, durationValueFromHandleX(drag.handle, x, metrics.width));
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
      setActiveHandle(null);
    }
  };

  const onThumbKeyDown = (handle: Handle) => (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const current = rangeRef.current[handle];
    let next: number | null = null;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = current - 1;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = current + 1;
    if (event.key === 'PageDown') next = current - 7;
    if (event.key === 'PageUp') next = current + 7;
    if (event.key === 'Home') next = DURATION_MIN;
    if (event.key === 'End') next = DURATION_MAX;
    if (next === null) return;
    event.preventDefault();
    moveHandle(handle, next);
  };

  return (
    <div className="duration-popup__slider-wrap">
      <div
        className="duration-popup__slider"
        data-testid="duration-slider"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div ref={trackRef} className="duration-popup__track">
          <div
            className="duration-popup__track-fill"
            style={{
              left: durationHandleCssLeft('min', range.min),
              width: `calc(${durationHandleCssLeft('max', range.max)} - ${durationHandleCssLeft('min', range.min)})`,
            }}
          />
          {(['min', 'max'] as const).map((handle) => {
            const value = range[handle];
            return (
              <div
                key={handle}
                role="slider"
                tabIndex={0}
                aria-label={handle === 'min' ? 'Minimale reisduur' : 'Maximale reisduur'}
                aria-valuemin={handle === 'min' ? DURATION_MIN : range.min}
                aria-valuemax={handle === 'min' ? range.max : DURATION_MAX}
                aria-valuenow={value}
                aria-valuetext={`${value} dagen`}
                data-testid={`duration-thumb-${handle}`}
                onKeyDown={onThumbKeyDown(handle)}
                className={`duration-popup__thumb duration-popup__thumb--${handle} ${activeHandle === handle ? 'duration-popup__thumb--active' : ''}`}
                style={{ left: durationHandleCssLeft(handle, value) }}
              />
            );
          })}
        </div>
      </div>
      <div className="duration-popup__ticks" aria-hidden="true">
        {TICKS.map((tick) => (
          <span key={tick} style={{ left: durationValueCssLeft(tick) }}>
            {tick}
          </span>
        ))}
      </div>
    </div>
  );
}

type DurationDraft = {
  mode: DurationMode;
  /** Exact: one number of trip days. */
  exact: number;
  /** Flexible: inclusive range of trip days (never the full 2..32 span). */
  range: DurationRange;
  /** False = nothing chosen yet (no `nights` filter); values below are only a muted starting point. */
  chosen: boolean;
};

function draftFromSelection(selected: number[]): DurationDraft {
  const mode = durationModeFromSelection(selected);
  const exact = exactDurationFromSelection(selected);
  return {
    mode,
    exact,
    range: selected.length > 1 ? flexibleRangeFromSelection(selected) : flexibleRangeFromExact(exact),
    chosen: selected.length > 0,
  };
}

function selectionFromDraft(draft: DurationDraft): number[] {
  if (!draft.chosen) {
    return [];
  }
  return draft.mode === 'exact'
    ? durationSelectionFromExact(draft.exact)
    : expandDurationRange(draft.range.min, draft.range.max);
}

function DurationPopupPanel({
  draft,
  onClose,
  onModeChange,
  onExactChange,
  onRangeChange,
  onClear,
  onSave,
}: {
  draft: DurationDraft;
  onClose: () => void;
  onModeChange: (mode: DurationMode) => void;
  onExactChange: (days: number) => void;
  onRangeChange: (next: DurationRange) => void;
  onClear: () => void;
  onSave: () => void;
}) {
  const { range } = draft;
  const step = (handle: Handle, delta: number) => {
    if (handle === 'min') {
      onRangeChange(normalizeDurationRange(range.min + delta, range.max, 'min'));
    } else {
      onRangeChange(normalizeDurationRange(range.min, range.max + delta, 'max'));
    }
  };
  const summary = draft.mode === 'exact'
    ? formatDurationRangeLabel({ min: draft.exact, max: draft.exact })
    : formatDurationRangeLabel(range);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="duration-popup-title"
      data-testid="duration-popup"
      className={`flex w-[340px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl bg-white p-[18px] shadow-[0_8px_24px_rgba(0,0,0,0.2)] ${destinationPopupPoppins.className}`}
    >
      <div className="flex shrink-0 items-center justify-between">
        <h2 id="duration-popup-title" className="text-[15px] font-semibold text-[#1E40AF]">
          Reisduur
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="-mr-2 flex h-10 w-10 items-center justify-center rounded-full hover:bg-[#F1F5F9]"
          aria-label="Sluiten"
        >
          <CloseIcon />
        </button>
      </div>

      <div className="duration-popup__tabs" role="tablist" aria-label="Soort reisduur" data-testid="duration-tabs">
        {(
          [
            ['exact', 'Exact', draft.chosen ? formatDurationRangeLabel({ min: draft.exact, max: draft.exact }) : 'Een aantal dagen'],
            ['flexibel', 'Flexibel', draft.chosen ? formatDurationRangeLabel(range) : 'Van - tot'],
          ] as const
        ).map(([mode, label, sub]) => (
          <button
            key={mode}
            type="button"
            role="tab"
            id={`duration-tab-${mode}`}
            aria-selected={draft.mode === mode}
            aria-controls="duration-tabpanel"
            data-testid={`duration-tab-${mode}`}
            onClick={() => onModeChange(mode)}
            className={`duration-popup__tab ${draft.mode === mode ? 'duration-popup__tab--active' : ''}`}
          >
            {label}
            <small>{sub}</small>
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id="duration-tabpanel"
        aria-labelledby={`duration-tab-${draft.mode}`}
        className={draft.chosen ? '' : 'duration-popup--unset'}
      >
        {draft.mode === 'exact' ? (
          <div data-testid="duration-exact">
            <div className="mt-1">
              <div className="duration-popup__stepper">
                <span className="duration-popup__stepper-label" id="duration-exact-label">
                  Aantal dagen
                </span>
                <div className="duration-popup__stepper-row">
                  <button
                    type="button"
                    className="duration-popup__stepper-button"
                    aria-label="Aantal dagen verlagen"
                    data-testid="duration-exact-dec"
                    disabled={draft.exact <= DURATION_MIN}
                    onClick={() => onExactChange(draft.exact - 1)}
                  >
                    -
                  </button>
                  <span className="duration-popup__stepper-value" aria-live="polite" data-testid="duration-exact-value">
                    {draft.exact}
                    <small>dagen</small>
                  </span>
                  <button
                    type="button"
                    className="duration-popup__stepper-button"
                    aria-label="Aantal dagen verhogen"
                    data-testid="duration-exact-inc"
                    disabled={draft.exact >= DURATION_MAX}
                    onClick={() => onExactChange(draft.exact + 1)}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
            <div className="duration-popup__slider-wrap">
              <input
                type="range"
                className="duration-popup__exact-range"
                data-testid="duration-exact-range"
                min={DURATION_MIN}
                max={DURATION_MAX}
                step={1}
                value={draft.exact}
                aria-labelledby="duration-exact-label"
                aria-valuetext={`${draft.exact} dagen`}
                onChange={(event) => onExactChange(Number(event.target.value))}
              />
              <div className="duration-popup__ticks" aria-hidden="true">
                {TICKS.map((tick) => (
                  <span key={tick} style={{ left: `${((tick - DURATION_MIN) / (DURATION_MAX - DURATION_MIN)) * 100}%` }}>
                    {tick}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div data-testid="duration-flexible">
            <div className="mt-1 grid grid-cols-2 gap-2.5">
              <DurationStepper
                handle="min"
                label="Minimaal"
                value={range.min}
                canDecrease={range.min > DURATION_MIN}
                canIncrease={range.min < range.max}
                onStep={step}
              />
              <DurationStepper
                handle="max"
                label="Maximaal"
                value={range.max}
                canDecrease={range.max > range.min}
                canIncrease={range.max < DURATION_MAX}
                onStep={step}
              />
            </div>
            <DurationRangeSlider range={range} onChange={onRangeChange} />
          </div>
        )}
      </div>

      <div className="mt-4 flex shrink-0 items-center justify-between gap-3">
        <p className="min-w-0 text-[12.5px] text-[#475569]" data-testid="duration-footer">
          {draft.chosen ? (
            <>
              <span data-testid="duration-summary" className="font-semibold text-[#0A2D62]">
                {summary}
              </span>
              <button
                type="button"
                onClick={onClear}
                data-testid="duration-clear"
                className="ml-3 font-medium text-[#1E40AF] underline underline-offset-2"
              >
                Wissen
              </button>
            </>
          ) : (
            <span data-testid="duration-summary" className="text-[#64748B]">Optioneel</span>
          )}
        </p>
        <button
          type="button"
          onClick={onSave}
          className="h-11 shrink-0 rounded-md bg-[#2E7D32] px-6 text-sm font-semibold text-white"
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
  const [draft, setDraft] = useState<DurationDraft>(() => draftFromSelection(selectedDurations));
  const [draftDirty, setDraftDirty] = useState(false);
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
    setDraft(draftFromSelection(selectedDurations));
    setDraftDirty(false);
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

  // Switching tabs only changes which value is shown; nothing is chosen until a value is touched.
  const handleModeChange = (mode: DurationMode) => {
    setDraft((current) => {
      if (current.mode === mode) {
        return current;
      }
      return mode === 'flexibel'
        ? { ...current, mode, range: current.chosen ? flexibleRangeFromExact(current.exact) : current.range }
        : { ...current, mode, exact: current.chosen ? current.range.min : current.exact };
    });
  };

  const handleExactChange = (days: number) => {
    setDraft((current) => ({ ...current, exact: clampExactDuration(days), chosen: true }));
    setDraftDirty(true);
  };

  // Flexible range: the full 2..32 span is "any duration" and is never an explicit choice.
  const handleRangeChange = (next: DurationRange) => {
    setDraft((current) => {
      const fixed = isFullDurationRange(next)
        ? normalizeFlexibleDurationRange(next.min, next.max, current.range.min !== next.min ? 'min' : 'max')
        : next;
      return { ...current, range: fixed, chosen: true };
    });
    setDraftDirty(true);
  };

  const handleClear = () => {
    setDraft(draftFromSelection([]));
    setDraftDirty(true);
  };

  const handleSave = () => {
    // Untouched draft: keep the applied selection as-is (a legacy non-contiguous `nights`
    // list such as 7,14 is only widened to 7..14 once the user actually edits the range).
    if (draftDirty) {
      onChange(selectionFromDraft(draft));
    }
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
          draft={draft}
          onClose={onClose}
          onModeChange={handleModeChange}
          onExactChange={handleExactChange}
          onRangeChange={handleRangeChange}
          onClear={handleClear}
          onSave={handleSave}
        />
      </div>
    </div>,
    document.body,
  );
}