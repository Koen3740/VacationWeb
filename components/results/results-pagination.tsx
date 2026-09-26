'use client';

import {
  buildResultsPageHref,
  getResultsBrowsePageCount,
  RESULTS_PAGE_DEFAULT,
  RESULTS_PAGE_SIZE_DEFAULT,
} from '@/lib/search/pagination';
import { SearchParams } from '@/types/travel';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

type ResultsPaginationProps = {
  params: SearchParams;
  /**
   * Current presentable browse total (B pool). Used only as a mount/ready signal
   * (hide while still 0). Does NOT drive the visible page count — that is fixed
   * to the browse cap (150 → 15 pages).
   */
  totalResults: number;
  /**
   * D-v2 hasMore (owner 25-09 18:50): more presentable B beyond the current page
   * window / beyond the browse semantics. Kept for callers and `data-has-more`;
   * the numbered page list is always the stable browse page count (1–15).
   */
  hasMore?: boolean;
};

/** Always list every browse page (no ellipsis growth/collapse). */
function browsePageItems(totalPages: number): number[] {
  return Array.from({ length: totalPages }, (_, i) => i + 1);
}

export function ResultsPagination({ params, totalResults, hasMore }: ResultsPaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [isNavigating, setIsNavigating] = useState(false);
  const navigationLockRef = useRef(false);

  // Owner 25-09 23:03: no fullscreen loading overlay in the Results flow; busy only drives this control.
  const pageBusy = isNavigating || isPending;

  useEffect(() => {
    navigationLockRef.current = false;
    setIsNavigating(false);
  }, [searchParams]);

  const currentPage = params.page ?? RESULTS_PAGE_DEFAULT;
  const pageSize = params.pageSize ?? RESULTS_PAGE_SIZE_DEFAULT;
  // Product: stable 1..15 from browse cap — not live B growth.
  const totalPages = getResultsBrowsePageCount(pageSize);
  const items = browsePageItems(totalPages);
  // "Volgende" stays within the fixed browse window (independent of live B growth).
  const hasNext = currentPage < totalPages;

  // Not ready / empty placeholder (e.g. price-sort shell with totalResults=0).
  if (totalResults <= 0) {
    return null;
  }

  const goToPage = (page: number) => {
    if (page === currentPage || navigationLockRef.current || pageBusy) {
      return;
    }
    if (page < 1 || page > totalPages) {
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
      <nav
        aria-label="Paginatie"
        data-browse-pages={String(totalPages)}
        data-has-more={hasMore ? 'true' : 'false'}
        className="mt-8 flex flex-wrap items-center justify-center gap-2"
      >
        {items.map((item) => (
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
        ))}
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
