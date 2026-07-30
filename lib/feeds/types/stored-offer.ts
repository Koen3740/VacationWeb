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

  latitude?: number | null;
  longitude?: number | null;

  subcategories?: string | string[];
  categories?: string[];

  variations?: string;

  deepLink?: string;
  affiliateCampaignId?: string;
}
