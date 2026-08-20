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
   * Prijsvrij: only `proven` + `receipt` may be presented.
   * Corendon: only `proven` + `lowestpricesacco` may be presented.
   * Eliza was here: only `proven` + `getPromotedPrice` may be presented.
   * Sunweb: `proven` + `getPromotedPrice`, or catalog numeric when live was not attempted.
   * Offers without a valid allowed price are not presented.
   */
  livePriceStatus?: 'proven' | 'unavailable' | 'catalog';
  livePriceSource?: 'receipt' | 'lowestpricesacco' | 'getPromotedPrice' | 'feed' | 'search';

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

  // Toekomstige scores
  departureWindowStart?: string;
  departureWindowEnd?: string;
  valueScore?: number;
  flexibilityScore?: number;

  isBestDeal?: boolean;
  isCheapestProvider?: boolean;
}
