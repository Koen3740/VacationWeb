'use client';

import { useReportResultsNavigationBusy } from '@/components/results/results-navigation-busy';
import { ResultsRefinementRequired } from '@/components/results/results-refinement-required';
import {
  buildResultsPageHref,
  buildCompactPaginationItems,
  clampResultsPage,
  getResultsTotalPages,
  RESULTS_PAGE_DEFAULT,
  RESULTS_PAGE_SIZE_DEFAULT,
  resultsNextControlKind,
} from '@/lib/search/pagination';
import { SearchParams } from '@/types/travel';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

type ResultsPaginationProps = {
  params: SearchParams;
  /**
   * Current presentable browse total (B pool for this Results context, ≤150).
   * Drives visible page count: min(15, ceil(total / pageSize)).
   */
  totalResults: number;
  /**
   * D-v2 hasMore: more presentable B beyond the current page window.
   * Kept for callers and `data-has-more`.
   */
  hasMore?: boolean;
};

export function ResultsPagination({ params, totalResults, hasMore }: ResultsPaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [isNavigating, setIsNavigating] = useState(false);
  const [browseCapOpen, setBrowseCapOpen] = useState(false);
  const navigationLockRef = useRef(false);

  // Owner 25-09 23:03: no fullscreen loading overlay in the Results flow; busy only drives this control.
  const pageBusy = isNavigating || isPending;
  useReportResultsNavigationBusy(pageBusy);

  useEffect(() => {
    navigationLockRef.current = false;
    setIsNavigating(false);
  }, [searchParams]);

  const currentPage = params.page ?? RESULTS_PAGE_DEFAULT;
  const pageSize = params.pageSize ?? RESULTS_PAGE_SIZE_DEFAULT;
  const totalPages = getResultsTotalPages(totalResults, pageSize);
  const items = buildCompactPaginationItems(currentPage, totalPages);
  const nextKind = resultsNextControlKind({ currentPage, totalPages });
  const showNext = nextKind !== 'hidden';

  // Invalid ?page=N beyond the effective pool → correct to a valid page (no empty Results).
  useEffect(() => {
    if (totalResults <= 0 || pageBusy || navigationLockRef.current) {
      return;
    }
    const clamped = clampResultsPage(currentPage, totalPages);
    if (clamped === currentPage) {
      return;
    }
    navigationLockRef.current = true;
    setIsNavigating(true);
    startTransition(() => {
      router.replace(buildResultsPageHref(params, clamped));
    });
  }, [currentPage, totalPages, totalResults, pageBusy, params, router]);

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
        className="mt-8 flex flex-wrap items-center justify-center gap-1.5"
      >
        {items.map((item, index) =>
          item === 'ellipsis' ? (
            <span
              key={`ellipsis-${index}`}
              aria-hidden
              className="inline-flex h-9 min-w-7 items-center justify-center px-1 text-sm text-[#8A93A3]"
            >
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
              className={`inline-flex h-9 min-w-9 items-center justify-center rounded-[8px] px-2.5 text-sm font-semibold disabled:cursor-wait ${
                item === currentPage
                  ? 'bg-[#0A2D62] text-white'
                  : 'border border-[#D9E0EA] bg-white text-[#334155] hover:border-[#89ACD3] disabled:opacity-80'
              }`}
            >
              {item}
            </button>
          ),
        )}
        {showNext ? (
          <button
            type="button"
            onClick={() => {
              if (nextKind === 'browse-cap') {
                setBrowseCapOpen(true);
                return;
              }
              goToPage(currentPage + 1);
            }}
            disabled={pageBusy && nextKind === 'page'}
            aria-busy={pageBusy && nextKind === 'page'}
            className="ml-1 inline-flex h-9 items-center rounded-[8px] px-2.5 text-sm font-semibold text-[#0A2D62] disabled:cursor-wait disabled:opacity-80"
          >
            Volgende &gt;
          </button>
        ) : null}
      </nav>
      {browseCapOpen ? (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-[rgba(10,45,98,0.38)] p-4"
          role="presentation"
          onClick={() => setBrowseCapOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Maximaal 150 resultaten"
            data-testid="results-browse-cap-dialog"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto"
            onClick={(event) => event.stopPropagation()}
          >
            <ResultsRefinementRequired />
            <div className="mt-3 text-center">
              <button
                type="button"
                className="text-sm font-semibold text-[#0A2D62] underline-offset-2 hover:underline"
                onClick={() => setBrowseCapOpen(false)}
              >
                Sluiten
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
