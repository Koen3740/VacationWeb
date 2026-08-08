import { XMLParser } from 'fast-xml-parser';
import {
  SunwebXmlFeed,
  SunwebXmlProduct,
  SunwebXmlProperty,
} from '../types/sunweb-xml';
import { StoredOffer } from '../types/stored-offer';
import { buildExternalId, PROVIDERS } from '../providers';

function getProperties(product: SunwebXmlProduct): SunwebXmlProperty[] {
  const properties = product.properties?.property;

  if (!properties) {
    return [];
  }

  return Array.isArray(properties) ? properties : [properties];
}

function propertyValues(value: SunwebXmlProperty['value'] | undefined): string[] {
  if (value === undefined || value === null) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.map(String).map((item) => item.trim()).filter(Boolean);
  }

  const text = String(value).trim();
  return text ? [text] : [];
}

function getProperty(product: SunwebXmlProduct, name: string): string {
  const found = getProperties(product).find((property) => property.name === name);
  return propertyValues(found?.value)[0] ?? '';
}

function getPropertyList(product: SunwebXmlProduct, name: string): string[] {
  const found = getProperties(product).find((property) => property.name === name);
  return propertyValues(found?.value);
}

function toNumber(value: string): number | null {
  if (value === '') {
    return null;
  }

  const number = Number(String(value).replace(',', '.'));
  return Number.isNaN(number) ? null : number;
}

function parsePrice(product: SunwebXmlProduct): { price: number; currency: string } {
  const rawPrice = product.price;

  if (typeof rawPrice === 'number') {
    return { price: rawPrice, currency: 'EUR' };
  }

  if (typeof rawPrice === 'string') {
    return { price: Number(rawPrice), currency: 'EUR' };
  }

  return {
    price: Number(rawPrice?.['#text'] ?? 0),
    currency: rawPrice?.currency ?? 'EUR',
  };
}

function parseImages(product: SunwebXmlProduct): string[] | undefined {
  const image = product.images?.image;

  if (!image) {
    return undefined;
  }

  const list = Array.isArray(image) ? image : [image];
  const values = list.filter((url) => url.length > 0);

  return values.length > 0 ? values : undefined;
}

function parseFeedDescription(product: SunwebXmlProduct): string | undefined {
  if (typeof product.description !== 'string') {
    return undefined;
  }

  const trimmed = product.description.trim();
  return trimmed || undefined;
}

function parseCategories(product: SunwebXmlProduct): string[] | undefined {
  const categories = product.categories;

  if (!categories) {
    return undefined;
  }

  if (typeof categories === 'string') {
    const trimmed = categories.trim();
    return trimmed ? [trimmed] : undefined;
  }

  const category = categories.category;

  if (!category) {
    return undefined;
  }

  const list = Array.isArray(category) ? category : [category];
  const values = list.map(String).filter((value) => value.trim().length > 0);

  return values.length > 0 ? values : undefined;
}

function parseVariations(product: SunwebXmlProduct): string | undefined {
  const variations = product.variations;

  if (variations === undefined || variations === null) {
    return undefined;
  }

  if (typeof variations === 'string') {
    const trimmed = variations.trim();
    return trimmed || undefined;
  }

  return JSON.stringify(variations);
}

/** Sunweb TradeTracker feeds use MM/DD/YYYY; store as ISO YYYY-MM-DD. */
function parseSunwebDepartureDate(raw: string): string | undefined {
  const trimmed = raw.trim();

  if (!trimmed) {
    return undefined;
  }

  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (!match) {
    return trimmed;
  }

  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = match[3];

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return trimmed;
  }

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseFlightIncluded(transportType: string): string | undefined {
  if (!transportType) {
    return undefined;
  }

  if (transportType.toLowerCase() === 'flight') {
    return 'true';
  }

  return transportType;
}

function looksLikeBoard(value: string): boolean {
  return /logies|ontbijt|pension|inclusive|half\s*pension|vol\s*pension/i.test(value);
}

function looksLikeAccommodationType(value: string): boolean {
  return /hotel|appartement|studio|resort|villa|bungalow|aparthotel|kamer/i.test(value);
}

function parseBoardAndAccommodationType(product: SunwebXmlProduct): {
  boardType?: string;
  accommodationType?: string;
} {
  const accommodationTypeRaw = getProperty(product, 'accommodationType');
  const serviceTypeRaw = getProperty(product, 'serviceType');
  const mealPlan = getPropertyList(product, 'mealPlanDescription')[0] || '';
  const categories = parseCategories(product);

  let boardType: string | undefined;
  let accommodationType: string | undefined;

  for (const candidate of [accommodationTypeRaw, serviceTypeRaw, mealPlan]) {
    if (!candidate) {
      continue;
    }

    if (!boardType && looksLikeBoard(candidate)) {
      boardType = candidate;
      continue;
    }

    if (!accommodationType && looksLikeAccommodationType(candidate)) {
      accommodationType = candidate;
    }
  }

  if (!boardType && mealPlan) {
    boardType = mealPlan;
  }

  if (!boardType && serviceTypeRaw && !looksLikeAccommodationType(serviceTypeRaw)) {
    boardType = serviceTypeRaw;
  }

  if (!accommodationType && categories?.[0] && looksLikeAccommodationType(categories[0])) {
    accommodationType = categories[0];
  }

  return { boardType, accommodationType };
}

