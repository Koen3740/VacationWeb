export type { TravelOffer } from '../lib/feeds/canonical/travel-offer';

export type FilterCountryCount = {
  name: string;
  count: number;
};

export type FilterHomeTheme = {
  id: string;
  title: string;
  description: string;
  href: string;
  count: number;
};

export interface FilterOptions {
  countries: string[];
  regionsByCountry: Record<string, string[]>;
  citiesByCountry?: Record<string, string[]>;
  boardTypes: string[];
  accommodationTypes?: string[];
  departureAirports: string[];
  /** Import-time catalog counts by canonical country name. */
  countryCounts?: Record<string, number>;
  totalOffers?: number;
  popularDestinations?: FilterCountryCount[];
  homeThemes?: FilterHomeTheme[];
}

export interface SearchParams {
  country?: string;
  countries?: string[];
  region?: string;
  city?: string;
  budgetMin?: number;
  budgetMax?: number;
  nightsMin?: number;
  nightsMax?: number;
  nights?: number[];
  boardTypes?: string[];
  accommodationTypes?: string[];
  adults?: number;
  children?: number;
  babies?: number;
  rooms?: number;
  departureStart?: string;
  departureEnd?: string;
  flexibilityDays?: number;
  departureAirport?: string;
  /** Exact star ratings to include (e.g. [3, 5]). Empty/undefined = no stars filter. */
  stars?: number[];
  /** Vacation themes (Adults Only, Familie, …). OR-matched when multiple. */
  vacationTypes?: string[];
  /** Beach location buckets (direct, lt100, …). OR-matched when multiple. */
  beachLocation?: string[];
  /** Center location buckets (in, lt100, …). OR-matched when multiple. */
  centerLocation?: string[];
  /** Amenity keys (pool_indoor, sauna, …). OR-matched when multiple. */
  amenities?: string[];
  /**
   * Optional Results filter: only proven hasCarRental offers.
   * URL `hasCarRental=1` when selected; absent means no extra filter.
   */
  hasCarRental?: boolean;
  sort?: string;
  page?: number;
  pageSize?: number;
  /**
   * Definitive page-1 offer IDs after Receipt (incl. reserve/backfill).
   * Carried in pagination links so page 2+ can build remaining without re-running Receipt.
   */
  page1Ids?: string[];
}
