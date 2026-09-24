/**
 * GO6: in-memory catalog indexes to narrow filter candidates before full scan.
 * Built once when the runtime dataset is cached.
 */
import { canonicalizeCountryName } from '@/lib/offers/canonical-country';
import type { SearchParams, TravelOffer } from '@/types/travel';

export type CatalogFilterIndex = {
  byCountry: Map<string, number[]>;
  byNights: Map<number, number[]>;
  byDepartureMonth: Map<string, number[]>;
  byAirport: Map<string, number[]>;
  offerCount: number;
};

function normalizeCountry(value: string | undefined): string | null {
  if (!value || !value.trim()) return null;
  return canonicalizeCountryName(value.trim()).toLowerCase();
}

function monthKey(departureDate: string | undefined): string | null {
  if (!departureDate || departureDate.length < 7) return null;
  return departureDate.slice(0, 7);
}

function airportTokens(offer: TravelOffer): string[] {
  const raw =
    (offer as { departureAirport?: string }).departureAirport ??
    (offer as { departureAirports?: string[] }).departureAirports ??
    [];
  if (Array.isArray(raw)) {
    return raw.map((a) => String(a).trim().toUpperCase()).filter(Boolean);
  }
  if (typeof raw === 'string') {
    return raw
      .split(/[,|/]/)
      .map((a) => a.trim().toUpperCase())
      .filter(Boolean);
  }
  return [];
}

export function buildCatalogFilterIndex(offers: readonly TravelOffer[]): CatalogFilterIndex {
  const byCountry = new Map<string, number[]>();
  const byNights = new Map<number, number[]>();
  const byDepartureMonth = new Map<string, number[]>();
  const byAirport = new Map<string, number[]>();

  const push = <K,>(map: Map<K, number[]>, key: K, index: number) => {
    const list = map.get(key);
    if (list) list.push(index);
    else map.set(key, [index]);
  };

  for (let i = 0; i < offers.length; i += 1) {
    const offer = offers[i];
    const country = normalizeCountry(offer.destinationCountry);
    if (country) push(byCountry, country, i);
    if (typeof offer.nights === 'number' && Number.isFinite(offer.nights)) {
      push(byNights, offer.nights, i);
    }
    const month = monthKey(offer.departureDate);
    if (month) push(byDepartureMonth, month, i);
    for (const airport of airportTokens(offer)) {
      push(byAirport, airport, i);
    }
  }

  return { byCountry, byNights, byDepartureMonth, byAirport, offerCount: offers.length };
}

function intersectIndices(a: number[] | null, b: number[]): number[] {
  if (a === null) return b.slice();
  if (a.length === 0 || b.length === 0) return [];
  const setB = new Set(b);
  return a.filter((i) => setB.has(i));
}

/**
 * Narrow catalog to candidate indices using selective filters.
 * Returns null when no selective filter applies (caller uses full catalog).
 */
export function narrowOfferIndicesWithIndex(
  index: CatalogFilterIndex,
  params: SearchParams,
  resolveCountries: (params: SearchParams) => string[],
  parseAirports: (raw: string | undefined) => string[],
): number[] | null {
  let indices: number[] | null = null;
  let narrowed = false;

  const countries = resolveCountries(params)
    .map((c) => normalizeCountry(c))
    .filter((c): c is string => Boolean(c));
  if (countries.length > 0) {
    const countryUnion: number[] = [];
    const seen = new Set<number>();
    for (const country of countries) {
      for (const i of index.byCountry.get(country) ?? []) {
        if (!seen.has(i)) {
          seen.add(i);
          countryUnion.push(i);
        }
      }
    }
    indices = countryUnion;
    narrowed = true;
  }

  if (params.nights?.length) {
    const nightsUnion: number[] = [];
    const seen = new Set<number>();
    for (const n of params.nights) {
      for (const i of index.byNights.get(n) ?? []) {
        if (!seen.has(i)) {
          seen.add(i);
          nightsUnion.push(i);
        }
      }
    }
    indices = intersectIndices(indices, nightsUnion);
    narrowed = true;
  }

  if (params.departureStart && params.departureEnd) {
    const start = params.departureStart.slice(0, 7);
    const end = params.departureEnd.slice(0, 7);
    if (start && end && start === end) {
      indices = intersectIndices(indices, index.byDepartureMonth.get(start) ?? []);
      narrowed = true;
    }
  }

  const airports = parseAirports(params.departureAirport).map((a) => a.toUpperCase());
  if (airports.length > 0) {
    const airportUnion: number[] = [];
    const seen = new Set<number>();
    for (const airport of airports) {
      for (const i of index.byAirport.get(airport) ?? []) {
        if (!seen.has(i)) {
          seen.add(i);
          airportUnion.push(i);
        }
      }
    }
    indices = intersectIndices(indices, airportUnion);
    narrowed = true;
  }

  return narrowed ? (indices ?? []) : null;
}

export function offersFromIndices(
  offers: readonly TravelOffer[],
  indices: number[],
): TravelOffer[] {
  return indices.map((i) => offers[i]).filter(Boolean);
}


/** Request-local override so Results can index the parked-excluded catalog array. */
let activeFilterIndex: CatalogFilterIndex | null = null;
let activeFilterOffers: readonly TravelOffer[] | null = null;

export function withCatalogFilterIndex<T>(
  offers: readonly TravelOffer[],
  run: () => T,
): T {
  const previousIndex = activeFilterIndex;
  const previousOffers = activeFilterOffers;
  activeFilterOffers = offers;
  activeFilterIndex = buildCatalogFilterIndex(offers);
  try {
    return run();
  } finally {
    activeFilterIndex = previousIndex;
    activeFilterOffers = previousOffers;
  }
}

export async function withCatalogFilterIndexAsync<T>(
  offers: readonly TravelOffer[],
  run: () => Promise<T>,
): Promise<T> {
  const previousIndex = activeFilterIndex;
  const previousOffers = activeFilterOffers;
  activeFilterOffers = offers;
  activeFilterIndex = buildCatalogFilterIndex(offers);
  try {
    return await run();
  } finally {
    activeFilterIndex = previousIndex;
    activeFilterOffers = previousOffers;
  }
}

export function getActiveCatalogFilterIndex(
  offers: readonly TravelOffer[],
): CatalogFilterIndex | null {
  if (activeFilterIndex && activeFilterOffers === offers) {
    return activeFilterIndex;
  }
  return null;
}
