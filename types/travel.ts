export type { TravelOffer } from '../lib/feeds/canonical/travel-offer';

export interface FilterOptions {
  countries: string[];
  regionsByCountry: Record<string, string[]>;
  citiesByCountry?: Record<string, string[]>;
  boardTypes: string[];
  accommodationTypes?: string[];
  departureAirports: string[];
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
  /** Qualitative beach location: direct | walk */
  beachLocation?: string;
  /** Qualitative center location: in | near */
  centerLocation?: string;
  /** When true, require sea-view signal in offer text */
  seaView?: boolean;
  /** Amenity keys (pool_indoor, sauna, …). OR-matched when multiple. */
  amenities?: string[];
  sort?: string;
  page?: number;
  pageSize?: number;
}
