import type { ProviderListing } from '../types/stored-offer';

export interface TravelOffer {
  // Identificatie
  id: string;
  provider: string;
  /**
   * Additive Gate 0B identity for versioned detail-store addressing.
   * Does not replace id / externalId.
   */
  canonicalOfferIdentity?: string;

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
   * Corendon: `proven` + `lowestpricesacco` is a live p.p. only.
   * Interactive Results require a proven live total, so only `upsales`
   * (2 travellers with party ISO DOBs, 2A+1C with party ISO DOBs, or
   * 4 travellers / 2 rooms with party ISO DOBs) is Results-presentable.
   * Eliza was here: only `proven` + `getPromotedPrice` may be presented as a price.
   * Sunweb: `proven` + `getPromotedPrice` for Results 4 travellers / 2 rooms;
   * Detail may also use other proven PromotedPrice occupancies. Catalog numeric
   * is never a live amount.
   * `unpriced`: catalog trip remains visible on Results; live occupancy is outside
   * the proven price route, so no price is shown.
   * `unavailable`: live was attempted for this occupancy and failed closed for €.
   * Provider-confirmed unavailability (see livePriceFailureReason) is not listable
   * on Results; technical errors remain listable without a live €.
   */
  livePriceStatus?: 'proven' | 'unavailable' | 'catalog' | 'unpriced';
  livePriceSource?: 'receipt' | 'lowestpricesacco' | 'upsales' | 'getPromotedPrice' | 'feed' | 'search';
  /**
   * Classified live-price failure reason from classifyLivePriceFailure.
   * Used to distinguish provider-confirmed unavailability from technical errors.
   */
  livePriceFailureReason?: string;
  /**
   * Provider-returned live package total for this occupancy and livePriceSource.
   * Set only from a proven total field in the live response.
   * Never derived from price × travellers, lowest × pax, or ceil(pp) × pax.
   * Absent for lowestpricesacco, feed, search, and matrix.
   */
  liveTotalPrice?: number;
  /**
   * Which provider response field supplied liveTotalPrice.
   */
  liveTotalPriceField?:
    | 'upsales.totalPrice'
    | 'upsales.realTimeBlankPrice'
    | 'receipt.TotalInclLocal'
    | 'getPromotedPrice.totalPrice';

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
