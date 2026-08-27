'use client';

import { ResultsAdjustSearchFab } from '@/components/results-v2/results-adjust-search-fab';
import { ResultsHero } from '@/components/results-v2/results-hero';
import { DEFAULT_RESULTS_HERO_SUBTITLE } from '@/components/results-v2/results-intro-copy';
import { ResultsSearchBar } from '@/components/results-v2/results-search-bar';
import { ResultsSiteHeader } from '@/components/results-v2/results-site-header';
import { ResultsUspBar } from '@/components/results-v2/results-usp-bar';
import type { ReactNode } from 'react';

type ResultsPageClientProps = {
  departureAirports: string[];
  resultCount: number;
  summaryLine: string;
  sortControl: ReactNode;
  filters: ReactNode;
  results: ReactNode;
  pagination: ReactNode;
};

function buildHeroTitle(resultCount: number, summaryLine: string): string {
  const first = summaryLine.split(' • ')[0]?.trim() ?? '';
  const looksLikeDestination =
    first.length > 0 && !/\d/.test(first) && !/volwassene/i.test(first);

  if (resultCount > 0 && looksLikeDestination) {
    return `${resultCount} vakanties in ${first}`;
  }

  if (resultCount > 0) {
    return `${resultCount} vakanties gevonden`;
  }

  return 'Geen vakanties gevonden';
}

export function ResultsPageClient({
  departureAirports,
  resultCount,
  summaryLine,
  sortControl,
  filters,
  results,
  pagination,
}: ResultsPageClientProps) {
  const heroTitle = buildHeroTitle(resultCount, summaryLine);

  return (
    <div className="min-h-screen bg-[#F3F5F8] text-slate-900">
      <ResultsSiteHeader />
      <ResultsHero
        intro={{
          heroTitle,
          heroSubtitle: DEFAULT_RESULTS_HERO_SUBTITLE,
        }}
        searchBar={<ResultsSearchBar departureAirports={departureAirports} />}
      />

      <main className="mx-auto max-w-[1600px] px-6 pb-10 pt-10 lg:px-8 lg:pt-12">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[270px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)]">
          {filters}

          <section className="mx-auto min-w-0 w-full max-w-[904px]">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-[22px] font-bold tracking-tight text-[#0A2D62]">
                  {resultCount} vakanties gevonden
                </h2>
                {summaryLine ? (
                  <p className="mt-1.5 text-[13px] text-[#64748B]">{summaryLine}</p>
                ) : null}
              </div>
              <div className="shrink-0">{sortControl}</div>
            </div>

            {results}
            {pagination}
          </section>
        </div>
      </main>

      <ResultsUspBar />
      <ResultsAdjustSearchFab />
    </div>
  );
}
