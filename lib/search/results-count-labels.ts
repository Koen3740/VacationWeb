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

/**
 * Count-less labels (t333u): used while the proven-B count is still 0 (matchset
 * non-empty). They never claim a count and never say "Geen" - background pricing may
 * still add B later.
 */
export function formatHeroCountUnknownLabel(summaryLine: string): string {
  const first = summaryLine.split(' • ')[0]?.trim() ?? '';
  const looksLikeDestination =
    first.length > 0 && !/\d/.test(first) && !/volwassene/i.test(first);
  return looksLikeDestination ? `Vakanties in ${first}` : 'Vakanties';
}

export function formatSectionCountUnknownLabel(provider?: string): string {
  const trimmed = provider?.trim();
  return trimmed ? `Vakanties bij ${trimmed}` : 'Vakanties';
}

/**
 * t334u: honest intermediate state of the progressive section heading. Only rendered
 * while provable: eligible offers are still unsettled AND pricing progress was seen
 * recently (see results-pool-progress.ts). The count is the proven-B count so far.
 */
export const RESULTS_COUNT_CHECKING_SUFFIX = 'meer worden gecontroleerd';

export function formatSectionCountCheckingLabel(count: number, provider?: string): string {
  if (count > 0) {
    return `${formatSectionCountLabel(count, provider)}, ${RESULTS_COUNT_CHECKING_SUFFIX}`;
  }
  const trimmed = provider?.trim();
  return trimmed
    ? `Vakanties bij ${trimmed} worden gecontroleerd`
    : 'Vakanties worden gecontroleerd';
}

/**
 * Label for one progressive step (t334u). Pure: no I/O.
 * - count > 0 : proven B so far; the section adds "meer worden gecontroleerd" only while
 *   that is provable (step.checking), the hero stays a plain count.
 * - count 0   : never a count and never "Geen" while the matchset is non-empty.
 * - matchset empty : "Geen vakanties gevonden" (definitive, nothing to price).
 */
export function formatPoolCountStep(
  step: { count: number; checking: boolean },
  options: {
    variant: 'hero' | 'section';
    summaryLine: string;
    provider?: string;
    matchsetEmpty: boolean;
  },
): string {
  if (options.matchsetEmpty) {
    return options.variant === 'hero'
      ? formatHeroCountLabel(0, options.summaryLine)
      : formatSectionCountLabel(0, options.provider);
  }
  if (step.count > 0) {
    if (options.variant === 'hero') {
      return formatHeroCountLabel(step.count, options.summaryLine);
    }
    return step.checking
      ? formatSectionCountCheckingLabel(step.count, options.provider)
      : formatSectionCountLabel(step.count, options.provider);
  }
  if (options.variant === 'hero') {
    return formatHeroCountUnknownLabel(options.summaryLine);
  }
  return step.checking
    ? formatSectionCountCheckingLabel(0, options.provider)
    : formatSectionCountUnknownLabel(options.provider);
}
