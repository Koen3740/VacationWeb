/**
 * Live-pricing candidate / workset selection (AN-061 P0.1 + P0.3).
 * Prefers offers that can build live context and whose provider circuit is closed.
 * Does not shrink the user catalog matchset — selection is for live HTTP only.
 *
 * Already-cached overlays (B/A/C/unpriced) stay eligible for the live window so
 * proven prices remain in the price-sort refine set.
 */

import type { SearchParams, TravelOffer } from '@/types/travel';
import {
  isLivePriceCircuitOpen,
  type LivePriceCircuitProvider,
} from '@/lib/providers/live-price-circuit';
import { isCorendon } from '@/lib/providers/corendon';
import { isEliza } from '@/lib/providers/eliza';
import { isSunweb } from '@/lib/providers/sunweb';
import { PRIJSVRIJ_PROVIDER_NAME } from '@/lib/providers/prijsvrij/constants';
import {
  RESULTS_LIVE_PRICING_CANDIDATE_CAP,
  RESULTS_LIVE_PRICING_INITIAL_WORKSET,
} from '@/lib/search/pagination';
import {
  canAttemptLivePrice,
  isLivePriceProviderOffer,
} from '@/lib/search/live-price-context-gate';
import {
  noteMissingContextSkipped,
  noteWorksetSkippedCircuitOpen,
} from '@/lib/search/live-price-observability';
import { hasResultsLivePriceOverlay } from '@/lib/search/results-live-price-cache';

export function livePriceCircuitProviderForOffer(
  offer: Pick<TravelOffer, 'provider'>,
): LivePriceCircuitProvider | null {
  if (isCorendon(offer)) {
    return 'corendon';
  }
  if (isSunweb(offer)) {
    return 'sunweb';
  }
  if (isEliza(offer)) {
    return 'eliza';
  }
  if (offer.provider === PRIJSVRIJ_PROVIDER_NAME) {
    return 'prijsvrij';
  }
  return null;
}

export function isOfferLivePriceCircuitOpen(offer: Pick<TravelOffer, 'provider'>): boolean {
  const provider = livePriceCircuitProviderForOffer(offer);
  return provider != null && isLivePriceCircuitOpen(provider);
}

/** Eligible for live window: cached overlay already, or context can be built. */
export function isLiveWindowEligible(offer: TravelOffer, params: SearchParams): boolean {
  if (!isLivePriceProviderOffer(offer, params)) {
    return false;
  }
  if (hasResultsLivePriceOverlay(offer.id, params)) {
    return true;
  }
  return canAttemptLivePrice(offer, params);
}

/**
 * Select up to `cap` live-window offers in catalog rank order.
 * Skips offers that cannot build live context and have no cache overlay
 * (they stay in the browse set). When `preferClosedCircuit` is true (workset),
 * prefers providers whose circuit is closed.
 */
export function selectLivePricingCandidates(
  ranked: readonly TravelOffer[],
  params: SearchParams,
  cap: number,
  options: { preferClosedCircuit?: boolean; recordStats?: boolean } = {},
): TravelOffer[] {
  const preferClosed = options.preferClosedCircuit === true;
  const closed: TravelOffer[] = [];
  const openCircuit: TravelOffer[] = [];
  let missingSkipped = 0;
  let circuitSkipped = 0;

  for (const offer of ranked) {
    if (!isLivePriceProviderOffer(offer, params)) {
      continue;
    }
    if (!isLiveWindowEligible(offer, params)) {
      missingSkipped += 1;
      continue;
    }
    const hasOverlay = hasResultsLivePriceOverlay(offer.id, params);
    if (preferClosed && !hasOverlay && isOfferLivePriceCircuitOpen(offer)) {
      openCircuit.push(offer);
      circuitSkipped += 1;
      continue;
    }
    closed.push(offer);
    if (closed.length >= cap) {
      break;
    }
  }

  let selected: TravelOffer[];
  if (!preferClosed) {
    selected = closed.slice(0, Math.max(0, cap));
  } else if (closed.length >= cap) {
    selected = closed.slice(0, cap);
  } else {
    selected = [...closed, ...openCircuit].slice(0, Math.max(0, cap));
    const takenOpen = Math.max(0, selected.length - closed.length);
    circuitSkipped = Math.max(0, openCircuit.length - takenOpen);
  }

  if (options.recordStats) {
    if (missingSkipped > 0) {
      noteMissingContextSkipped(missingSkipped);
    }
    if (preferClosed && circuitSkipped > 0) {
      noteWorksetSkippedCircuitOpen(circuitSkipped);
    }
  }

  return selected;
}

export function selectLivePricingCandidateWindow(
  ranked: readonly TravelOffer[],
  params: SearchParams,
  cap: number = RESULTS_LIVE_PRICING_CANDIDATE_CAP,
): TravelOffer[] {
  return selectLivePricingCandidates(ranked, params, cap, {
    preferClosedCircuit: false,
    recordStats: true,
  });
}

export function selectLivePricingInitialWorkset(
  rankedPriceable: readonly TravelOffer[],
  params: SearchParams,
  cap: number = RESULTS_LIVE_PRICING_INITIAL_WORKSET,
): TravelOffer[] {
  return selectLivePricingCandidates(rankedPriceable, params, cap, {
    preferClosedCircuit: true,
    recordStats: true,
  });
}

/** Offers in `ranked` that are not in the live window (browse remainder). */
export function livePricingBrowseRemainder(
  ranked: readonly TravelOffer[],
  liveWindow: readonly TravelOffer[],
): TravelOffer[] {
  const inWindow = new Set(liveWindow.map((offer) => offer.id));
  return ranked.filter((offer) => !inWindow.has(offer.id));
}
