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

  // Prijs
  price: number;
  pricePerDay: number;
  currency?: string;

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
