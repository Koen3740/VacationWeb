import type { TravelOffer } from '@/types/travel';
import type { SearchParams } from '@/types/travel';
import { occupancyCategoryFromSearchParams } from '@/lib/search/occupancy-category';
import { getLivePriceObservabilitySnapshot } from '@/lib/search/live-price-observability';
import {
  CORENDON_PROVIDER_NAME,
  ELIZA_PROVIDER_NAME,
  hasProvenLiveDisplayPrice,
  isResultsVisibleOffer,
  isUnpricedResultsOffer,
  PRIJSVRIJ_PROVIDER_NAME,
  SUNWEB_PROVIDER_NAME,
} from '@/lib/search/presentable-price';

export const RESULTS_PRICE_ELIGIBILITY_PROVIDERS = [
  CORENDON_PROVIDER_NAME,
  SUNWEB_PROVIDER_NAME,
  ELIZA_PROVIDER_NAME,
  PRIJSVRIJ_PROVIDER_NAME,
] as const;

export type ResultsPriceEligibilityBucket =
  | 'SUCCESS'
  | 'UNPRICED'
  | 'UNAVAILABLE'
  | 'NO_PROVEN_PRICE';

export type ResultsPriceEligibilityRow = {
  provider: string;
  /** Unique offer IDs in the input set (before the visibility gate). */
  beforeGate: number;
  SUCCESS: number;
  UNPRICED: number;
  UNAVAILABLE: number;
  /** Catalog/feed without a proven live p.p. price and not stamped unpriced. */
  NO_PROVEN_PRICE: number;
  shown: number;
  excluded: number;
};

export type ResultsPriceEligibilitySnapshot = {
  occupancyCategory: string;
  rooms: number;
  uniqueOffers: number;
  shown: number;
  excluded: number;
  phase?: string;
  /**
   * Live-price ERROR unique-offer counts from process observability.
   * Not inferred from TravelOffer (ERROR is collapsed to unavailable there).
   */
  errorUniqueByProvider: Record<string, number>;
  errorAttempts: number;
  byProvider: Record<string, ResultsPriceEligibilityRow>;
};

const emptyRow = (provider: string): ResultsPriceEligibilityRow => ({
  provider,
  beforeGate: 0,
  SUCCESS: 0,
  UNPRICED: 0,
  UNAVAILABLE: 0,
  NO_PROVEN_PRICE: 0,
  shown: 0,
  excluded: 0,
});

export function classifyResultsPriceEligibility(offer: TravelOffer): ResultsPriceEligibilityBucket {
  if (hasProvenLiveDisplayPrice(offer)) {
    return 'SUCCESS';
  }
  if (isUnpricedResultsOffer(offer)) {
    return 'UNPRICED';
  }
  if (offer.livePriceStatus === 'unavailable') {
    return 'UNAVAILABLE';
  }
  return 'NO_PROVEN_PRICE';
}

export function measureResultsPriceEligibility(
  offers: readonly TravelOffer[],
  params: SearchParams,
): ResultsPriceEligibilitySnapshot {
  const byProvider = new Map<string, ResultsPriceEligibilityRow>();
  const seen = new Set<string>();

  for (const offer of offers) {
    if (seen.has(offer.id)) {
      continue;
    }
    seen.add(offer.id);
    const row = byProvider.get(offer.provider) ?? emptyRow(offer.provider);
    row.beforeGate += 1;
    const bucket = classifyResultsPriceEligibility(offer);
    row[bucket] += 1;
    if (isResultsVisibleOffer(offer)) {
      row.shown += 1;
    } else {
      row.excluded += 1;
    }
    byProvider.set(offer.provider, row);
  }

  const rows = [...byProvider.values()];
  const obs = getLivePriceObservabilitySnapshot();
  const errorUniqueByProvider: Record<string, number> = {};
  for (const provider of RESULTS_PRICE_ELIGIBILITY_PROVIDERS) {
    errorUniqueByProvider[provider] = obs.uniqueOffersByProvider[provider]?.ERROR ?? 0;
  }
  return {
    occupancyCategory: occupancyCategoryFromSearchParams(params),
    rooms: Math.max(1, params.rooms ?? 1),
    uniqueOffers: seen.size,
    shown: rows.reduce((sum, row) => sum + row.shown, 0),
    excluded: rows.reduce((sum, row) => sum + row.excluded, 0),
    errorUniqueByProvider,
    errorAttempts: obs.error,
    byProvider: Object.fromEntries(rows.map((row) => [row.provider, row])),
  };
}

let lastSnapshot: ResultsPriceEligibilitySnapshot | null = null;

export function recordResultsPriceEligibility(
  offers: readonly TravelOffer[],
  params: SearchParams,
  options: { phase?: string } = {},
): ResultsPriceEligibilitySnapshot {
  const snapshot = {
    ...measureResultsPriceEligibility(offers, params),
    phase: options.phase,
  };
  lastSnapshot = snapshot;
  if (process.env.NODE_ENV !== 'test' && !process.env.NODE_TEST_CONTEXT) {
    const parts = RESULTS_PRICE_ELIGIBILITY_PROVIDERS.map((provider) => {
      const row = snapshot.byProvider[provider];
      const errorUnique = snapshot.errorUniqueByProvider[provider] ?? 0;
      if (!row) {
        return `${provider}:0 errorUnique=${errorUnique}`;
      }
      return (
        `${provider} before=${row.beforeGate} success=${row.SUCCESS} unpriced=${row.UNPRICED}` +
        ` unavailable=${row.UNAVAILABLE} noProven=${row.NO_PROVEN_PRICE}` +
        ` excluded=${row.excluded} errorUnique=${errorUnique}`
      );
    });
    const phase = snapshot.phase ? ` phase=${snapshot.phase}` : '';
    console.info(
      `[results-price-eligibility] occupancy=${snapshot.occupancyCategory} unique=${snapshot.uniqueOffers}` +
        ` shown=${snapshot.shown} excluded=${snapshot.excluded} errorAttempts=${snapshot.errorAttempts}` +
        `${phase} | ${parts.join(' | ')}`,
    );
  }
  return snapshot;
}

export function getLastResultsPriceEligibilitySnapshot(): ResultsPriceEligibilitySnapshot | null {
  return lastSnapshot;
}

export function clearResultsPriceEligibilityForTests(): void {
  lastSnapshot = null;
}
