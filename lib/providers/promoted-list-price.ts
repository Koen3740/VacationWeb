/**
 * Optional strike-through fields on a GetPromotedPrice `price` object.
 * Zero and missing values are not prices. The percentage is never derived.
 */

export type PromotedListPrice = {
  originalTotalPrice?: number;
  discountPercentage?: number;
};

function positive(value: unknown): number | undefined {
  const numeric = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return undefined;
  }
  return numeric;
}

export function readPromotedListPrice(price: unknown): PromotedListPrice {
  if (!price || typeof price !== 'object') {
    return {};
  }
  const record = price as { originalTotalPrice?: unknown; discountPercentage?: unknown };
  const originalTotalPrice = positive(record.originalTotalPrice);
  const discountRaw = positive(record.discountPercentage);
  const discountPercentage = discountRaw != null && discountRaw < 100 ? discountRaw : undefined;
  return {
    ...(originalTotalPrice != null ? { originalTotalPrice } : {}),
    ...(discountPercentage != null ? { discountPercentage } : {}),
  };
}
