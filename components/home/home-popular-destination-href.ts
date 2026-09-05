/** Homepage card label → Results country/region query. Canaries is a Spanish region, not a country. */
const DESTINATION_SEARCH_LOCATION: Record<string, { country: string; region?: string }> = {
  'Canarische Eilanden': { country: 'Spanje', region: 'Canarische Eilanden' },
};

export function buildPopularDestinationHref(destinationName: string): string {
  const mapped = DESTINATION_SEARCH_LOCATION[destinationName];
  const params = new URLSearchParams();
  params.set('country', mapped?.country ?? destinationName);
  if (mapped?.region) {
    params.set('region', mapped.region);
  }
  return `/results?${params.toString()}`;
}
