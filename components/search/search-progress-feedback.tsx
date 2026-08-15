'use client';

import { useEffect, useState } from 'react';

/** Neutral, replaceable copy for search / results progress feedback. */
export const SEARCH_PROGRESS_MESSAGE =
  'Een momentje — we zoeken de beste vakantie voor jou.';

/**
 * Homepage search shows progress immediately (no delay).
 * Results filter/sort/param navigations use this threshold before overlay.
 */
export const SEARCH_PROGRESS_DELAY_MS = 2000;

type SearchProgressFeedbackProps = {
  className?: string;
};

/** Shared progress UI for homepage search start and Results route loading. */
export function SearchProgressFeedback({ className = '' }: SearchProgressFeedbackProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={`flex flex-col items-center justify-center gap-4 px-6 text-center ${className}`}
    >
      <span
        className="h-9 w-9 animate-spin rounded-full border-2 border-[#89ACD3] border-t-[#0A2D62]"
        aria-hidden="true"
      />
      <p className="max-w-sm text-[15px] font-medium leading-snug text-[#0A2D62]">
        {SEARCH_PROGRESS_MESSAGE}
      </p>
    </div>
  );
}

/** Full-viewport overlay while a search navigation is in flight. */
export function SearchProgressOverlay() {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(243,245,248,0.92)] p-4">
      <SearchProgressFeedback />
    </div>
  );
}

/**
 * Show the progress overlay only after `delayMs` of continuous busy state.
 * Pass `delayMs: 0` for immediate feedback (homepage search).
 */
export function useDelayedBusyOverlay(
  busy: boolean,
  delayMs: number = SEARCH_PROGRESS_DELAY_MS,
): boolean {
  const [showOverlay, setShowOverlay] = useState(false);

  useEffect(() => {
    if (!busy) {
      setShowOverlay(false);
      return undefined;
    }

    if (delayMs <= 0) {
      setShowOverlay(true);
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setShowOverlay(true);
    }, delayMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [busy, delayMs]);

  return showOverlay;
}
