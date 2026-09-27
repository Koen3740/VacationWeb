/**
 * User-facing Results count labels (hero vs section).
 * Pure strings — no React / prepare I/O.
 */

/** Hero = original search context count (never provider-filtered). */
export function formatHeroCountLabel(count: number, summaryLine: string): string {
  const first = summaryLine.split(' • ')[0]?.trim() ?? '';
  const looksLikeDestination =
    first.length > 0 && !/\d/.test(first) && !/volwassene/i.test(first);
  if (count > 0 && looksLikeDestination) {
    return `${count} vakanties in ${first}`;
  }
  if (count > 0) {
    return `${count} vakanties gevonden`;
  }
  return 'Geen vakanties gevonden';
}

/**
 * Results section heading = effective pool count.
 * Provider suffix only when a specific provider filter is active.
 */
export function formatSectionCountLabel(count: number, provider?: string): string {
  if (count > 0) {
    const trimmed = provider?.trim();
    if (trimmed) {
      return `${count} vakanties gevonden bij ${trimmed}`;
    }
    return `${count} vakanties gevonden`;
  }
  return 'Geen vakanties gevonden';
}
