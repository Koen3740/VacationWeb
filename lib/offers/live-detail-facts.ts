/**
 * Optional facts copied off a live response we already fetched.
 * Absent fields stay off the offer. Nothing here is derived from other prices.
 */

export type LiveFlightLeg = {
  direction: 'outbound' | 'inbound';
  departureAirportCode?: string;
  arrivalAirportCode?: string;
  /** Local clock time HH:MM as delivered by the provider. */
  departureAt?: string;
  arrivalAt?: string;
  airlineName?: string;
  airlineCode?: string;
  flightNumber?: string;
  /** `freeLuggageWeight` in kilograms. Cabin vs checked is not labeled by the field. */
  baggageKg?: number;
};

export type LiveTransferFact = {
  status: 'included' | 'bookable';
  remark?: string;
  price?: number;
};

export type LiveDetailFacts = {
  flights?: LiveFlightLeg[];
  arrivalAirport?: string;
  transfer?: LiveTransferFact;
  /** Provider original occupancy total. Shown only when it is higher than the current total. */
  listPrice?: number;
  /** Provider discount percentage. Never computed from the two totals. */
  discountPercentage?: number;
};

export function promotedListFacts(
  originalTotalPrice: number | undefined,
  discountPercentage: number | undefined,
): LiveDetailFacts | undefined {
  const facts: LiveDetailFacts = {};
  if (isPositive(originalTotalPrice)) {
    facts.listPrice = originalTotalPrice;
  }
  if (
    typeof discountPercentage === 'number'
    && Number.isFinite(discountPercentage)
    && discountPercentage > 0
    && discountPercentage < 100
  ) {
    facts.discountPercentage = discountPercentage;
  }
  return facts.listPrice != null || facts.discountPercentage != null ? facts : undefined;
}

function isPositive(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}
