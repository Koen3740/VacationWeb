'use client';

import {
  ResultsDelayedNavigationNotice,
  ResultsNavigationBusyProvider,
} from '@/components/results/results-navigation-busy';
import { ResultsAdjustSearchFab } from '@/components/results-v2/results-adjust-search-fab';
import {
  ResultsActiveFilters,
  useResultsFilterChips,
} from '@/components/results-v2/results-active-filters';
import { ResultsFilterSheet } from '@/components/results-v2/results-filter-sheet';
import { ResultsSearchBar } from '@/components/results-v2/results-search-bar';
import { ResultsSiteHeader } from '@/components/results-v2/results-site-header';
import { ResultsUspBar } from '@/components/results-v2/results-usp-bar';
import { useCallback, useState, type ReactNode } from 'react';

type ResultsPageClientProps = {
  departureAirports: string[];
  resultCount?: number;
  /** GO5: streamed hero title (presentable B count). Kept for callers; Layout A shows one heading. */
  heroTitle?: ReactNode;
  /** GO5: streamed section heading (presentable B count). */
  sectionHeading?: ReactNode;
  summaryLine: string;
  /** Period · days · travellers, shown under the count. */
  tripSummary: string;
  sortControl: ReactNode;
  filters: ReactNode;
  results: ReactNode;
  pagination: ReactNode;
  /** When the matchset exceeds the product limit, hide counts and use refinement copy. */
  refinementRequired?: boolean;
};

const REFINEMENT_HEADING = 'Maak je zoekopdracht iets specifieker';

export function ResultsPageClient({
  departureAirports,
  resultCount = 0,
  sectionHeading,
  tripSummary,
  sortControl,
  filters,
  results,
  pagination,
  refinementRequired = false,
}: ResultsPageClientProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const closeFilters = useCallback(() => setFiltersOpen(false), []);
  const { chips, removeChip, clearFilters } = useResultsFilterChips();
  const resolvedSectionHeading =
    sectionHeading ??
    (refinementRequired
      ? REFINEMENT_HEADING
      : resultCount > 0
        ? `${resultCount} vakanties gevonden`
        : 'Geen vakanties gevonden');

  return (
    <ResultsNavigationBusyProvider>
      <div className="min-h-screen bg-vw-bg font-vw-sans text-vw-ink">
        <ResultsSiteHeader appearance="results" />

        <div className="mx-auto mt-3.5 max-w-vw-page px-4 min-[901px]:px-7">
          <ResultsSearchBar departureAirports={departureAirports} />
        </div>

        <main className="mx-auto max-w-vw-page px-4 pb-10 pt-[18px] min-[901px]:px-7 min-[901px]:pb-10 min-[901px]:pt-[30px]">
          <div className="grid grid-cols-1 items-start gap-[34px] min-[901px]:grid-cols-[292px_minmax(0,1fr)]">
            <ResultsFilterSheet open={filtersOpen} onClose={closeFilters} onClear={clearFilters}>
              {filters}
            </ResultsFilterSheet>

            <section className="min-w-0">
              <div className="mb-[18px] flex flex-wrap items-end justify-between gap-x-5 gap-y-3 max-[900px]:mb-0 max-[900px]:block">
                <div className="min-w-0">
                  <h1 className="font-vw-serif text-[27px] font-medium leading-[1.1] tracking-[-0.015em] text-vw-navy min-[901px]:text-[34px]">
                    {resolvedSectionHeading}
                  </h1>
                  {tripSummary ? (
                    <p
                      className="mt-1.5 text-[13.5px] text-vw-muted"
                      data-testid="results-trip-summary"
                    >
                      {tripSummary}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2.5 max-[900px]:sticky max-[900px]:top-0 max-[900px]:z-30 max-[900px]:-mx-4 max-[900px]:mb-3.5 max-[900px]:mt-3 max-[900px]:border-b max-[900px]:border-vw-line max-[900px]:bg-[rgba(246,242,234,0.94)] max-[900px]:px-4 max-[900px]:py-2.5 max-[900px]:backdrop-blur-sm">
                  <button
                    type="button"
                    onClick={() => setFiltersOpen(true)}
                    className="inline-flex h-[42px] shrink-0 items-center gap-2 rounded-vw-control bg-vw-navy px-4 text-[14px] font-semibold text-white min-[901px]:hidden"
                  >
                    Filters
                    {chips.length > 0 ? (
                      <b className="inline-flex h-5 min-w-5 items-center justify-center rounded-[10px] bg-white px-1 text-[11.5px] font-semibold text-vw-navy">
                        {chips.length}
                      </b>
                    ) : null}
                  </button>
                  <div className="min-w-0 flex-1 min-[901px]:flex-none">{sortControl}</div>
                </div>
              </div>

              <ResultsActiveFilters chips={chips} onRemove={removeChip} onClear={clearFilters} />

              <ResultsDelayedNavigationNotice />
              {results}
              {pagination}
            </section>
          </div>
        </main>

        <ResultsUspBar variant="results" />
        <ResultsAdjustSearchFab tone="results" />
      </div>
    </ResultsNavigationBusyProvider>
  );
}
