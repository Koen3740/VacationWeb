import type { TravelOffer } from '@/types/travel';
import {
  LIVE_PRICE_ATTEMPT_REASON,
  type LivePriceAttemptReason,
} from '@/lib/search/live-price-observability';

export const PRIJSVRIJ_PROVIDER_NAME = 'Prijsvrij';
export const CORENDON_PROVIDER_NAME = 'Corendon';
export const SUNWEB_PROVIDER_NAME = 'Sunweb';
export const ELIZA_PROVIDER_NAME = 'Eliza was here';

/** User-facing Results/Detail copy. UNPRICED must not reuse UNAVAILABLE wording. */
export const RESULTS_PRICE_COPY = {
  pending: 'Actuele prijs volgt',
  unpriced: 'Geen bevestigde prijs voor deze samenstelling',
  unavailable: 'Actuele prijs niet beschikbaar',
} as const;

export type ResultsPricePresentationKind = 'amount' | 'pending' | 'unpriced' | 'unavailable';

/**
 * Provider confirmed the exact trip is not bookable for this request.
 * Not timeouts, network errors, missing mapping context, or occupancy-unpriced.
 */
const PROVIDER_CONFIRMED_UNAVAILABLE_REASONS: ReadonlySet<string> = new Set([
  LIVE_PRICE_ATTEMPT_REASON.http_204,
  LIVE_PRICE_ATTEMPT_REASON.provider_empty,
  LIVE_PRICE_ATTEMPT_REASON.no_trip,
  LIVE_PRICE_ATTEMPT_REASON.unavailable_trip,
  LIVE_PRICE_ATTEMPT_REASON.invalid_price,
  LIVE_PRICE_ATTEMPT_REASON.empty_receipt,
  LIVE_PRICE_ATTEMPT_REASON.missing_package,
  LIVE_PRICE_ATTEMPT_REASON.invalid_total,
]);

export function isProviderConfirmedUnavailableReason(
  reason: string | undefined | null,
): reason is LivePriceAttemptReason {
  return Boolean(reason && PROVIDER_CONFIRMED_UNAVAILABLE_REASONS.has(reason));
}

/** Exact trip unavailable per provider live response — not a Results card. */
export function isProviderConfirmedUnavailable(offer: TravelOffer): boolean {
  return (
    offer.livePriceStatus === 'unavailable' &&
    isProviderConfirmedUnavailableReason(offer.livePriceFailureReason)
  );
}

/**
 * Product rule: only a valid allowed price may be shown.
 * No "Prijs op aanvraag", €0, feed-as-live, Search, or Matrix fallback.
 */
export function isValidNumericPrice(price: unknown): price is number {
  return typeof price === 'number' && Number.isFinite(price) && price > 0;
}

/** Prijsvrij is PARKED: not a visible Results provider. Receipt is not a Results price path. */
export function isParkedResultsProvider(provider: string): boolean {
  return provider === PRIJSVRIJ_PROVIDER_NAME;
}

export function excludeParkedResultsProviders<T extends { provider: string }>(
  offers: readonly T[],
): T[] {
  return offers.filter((offer) => !isParkedResultsProvider(offer.provider));
}

export type LiveTotalPriceField = NonNullable<TravelOffer['liveTotalPriceField']>;

export function isValidLiveTotalAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/**
 * Proven live package total from the provider response.
 * Never true for feed / search / matrix / lowestpricesacco / derived pp × pax.
 */
export function hasProvenLiveTotalPrice(offer: TravelOffer): boolean {
  if (!isValidLiveTotalAmount(offer.liveTotalPrice) || offer.livePriceStatus !== 'proven') {
    return false;
  }
  if (offer.livePriceSource === 'upsales') {
    return (
      offer.liveTotalPriceField === 'upsales.totalPrice' ||
      offer.liveTotalPriceField === 'upsales.realTimeBlankPrice'
    );
  }
  if (offer.livePriceSource === 'receipt') {
    return offer.liveTotalPriceField === 'receipt.TotalInclLocal';
  }
  if (offer.livePriceSource === 'getPromotedPrice') {
    return offer.liveTotalPriceField === 'getPromotedPrice.totalPrice';
  }
  return false;
}