function parseStarsAndRating(product: SunwebXmlProduct): {
  stars: number | null;
  rating: number | null;
} {
  const starsProp = toNumber(getProperty(product, 'stars'));
  const ratingProp = toNumber(getProperty(product, 'rating'));
  const userRating = toNumber(
    getProperty(product, 'userRating') || getProperty(product, 'userrating'),
  );

  if (starsProp != null) {
    return { stars: starsProp, rating: ratingProp ?? userRating };
  }

  // Accomodatie/Lastminute: rating = sterrenklasse (<=5), userRating = gastscore.
  if (ratingProp != null && ratingProp <= 5 && userRating != null) {
    return { stars: ratingProp, rating: userRating };
  }

  if (ratingProp != null && ratingProp <= 5) {
    return { stars: ratingProp, rating: null };
  }

  return { stars: null, rating: ratingProp ?? userRating };
}

function parseSubcategories(product: SunwebXmlProduct): string[] | undefined {
  const usp = getPropertyList(product, 'usp');

  if (usp.length > 0) {
    return usp;
  }

  const facilities = getPropertyList(product, 'facilities').filter((value) => value.length <= 40);
  return facilities.length > 0 ? facilities : undefined;
}

function mapSunwebProduct(product: SunwebXmlProduct): StoredOffer {
  const { price, currency } = parsePrice(product);
  const images = parseImages(product);
  const departureDateRaw = getProperty(product, 'departureDate');
  const departureDate = parseSunwebDepartureDate(departureDateRaw);
  const durationRaw = getProperty(product, 'numberOfDays') || getProperty(product, 'duration');
  const nights = toNumber(durationRaw);
  const iataDeparture =
    getProperty(product, 'iataDeparture') ||
    getProperty(product, 'IsoCodeDeparture') ||
    getProperty(product, 'DepartureAirport');
  const { boardType, accommodationType } = parseBoardAndAccommodationType(product);
  const { stars, rating } = parseStarsAndRating(product);
  const roomDescription =
    getProperty(product, 'descriptionShort') ||
    getProperty(product, 'room_Room_Name') ||
    getPropertyList(product, 'usp')[0] ||
    undefined;
  const accommodationNotes = getPropertyList(product, 'accommodation');
  const subcategories = parseSubcategories(product);

  return {
    externalId: buildExternalId('sunweb', product.ID, [
      departureDate ?? departureDateRaw,
      durationRaw,
      iataDeparture,
      boardType ?? '',
      String(price),
    ]),
    provider: PROVIDERS.sunweb.name,

    hotelName: product.name,
    accommodation: accommodationNotes.length > 0 ? accommodationNotes.join('; ') : undefined,
    accommodationType,
    stars,
    rating,

    descriptionShort: roomDescription,
    feedDescription: parseFeedDescription(product),
    extraInfo: roomDescription,

    price,
    currency,
    deepLink: product.URL,

    imageUrl: images?.[0] ?? '',
    imageLarge: images?.[0],
    imageSmall: images?.[1],
    images,

    nights,
    durationType: nights != null ? 'dagen' : undefined,
    departureDate,
    flightIncluded: parseFlightIncluded(getProperty(product, 'transportType')),

    departureAirport: iataDeparture || undefined,
    departureAirportCode: getProperty(product, 'IsoCodeDeparture') || undefined,
    airport: getProperty(product, 'airport') || undefined,

    boardType,

    country: getProperty(product, 'country') || getProperty(product, 'country_name'),
    region: getProperty(product, 'region') || getProperty(product, 'region_name') || undefined,
    city: getProperty(product, 'city') || getProperty(product, 'city_name') || undefined,

    latitude: toNumber(getProperty(product, 'latitude')),
    longitude: toNumber(getProperty(product, 'longitude')),

    subcategories,
    categories: parseCategories(product),
    variations: parseVariations(product),

    affiliateCampaignId: product.campaignID != null ? String(product.campaignID) : undefined,
  };
}

export function importSunwebXml(xml: string): StoredOffer[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    isArray: (name, jpath) => {
      const path = String(jpath);
      return (
        (name === 'value' && path.includes('properties.property')) ||
        (name === 'image' && path.includes('images'))
      );
    },
  });

  const parsed = parser.parse(xml) as SunwebXmlFeed;
  const products = parsed.products?.product;

  if (!products) {
    return [];
  }

  const productList = Array.isArray(products) ? products : [products];

  return productList.map(mapSunwebProduct);
}
