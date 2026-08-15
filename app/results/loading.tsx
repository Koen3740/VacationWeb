'use client';

import { SearchProgressFeedback } from '@/components/search/search-progress-feedback';

/**
 * Instant loading UI for /results (first search and page 2+ navigations).
 * Immediate feedback for slow page-1 Receipt; client overlays add the 2s-delayed
 * pattern for filter/sort/search/pagination soft navigations.
 */
export default function ResultsLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F3F5F8]">
      <SearchProgressFeedback />
    </main>
  );
}
