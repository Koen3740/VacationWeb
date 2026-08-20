import type { ProviderListing } from '../types/stored-offer';

export interface TravelOffer {
  // Identificatie
  id: string;
  provider: string;

  // Hotel
  hotelName: string;
  accommodation?: string;
  accommodationType?: string;

  // Bestemming
  destinationCountry: string;
  destinationProvince?: string;
  destinationRegion?: string;
  destinationCity?: string;

  // Vertrek
  departureAirport?: string;
  departureAirportCode?: string;
  airport?: string;
  departureDate?: string;

  // Reis
  boardType?: string;
  nights: number;
  durationType?: string;
  flightIncluded?: string;
  lastMinute?: string;
  /**
   * Proven structural "huurauto inbegrepen".
   * Only `true` is meaningful. Missing/false = not proven.
   * Never derived from hotel name, marketing copy, or vacationTypes.
   */
  hasCarRental?: boolean;

  // Prijs
  price: number;
  pricePerDay: number;
  currency?: string;
  /**
   * Live-price provenance for Results (Fase 4).
   * Prijsvrij: only `proven` + `receipt` may be presented as a price.
   * Corendon: only `proven` + `lowestpricesacco` (2A) or `upsales` (4 travellers / 2 rooms)
   * may be presented as a price.
   * Eliza was here: only `proven` + `getPromotedPrice` may be presented as a price.
   * Sunweb: `proven` + `getPromotedPrice` for 4 travellers / 2 rooms; catalog numeric
   * when live was not attempted (2A). `unpriced` when that occupancy is outside the
   * proven Participants route.
   * `unpriced`: catalog trip remains visible on Results; live occupancy is outside
   * the proven price route, so no price is shown.
   * `unavailable`: live was attempted for this occupancy and failed, or the proven
   * occupancy cannot build a live context. Hidden on Results.
   */
  livePriceStatus?: 'proven' | 'unavailable' | 'catalog' | 'unpriced';
  livePriceSource?: 'receipt' | 'lowestpricesacco' | 'upsales' | 'getPromotedPrice' | 'feed' | 'search';

  // Hotelkwaliteit
  stars?: number | null;
  rating?: number | null;

  // Afbeeldingen
  imageUrl: string;
  imageLarge?: string;
  imageSmall?: string;
  images?: string[];

  // Beschrijving
  descriptionShort?: string;
  descriptionLong?: string;
  extraInfo?: string;
  feedDescription?: string;
  /**
   * Compact-runtime search corpus (long/feed/accommodation text).
   * When present, amenity/theme/location filters use this instead of
   * descriptionLong/feedDescription, which are omitted from the Results catalog.
   */
  searchText?: string;

  // Locatie
  latitude?: number | null;
  longitude?: number | null;

  // Categorieën
  subcategories?: string;
  categories?: string[];

  // Productvarianten
  variations?: string;

  // Affiliate
  deepLink: string;
  affiliateCampaignId?: string;
  arrivalAirport?: string;
  feedSourceId?: string;
  listingHost?: string;
  providerListings?: ProviderListing[];
  localizedDescriptions?: Record<string, string>;

  // Toekomstige scores
  departureWindowStart?: string;
  departureWindowEnd?: string;
  valueScore?: number;
  flexibilityScore?: number;

  isBestDeal?: boolean;
  isCheapestProvider?: boolean;
}
