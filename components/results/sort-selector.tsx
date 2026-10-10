'use client';

import { useReportResultsNavigationBusy } from '@/components/results/results-navigation-busy';
import { applyFilterNavigationPaging, SORT_NAVIGATION } from '@/lib/search/filter-navigation';
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

  // Owner 25-09 23:03: no fullscreen loading overlay in the Results flow; busy only drives this control.
  const sortBusy = isNavigating || isPending;
  useReportResultsNavigationBusy(sortBusy);

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
      preservePage1Ids: SORT_NAVIGATION.preservePage1Ids,
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
      <label className="inline-flex w-full items-center gap-2 text-[13px] text-vw-muted min-[901px]:w-auto">
        <span className="max-[900px]:hidden">Sorteren op:</span>
        <select
          value={selectValue}
          onChange={handleChange}
          disabled={sortBusy}
          aria-busy={sortBusy}
          aria-label="Sorteren op"
          className="h-[42px] w-full rounded-[10px] border border-[#dcd5c8] bg-white px-3 text-[13px] font-semibold text-vw-navy outline-none disabled:cursor-wait disabled:opacity-80 min-[901px]:h-10 min-[901px]:w-auto min-[901px]:min-w-[210px]"
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
