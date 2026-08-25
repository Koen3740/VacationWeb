import type { TravelOffer } from '../feeds/canonical/travel-offer';

const CATALOG_DURATION_DAYS_PROVIDERS = new Set(['Corendon', 'Sunweb', 'Eliza']);

function normalizeDurationType(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.toLowerCase();
}

/** Catalog `offer.nights` stores trip days for Corendon, Sunweb and Eliza. */
export function catalogDurationUsesDays(
  offer: Pick<TravelOffer, 'provider' | 'durationType'>,
): boolean {
  const durationType = normalizeDurationType(offer.durationType);
  if (
    durationType === 'dagen'
    || durationType === 'dag'
    || durationType === 'days'
    || durationType === 'day'
  ) {
    return true;
  }
  return CATALOG_DURATION_DAYS_PROVIDERS.has(offer.provider);
}

export function formatCatalogDurationDaysLabel(days: number): string {
  return `${days} ${days === 1 ? 'dag' : 'dagen'}`;
}

/**
 * Calendar-day offset from departure to return for display.
 * Sunweb/Eliza catalog values are days; Corendon catalog days map to nights + 1.
 */
export function catalogReturnDateOffsetDays(offer: TravelOffer): number | undefined {
  if (!offer.nights || offer.nights < 1) {
    return undefined;
  }
  if (offer.provider === 'Corendon') {
    return offer.nights - 1;
  }
  if (catalogDurationUsesDays(offer)) {
    return offer.nights;
  }
  return offer.nights;
}
