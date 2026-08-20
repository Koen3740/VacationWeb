/** Provider environment in which a concrete bookable offer is available. */
export type ProviderListing = {
  provider: string;
  feedId: string;
  campaignId?: string;
  host: string;
  deepLink: string;
  locale?: string;
};

export interface StoredOffer {
  externalId: string;
  provider: string;

  hotelName: string;
  accommodation?: string;
  accommodationType?: string;

  country: string;
  province?: string;
  region?: string;
  city?: string;

  departureAirport?: string;
  departureAirportCode?: string;
  airport?: string;
  departureDate?: string;

  boardType?: string;
  nights: number | null;
  durationType?: string;
  flightIncluded?: string | boolean;
  lastMinute?: string | boolean;
  /** Proven structural car rental included. Only `true` is stored on compact runtime. */
  hasCarRental?: boolean;

  price: number;
  currency?: string;

  stars?: number | null;
  rating?: number | null;

  imageUrl?: string;
  imageLarge?: string;
  imageSmall?: string;
  images?: string[];

  descriptionShort?: string;
  descriptionLong?: string;
  extraInfo?: string;
  feedDescription?: string;
  /** Compact-runtime search corpus. See TravelOffer.searchText. */
  searchText?: string;

  latitude?: number | null;
  longitude?: number | null;

  subcategories?: string | string[];
  categories?: string[];

  variations?: string;

  deepLink?: string;
  affiliateCampaignId?: string;

  /** IATA arrival when present on the feed (e.g. Corendon NL `iataArrival`). */
  arrivalAirport?: string;
  /** Inventory source id (Corendon: corendon-benl | corendon-befr | corendon-nl). */
  feedSourceId?: string;
  /** Click-out / live-price host for the primary listing. */
  listingHost?: string;
  /** All retained provider listings for this bookable offer. */
  providerListings?: ProviderListing[];
  /** Hotel copy per source locale; does not replace descriptionLong. */
  localizedDescriptions?: Record<string, string>;
}
