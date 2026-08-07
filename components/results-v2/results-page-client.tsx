'use client';

import { ResultsAdjustSearchFab } from '@/components/results-v2/results-adjust-search-fab';
import { ResultsHero } from '@/components/results-v2/results-hero';
import {
  RESULTS_INTRO_BY_VARIANT,
  type ResultsIntroVariant,
} from '@/components/results-v2/results-intro-copy';
import { ResultsSearchBar } from '@/components/results-v2/results-search-bar';
import { ResultsSiteHeader } from '@/components/results-v2/results-site-header';
import { ResultsUspBar } from '@/components/results-v2/results-usp-bar';
import { ResultsVariantTabs } from '@/components/results-v2/results-variant-tabs';
import { useMemo, useState, type ReactNode } from 'react';

type ResultsPageClientProps = {
  departureAirports: string[];
  resultCount: number;
  summaryLine: string;
  sortControl: ReactNode;
  filters: ReactNode;
  results: ReactNode;
  pagination: ReactNode;
};

function inferVariant(summaryCountryHint: string): ResultsIntroVariant {
  if (!summaryCountryHint) return 'all';
  if (summaryCountryHint.includes(',')) return 'multi';
  return 'country';
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
  const initialVariant = useMemo(() => inferVariant(summaryLine), [summaryLine]);
  const [variant, setVariant] = useState<ResultsIntroVariant>(initialVariant);
  const intro = RESULTS_INTRO_BY_VARIANT[variant];

  const resultsTitle =
    variant === 'country' || variant === 'region' || variant === 'multi' || variant === 'all'
      ? `${resultCount} vakanties gevonden`
      : intro.resultsTitle;

  return (
    <div className="min-h-screen bg-[#F3F5F8] text-slate-900">
      <ResultsSiteHeader />
      <ResultsHero
        intro={{
          ...intro,
          heroTitle:
            variant === 'country' && resultCount > 0
              ? intro.heroTitle.replace(/^\d+/, String(resultCount))
              : intro.heroTitle,
        }}
        searchBar={<ResultsSearchBar departureAirports={departureAirports} />}
      />

      <main className="mx-auto max-w-[1280px] px-6 pb-10 pt-10 lg:px-8 lg:pt-12">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[270px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)]">
          {filters}

          <section>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <ResultsVariantTabs active={variant} onChange={setVariant} />
              {sortControl}
            </div>

            <div className="mb-5">
              <h2 className="text-[22px] font-bold tracking-tight text-[#0A2D62]">{resultsTitle}</h2>
              <p className="mt-1.5 text-[13px] text-[#64748B]">
                {variant === 'country' || variant === 'region' ? summaryLine || intro.resultsSummary : intro.resultsSummary}
              </p>
              {intro.badges ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {intro.badges.map((badge) => (
                    <span
                      key={badge}
                      className="rounded-full bg-white px-3 py-1 text-[12px] font-semibold text-[#0A2D62] ring-1 ring-[#D9E0EA]"
                    >
                      {badge}
                    </span>
                  ))}
                </div>
              ) : null}
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
