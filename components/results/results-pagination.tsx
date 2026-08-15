'use client';

import {
  SEARCH_PROGRESS_DELAY_MS,
  SearchProgressOverlay,
  useDelayedBusyOverlay,
} from '@/components/search/search-progress-feedback';
import {
  buildResultsPageHref,
  getResultsTotalPages,
  RESULTS_PAGE_DEFAULT,
  RESULTS_PAGE_SIZE_DEFAULT,
} from '@/lib/search/pagination';
import { SearchParams } from '@/types/travel';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

type ResultsPaginationProps = {
  params: SearchParams;
  totalResults: number;
};

function pageItems(current: number, total: number): Array<number | 'ellipsis'> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const items: Array<number | 'ellipsis'> = [1];
  if (current > 3) items.push('ellipsis');

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let page = start; page <= end; page += 1) {
    items.push(page);
  }

  if (current < total - 2) items.push('ellipsis');
  items.push(total);
  return items;
}

export function ResultsPagination({ params, totalResults }: ResultsPaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [isNavigating, setIsNavigating] = useState(false);
  const navigationLockRef = useRef(false);

  const pageBusy = isNavigating || isPending;
  const showProgressOverlay = useDelayedBusyOverlay(pageBusy, SEARCH_PROGRESS_DELAY_MS);

  useEffect(() => {
    navigationLockRef.current = false;
    setIsNavigating(false);
  }, [searchParams]);

  const currentPage = params.page ?? RESULTS_PAGE_DEFAULT;
  const pageSize = params.pageSize ?? RESULTS_PAGE_SIZE_DEFAULT;
  const totalPages = getResultsTotalPages(totalResults, pageSize);

  if (totalPages <= 1) {
    return null;
  }

  const hasNext = currentPage < totalPages;
  const items = pageItems(currentPage, totalPages);

  const goToPage = (page: number) => {
    if (page === currentPage || navigationLockRef.current || pageBusy) {
      return;
    }
    navigationLockRef.current = true;
    setIsNavigating(true);
    startTransition(() => {
      router.push(buildResultsPageHref(params, page));
    });
  };

  return (
    <>
      {showProgressOverlay ? <SearchProgressOverlay /> : null}
      <nav aria-label="Paginatie" className="mt-8 flex flex-wrap items-center justify-center gap-2">
        {items.map((item, index) =>
          item === 'ellipsis' ? (
            <span key={`e-${index}`} className="px-1 text-sm text-[#94A3B8]">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => goToPage(item)}
              disabled={pageBusy || item === currentPage}
              aria-current={item === currentPage ? 'page' : undefined}
              aria-busy={pageBusy}
              className={`inline-flex h-10 min-w-10 items-center justify-center rounded-[10px] px-3 text-sm font-semibold disabled:cursor-wait ${
                item === currentPage
                  ? 'bg-[#0A2D62] text-white'
                  : 'border border-[#D9E0EA] bg-white text-[#334155] hover:border-[#89ACD3] disabled:opacity-80'
              }`}
            >
              {item}
            </button>
          ),
        )}
        {hasNext ? (
          <button
            type="button"
            onClick={() => goToPage(currentPage + 1)}
            disabled={pageBusy}
            aria-busy={pageBusy}
            className="ml-1 inline-flex h-10 items-center rounded-[10px] px-3 text-sm font-semibold text-[#0A2D62] disabled:cursor-wait disabled:opacity-80"
          >
            Volgende &gt;
          </button>
        ) : null}
      </nav>
    </>
  );
}
