/**
 * Prijsvrij Receipt eind-pp (IBE Bijbel v1.8).
 * pp = ceil(TotalInclLocal / (Adults + Children)); infants not in denominator.
 */

export type PrijsvrijReceiptPriceInfo = {
  totalInclLocal: number;
  adults: number;
  children: number;
  infants: number;
  pricePerPerson: number;
};

export type PrijsvrijReceiptPackageLike = {
  PriceInfo?: {
    TotalInclLocal?: { Value?: unknown } | number | null;
  } | null;
  PaxDetails?: {
    Adults?: unknown;
    Children?: unknown;
    Infants?: unknown;
  } | null;
};

function readMoney(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (value && typeof value === 'object' && 'Value' in value) {
    const inner = (value as { Value?: unknown }).Value;
    if (typeof inner === 'number' && Number.isFinite(inner)) {
      return inner;
    }
  }
  return null;
}

function readNonNegInt(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
    return null;
  }
  return value;
}

/**
 * Extract proven live pp from Receipt.Package.
 * Returns null when Package / TotalInclLocal / PaxDetails are missing or invalid.
 */
export function computePrijsvrijReceiptPricePerPerson(
  pkg: PrijsvrijReceiptPackageLike | null | undefined,
): PrijsvrijReceiptPriceInfo | null {
  if (!pkg) {
    return null;
  }

  const totalInclLocal = readMoney(pkg.PriceInfo?.TotalInclLocal);
  if (totalInclLocal == null || totalInclLocal <= 0) {
    return null;
  }

  const adults = readNonNegInt(pkg.PaxDetails?.Adults);
  if (adults == null || adults < 1) {
    return null;
  }

  const children = readNonNegInt(pkg.PaxDetails?.Children) ?? 0;
  const infants = readNonNegInt(pkg.PaxDetails?.Infants) ?? 0;
  const denominator = adults + children;
  if (denominator < 1) {
    return null;
  }

  return {
    totalInclLocal,
    adults,
    children,
    infants,
    pricePerPerson: Math.ceil(totalInclLocal / denominator),
  };
}
