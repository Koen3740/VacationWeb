'use client';

import {
  SEARCH_PROGRESS_DELAY_MS,
  SearchProgressOverlay,
  useDelayedBusyOverlay,
} from '@/components/search/search-progress-feedback';
import { applyFilterNavigationPaging } from '@/lib/search/filter-navigation';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

const SORT_OPTIONS = [
  { value: 'price', label: 'Prijs (laag → hoog)' },
  { value: 'price-desc', label: 'Prijs (hoog → laag)' },
  { value: 'price-per-day', label: 'Prijs per vakantiedag' },
  { value: 'rating', label: 'Beoordeling' },
  { value: 'stars', label: 'Sterren' },
  { value: 'departure', label: 'Vertrekdatum' },
  { value: 'duration', label: 'Reisduur' },
] as const;

export function SortSelector({ currentSort }: { currentSort: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [isNavigating, setIsNavigating] = useState(false);
  const navigationLockRef = useRef(false);

  const sortBusy = isNavigating || isPending;
  const showProgressOverlay = useDelayedBusyOverlay(sortBusy, SEARCH_PROGRESS_DELAY_MS);

  useEffect(() => {
    navigationLockRef.current = false;
    setIsNavigating(false);
  }, [searchParams]);

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    if (navigationLockRef.current || sortBusy) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    const nextSort = event.target.value;
    if (!nextSort) {
      params.delete('sort');
    } else {
      params.set('sort', nextSort);
    }
    applyFilterNavigationPaging(params, {
      preservePage1Ids: true,
      liveQuery: typeof window === 'undefined' ? undefined : window.location.search,
    });
    navigationLockRef.current = true;
    setIsNavigating(true);
    startTransition(() => {
      router.push(`/results?${params.toString()}`);
    });
  };

  const knownValues = SORT_OPTIONS.map((option) => option.value);
  const selectValue = knownValues.includes(currentSort as (typeof SORT_OPTIONS)[number]['value'])
    ? currentSort
    : '';

  return (
    <>
      {showProgressOverlay ? <SearchProgressOverlay /> : null}
      <label className="inline-flex items-center gap-2 text-[13px] text-[#64748B]">
        <span>Sorteren op:</span>
        <select
          value={selectValue}
          onChange={handleChange}
          disabled={sortBusy}
          aria-busy={sortBusy}
          className="h-10 max-w-full rounded-[10px] border border-[#D9E0EA] bg-white px-3 text-[13px] font-semibold text-[#0A2D62] outline-none disabled:cursor-wait disabled:opacity-80"
        >
          <option value="">Standaard volgorde</option>
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
