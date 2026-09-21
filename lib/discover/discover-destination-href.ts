/**
 * Discover editorial destination → existing commercial bridge (Results),
 * same pattern as popular destination cards.
 * Sardinia has no region in destination-index; country Italië is the safe existing filter.
 */
export type DiscoverResultsFilter = {
  country: string;
  region?: string;
};

export const DISCOVER_DESTINATION_RESULTS_FILTER: Readonly<
  Record<string, DiscoverResultsFilter>
> = {
  albania: { country: 'Albanië' },
  crete: { country: 'Griekenland', region: 'Kreta' },
  sicily: { country: 'Italië', region: 'Sicilië' },
  sardinia: { country: 'Italië', region: 'Sardinië' },
};

/** In-app Discover destination experience (Destination Media gallery + CTA). */
export function buildDiscoverDestinationHref(destinationId: string): string {
  return `/ontdekt/${encodeURIComponent(destinationId)}`;
}

/** Results compare CTA from a Discover destination page. */
export function buildDiscoverResultsHref(destinationId: string): string {
  const mapped = DISCOVER_DESTINATION_RESULTS_FILTER[destinationId];
  const params = new URLSearchParams();
  if (mapped) {
    params.set('country', mapped.country);
    if (mapped.region) params.set('region', mapped.region);
  } else {
    params.set('q', destinationId);
  }
  return `/results?${params.toString()}`;
}