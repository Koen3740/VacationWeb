'use client';

import { useReportResultsNavigationBusy } from '@/components/results/results-navigation-busy';
import {
  applyFilterNavigationPaging,
  shouldDropFilterCommit,
  SIDEBAR_FILTER_NAVIGATION,
} from '@/lib/search/filter-navigation';
import {
  listActiveResultFilterChips,
  searchParamsWithoutFilterChip,
  searchParamsWithoutSidebarFilters,
  type ResultFilterChip,
} from '@/lib/search/results-filter-chips';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';

export function useResultsFilterChips() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [isNavigating, setIsNavigating] = useState(false);
  const navigationLockRef = useRef(false);
  const chips = listActiveResultFilterChips(new URLSearchParams(searchParams.toString()));

  useReportResultsNavigationBusy(isNavigating || isPending);

  useEffect(() => {
    navigationLockRef.current = false;
    setIsNavigating(false);
  }, [searchParams]);

  const commit = useCallback(
    (next: URLSearchParams, preservePage1Ids: boolean) => {
      if (
        shouldDropFilterCommit({
          navigationLocked: navigationLockRef.current,
          allowWhileNavigating: SIDEBAR_FILTER_NAVIGATION.allowWhileNavigating,
        })
      ) {
        return;
      }
      applyFilterNavigationPaging(next, {
        preservePage1Ids,
        liveQuery: typeof window === 'undefined' ? undefined : window.location.search,
      });
      const query = next.toString();
      navigationLockRef.current = true;
      setIsNavigating(true);
      startTransition(() => {
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      });
    },
    [pathname, router, startTransition],
  );

  const removeChip = useCallback(
    (chip: ResultFilterChip) => {
      commit(
        searchParamsWithoutFilterChip(new URLSearchParams(searchParams.toString()), chip.id),
        chip.preservePage1Ids,
      );
    },
    [commit, searchParams],
  );

  const clearFilters = useCallback(() => {
    commit(searchParamsWithoutSidebarFilters(new URLSearchParams(searchParams.toString())), true);
  }, [commit, searchParams]);

  return { chips, removeChip, clearFilters };
}

export function ResultsActiveFilters({
  chips,
  onRemove,
  onClear,
}: {
  chips: ResultFilterChip[];
  onRemove: (chip: ResultFilterChip) => void;
  onClear: () => void;
}) {
  if (chips.length === 0) {
    return null;
  }

  return (
    <div
      className="mb-[18px] flex gap-2 max-[900px]:-mx-4 max-[900px]:mb-3.5 max-[900px]:flex-nowrap max-[900px]:overflow-x-auto max-[900px]:px-4 max-[900px]:[scrollbar-width:none] min-[901px]:flex-wrap"
      data-testid="results-active-filters"
    >
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          onClick={() => onRemove(chip)}
          className="inline-flex h-[30px] shrink-0 items-center gap-1.5 rounded-full border border-vw-line bg-white px-3 text-[12.5px] text-vw-navy"
        >
          <span>{chip.label}</span>
          <span className="font-normal text-[#98a1b2]" aria-hidden>
            ×
          </span>
          <span className="sr-only">Verwijder filter {chip.label}</span>
        </button>
      ))}
      <button
        type="button"
        onClick={onClear}
        className="inline-flex h-[30px] shrink-0 items-center px-1 text-[12.5px] text-vw-muted underline"
      >
        Wis filters
      </button>
    </div>
  );
}
