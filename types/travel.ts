export type { TravelOffer } from '../lib/feeds/canonical/travel-offer';

export interface FilterOptions {
  countries: string[];
  regionsByCountry: Record<string, string[]>;
  boardTypes: string[];
  departureAirports: string[];
}

export interface SearchParams {
  country?: string;
  region?: string;
  budgetMin?: number;
  budgetMax?: number;
  nightsMin?: number;
  nightsMax?: number;
  boardTypes?: string[];
  adults?: number;
  children?: number;
  rooms?: number;
  departureStart?: string;
  departureEnd?: string;
  departureAirport?: string;
  stars?: number;
  sort?: string;
}
