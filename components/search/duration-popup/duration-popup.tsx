'use client';

import '@/components/search/duration-popup/duration-popup.css';
import {
  DURATION_HANDLE_SIZE,
  DURATION_MAX,
  DURATION_MIN,
  durationHandleCenterX,
  durationHandleCssLeft,
  durationRangeFromSelection,
  durationSelectionFromRange,
  durationValueCssLeft,
  durationValueFromHandleX,
  formatDurationRangeLabel,
  normalizeDurationRange,
  pickDurationHandle,
  type DurationHandle,
  type DurationRange,
} from '@/components/search/duration-popup/duration-popup-utils';
import { destinationPopupPoppins } from '@/components/search/destination-popup/destination-popup-font';
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';

export type DurationPopupProps = {
  open: boolean;
  selectedDurations: number[];
  onClose: () => void;
  /** Receives the existing `nights` representation: contiguous list of trip days (empty = any duration). */
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

function DurationPopupPanel({
  range,
  onClose,
  onRangeChange,
  onSave,
}: {
  range: DurationRange;
  onClose: () => void;
  onRangeChange: (next: DurationRange) => void;
  onSave: () => void;
}) {
  const step = (handle: Handle, delta: number) => {
    if (handle === 'min') {
      onRangeChange(normalizeDurationRange(range.min + delta, range.max, 'min'));
    } else {
      onRangeChange(normalizeDurationRange(range.min, range.max + delta, 'max'));
    }
  };

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


      <div className="mt-2 grid grid-cols-2 gap-2.5">
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

      <div className="mt-4 flex shrink-0 items-center justify-between gap-3">
        <p className="min-w-0 text-[12.5px] text-[#475569]">
          Gekozen:{' '}
          <span data-testid="duration-summary" className="font-semibold text-[#0A2D62]">
            {formatDurationRangeLabel(range)}
          </span>
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
  const [draftRange, setDraftRange] = useState<DurationRange>(() => durationRangeFromSelection(selectedDurations));
  const [draftDirty, setDraftDirty] = useState(false);
  const overlayReadyRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Seed the draft only on the closed→open transition. Kept separate from the listener effect
  // below (which re-runs when the parent passes a new inline onClose), so a parent re-render
  // while the popup is open can never reset an edited range before OPSLAAN.
  useEffect(() => {
    if (!open) {
      return;
    }
    setDraftRange(durationRangeFromSelection(selectedDurations));
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

  const handleRangeChange = (next: DurationRange) => {
    setDraftRange(next);
    setDraftDirty(true);
  };

  const handleSave = () => {
    // Untouched draft: keep the applied selection as-is (a legacy non-contiguous `nights`
    // list such as 7,14 is only widened to 7..14 once the user actually edits the range).
    if (draftDirty) {
      onChange(durationSelectionFromRange(draftRange));
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
          range={draftRange}
          onClose={onClose}
          onRangeChange={handleRangeChange}
          onSave={handleSave}
        />
      </div>
    </div>,
    document.body,
  );
}
