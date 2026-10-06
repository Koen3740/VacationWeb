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
  /**
   * Canonical party (DEC-019): adults are a count, children an age (0-17 on the
   * calculated return date). No date of birth is stored here; providers get a
   * synthetic DOB derived per offer. `age: null` = adult. roomIndex is 0-based;
   * adults come first, then children in `childAges` order.
   */
  party?: Array<{
    age: number | null;
    roomIndex: number;
  }>;
  /** Child ages 0-17 (age < 2 = baby, >= 2 = child). Derived from the URL `childAges`. */
  childAges?: number[];
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
  /** Ligging (SUB 27) toggles. URL `coast=1`, `urban=1`, `rural=1`; absent = no filter. */
  coast?: boolean;
  urban?: boolean;
  rural?: boolean;
  /** Ligging distance buckets: URL `centerDistance` (in,lt100,lt250,lt500,lt1000,ge1000) and `beachDistance` (direct,lt100,...). OR-matched. */
  centerDistance?: string[];
  beachDistance?: string[];
  /** Amenity keys (pool_indoor, sauna, …). OR-matched when multiple. */
  amenities?: string[];
  /**
   * Optional Results filter: only proven hasCarRental offers.
   * URL `hasCarRental=1` when selected; absent means no extra filter.
   */
  hasCarRental?: boolean;
  /**
   * Optional Results provider filter (sidebar "Vakantieaanbieder").
   * Exact `TravelOffer.provider` string. URL `provider=…`; absent = all providers.
   * Applied on the proven-B effective Results pool — not catalog/pre-live filtering.
   */
  provider?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
  /**
   * Definitive page-1 offer IDs after Receipt (incl. reserve/backfill).
   * Carried in pagination links so page 2+ can build remaining without re-running Receipt.
   */
  page1Ids?: string[];
  /**
   * Catalog generation (`loadRuntimeDataset().generationId`) stamped with a definitive
   * Page-1 freeze (READY/EXHAUSTED). URL `catalogGen`. Absent on anchors / legacy URLs.
   * Mismatch vs current generation invalidates `page` + `page1Ids` (criteria kept).
   */
  catalogGen?: string;
  /**
   * vacationmap.be vs vacationmap.nl. Presentation/listing preference only.
   * Does not lock Corendon inventory.
   */
  siteMarket?: 'be' | 'nl';
  /**
   * Catalog room id selected on Offer Detail (`?room=`).
   * Not an occupancy/live-price parameter unless that room is the feed-included room.
   */
  selectedRoom?: string;
}
