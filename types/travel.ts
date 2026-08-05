export type { TravelOffer } from '../lib/feeds/canonical/travel-offer';

export interface FilterOptions {
  countries: string[];
  regionsByCountry: Record<string, string[]>;
  boardTypes: string[];
  departureAirports: string[];
}

export interface SearchParams {
  country?: string;
  countries?: string[];
  region?: string;
  budgetMin?: number;
  budgetMax?: number;
  nightsMin?: number;
  nightsMax?: number;
  nights?: number[];
  boardTypes?: string[];
  adults?: number;
  children?: number;
  babies?: number;
  rooms?: number;
  departureStart?: string;
  departureEnd?: string;
  flexibilityDays?: number;
  departureAirport?: string;
  stars?: number;
  sort?: string;
  page?: number;
  pageSize?: number;
}
