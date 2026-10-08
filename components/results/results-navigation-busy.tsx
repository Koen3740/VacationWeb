'use client';

import {
  SEARCH_PROGRESS_DELAY_MS,
  SEARCH_PROGRESS_MESSAGE,
  SearchProgressFeedback,
  useDelayedBusyOverlay,
} from '@/components/search/search-progress-feedback';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

type ResultsNavigationBusyContextValue = {
  begin: () => void;
  end: () => void;
  isBusy: boolean;
};

const ResultsNavigationBusyContext = createContext<ResultsNavigationBusyContextValue | null>(
  null,
);

/**
 * Collects in-flight Results navigations (filters, sort, pagination, search bar,
 * provider) so a delayed compact notice can appear without locking the sidebar.
 * Filters remain clickable while the delayed notice is visible.
 */
export function ResultsNavigationBusyProvider({ children }: { children: ReactNode }) {
  const pendingCountRef = useRef(0);
  const [pendingCount, setPendingCount] = useState(0);
  const isBusy = pendingCount > 0;

  const beginEnd = useMemo(
    () => ({
      begin: () => {
        pendingCountRef.current += 1;
        setPendingCount(pendingCountRef.current);
      },
      end: () => {
        pendingCountRef.current = Math.max(0, pendingCountRef.current - 1);
        setPendingCount(pendingCountRef.current);
      },
    }),
    [],
  );

  const api = useMemo<ResultsNavigationBusyContextValue>(
    () => ({
      ...beginEnd,
      isBusy,
    }),
    [beginEnd, isBusy],
  );

  return (
    <ResultsNavigationBusyContext.Provider value={api}>
      {children}
    </ResultsNavigationBusyContext.Provider>
  );
}

/** Report a local useTransition/navigation busy flag to the delayed Results notice. */
export function useReportResultsNavigationBusy(busy: boolean) {
  const ctx = useContext(ResultsNavigationBusyContext);
  const begin = ctx?.begin;
  const end = ctx?.end;

  useEffect(() => {
    if (!begin || !end || !busy) {
      return undefined;
    }
    begin();
    return () => {
      end();
    };
  }, [busy, begin, end]);
}

/**
 * Compact Results notice after ~2s of unfinished navigation.
 * Not a fullscreen overlay and not a control lock — filters stay clickable.
 */
export function ResultsDelayedNavigationNotice() {
  const ctx = useContext(ResultsNavigationBusyContext);
  const showNotice = useDelayedBusyOverlay(Boolean(ctx?.isBusy), SEARCH_PROGRESS_DELAY_MS);

  if (!showNotice) {
    return null;
  }

  return (
    <div
      className="mb-5 rounded-[16px] border border-[#D9E0EA] bg-white px-4 py-5"
      data-testid="results-delayed-navigation-notice"
    >
      <SearchProgressFeedback />
    </div>
  );
}

export { SEARCH_PROGRESS_DELAY_MS, SEARCH_PROGRESS_MESSAGE };