/** Amounts may only come from a proven live-price route. Feed € is never a live amount. */
export function hasProvenLiveDisplayPrice(offer: TravelOffer): boolean {
  if (!isValidNumericPrice(offer.price) || offer.livePriceStatus !== 'proven') {
    return false;
  }
  if (offer.provider === PRIJSVRIJ_PROVIDER_NAME) {
    // PARKED for Results via excludeParkedResultsProviders.
    // Receipt remains the only internally proven Prijsvrij source if ever unparked.
    return offer.livePriceSource === 'receipt';
  }
  if (offer.provider === CORENDON_PROVIDER_NAME) {
    return offer.livePriceSource === 'lowestpricesacco' || offer.livePriceSource === 'upsales';
  }
  if (offer.provider === ELIZA_PROVIDER_NAME || offer.provider === SUNWEB_PROVIDER_NAME) {
    return offer.livePriceSource === 'getPromotedPrice';
  }
  return false;
}

/**
 * Results admission after the existing live-price flow:
 * proven live p.p. AND a proven live provider total for this occupancy.
 * Feed / search / matrix / lowestpricesacco / derived pp × pax never qualify.
 * Corendon 2A is Results-presentable only when party ISO DOBs produced an upsales total.
 */
export function hasValidPresentablePrice(offer: TravelOffer): boolean {
  return hasProvenLiveDisplayPrice(offer) && hasProvenLiveTotalPrice(offer);
}

/**
 * Corendon proven live hop without a provider total is outside the proven
 * Results price route (needs occupancy that yields an upsales total).
 * Show as unpriced — not as a hard "niet beschikbaar" failure.
 */
export function isCorendonLiveWithoutPresentableTotal(offer: TravelOffer): boolean {
  return (
    offer.provider === CORENDON_PROVIDER_NAME &&
    offer.livePriceStatus === 'proven' &&
    (offer.livePriceSource === 'lowestpricesacco' || offer.livePriceSource === 'upsales') &&
    !hasProvenLiveTotalPrice(offer)
  );
}

export function filterToPresentableOffers(offers: TravelOffer[]): TravelOffer[] {
  return offers.filter(hasValidPresentablePrice);
}

/** Occupancy is outside the current proven live-price route. Not the same as unavailable. */
export function isUnpricedResultsOffer(offer: TravelOffer): boolean {
  return offer.livePriceStatus === 'unpriced' || isCorendonLiveWithoutPresentableTotal(offer);
}

/**
 * Live-price overlay gate: the card may show an actuele € only when this is true.
 * Not a Results list-admission gate. Catalog cards stay visible without this.
 */
export function isResultsVisibleOffer(offer: TravelOffer): boolean {
  return hasValidPresentablePrice(offer);
}

export function filterToResultsVisibleOffers(offers: TravelOffer[]): TravelOffer[] {
  return offers.filter(isResultsVisibleOffer);
}

/**
 * Results list admission (A/B/C):
 * - Parked providers → not listable
 * - A (provider-confirmed unavailable) → not listable / not bookable card
 * - B (proven presentable) → listable
 * - pending / catalog / unset → listable (provisional UI)
 * - C (technical failure, often stamped livePriceStatus=unavailable with
 *   timeout/stale_context/network_error/…) → listable; no fake €
 * - unpriced / proven-without-total → listable; no fake €
 *
 * Live pricing must NOT remove catalog matches from Results membership.
 * Only true provider-confirmed unavailable (A) leaves bookable presentation.
 */
export function isResultsListableOffer(offer: TravelOffer): boolean {
  if (isParkedResultsProvider(offer.provider)) {
    return false;
  }
  if (isProviderConfirmedUnavailable(offer)) {
    return false;
  }
  return true;
}

export function filterToResultsListableOffers(offers: TravelOffer[]): TravelOffer[] {
  return offers.filter(isResultsListableOffer);
}

/**
 * Maps TravelOffer live-price status to the Results/Detail price panel.
 * SUCCESS → amount; pending / catalog (price not yet available) → pending;
 * otherwise no amount. Missing price must not be treated as “no match”.
 */
export function resultsPricePresentation(
  offer: TravelOffer,
  options: { provisional?: boolean } = {},
): ResultsPricePresentationKind {
  if (hasValidPresentablePrice(offer)) {
    return 'amount';
  }
  if (options.provisional) {
    return 'pending';
  }
  if (isUnpricedResultsOffer(offer)) {
    return 'unpriced';
  }
  // Technical C often shares livePriceStatus=unavailable with A; only A is
  // provider-confirmed. C stays visible with "prijs niet beschikbaar" copy —
  // never invent a catalog/feed € as actuele prijs.
  if (
    offer.livePriceStatus === 'unavailable' &&
    !isProviderConfirmedUnavailable(offer)
  ) {
    return 'unavailable';
  }
  // Catalog / unset: price not yet available — still a Results match.
  if (offer.livePriceStatus !== 'unavailable' && offer.livePriceStatus !== 'proven') {
    return 'pending';
  }
  return 'unavailable';
}
