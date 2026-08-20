import { XMLParser } from 'fast-xml-parser';
import {
  CorendonXmlFeed,
  CorendonXmlProduct,
  CorendonXmlProperty,
} from '../types/corendon-xml';
import { StoredOffer } from '../types/stored-offer';
import { buildExternalId, PROVIDERS } from '../providers';
import { deriveCorendonHasCarRental } from '../../offers/has-car-rental';

function getProperties(product: CorendonXmlProduct): CorendonXmlProperty[] {
  const properties = product.properties?.property;

  if (!properties) {
    return [];
  }

  return Array.isArray(properties) ? properties : [properties];
}

function getProperty(product: CorendonXmlProduct, name: string): string {
  const found = getProperties(product).find((property) => property.name === name);
  const value = found?.value;

  if (value === undefined || value === null) {
    return '';
  }

  return String(value);
}

function toNumber(value: string): number | null {
  if (value === '') {
    return null;
  }

  const number = Number(String(value).replace(',', '.'));
  return Number.isNaN(number) ? null : number;
}

function parsePrice(product: CorendonXmlProduct): { price: number; currency: string } {
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

function parseImages(product: CorendonXmlProduct): string[] | undefined {
  const image = product.images?.image;

  if (!image) {
    return undefined;
  }

  const list = Array.isArray(image) ? image : [image];
  const values = list.filter((url) => url.length > 0);

  return values.length > 0 ? values : undefined;
}

function parseCategories(product: CorendonXmlProduct): string[] | undefined {
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

function parseVariations(product: CorendonXmlProduct): string | undefined {
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

function parseFeedDescription(product: CorendonXmlProduct): string | undefined {
  if (typeof product.description !== 'string') {
    return undefined;
  }

  const trimmed = product.description.trim();
  return trimmed || undefined;
}

function mapCorendonProduct(product: CorendonXmlProduct): StoredOffer {
  const { price, currency } = parsePrice(product);
  const images = parseImages(product);
  const imageLarge = getProperty(product, 'imageURL_large');
  const imageSmall = getProperty(product, 'imageURL_small');

  return {
    externalId: buildExternalId('corendon', product.ID),
    provider: PROVIDERS.corendon.name,

    hotelName: product.name,
    accommodation:
      getProperty(product, 'accommodation') ||
      getProperty(product, 'accommodationcode') ||
      undefined,
    accommodationType: getProperty(product, 'accommodationType') || undefined,
    stars: toNumber(getProperty(product, 'stars')),
    rating: toNumber(getProperty(product, 'rating')),

    descriptionShort: getProperty(product, 'descriptionShort') || undefined,
    descriptionLong: getProperty(product, 'descriptionLong') || undefined,
    extraInfo: getProperty(product, 'extraInfo') || undefined,
    feedDescription: parseFeedDescription(product),

    price,
    currency,
    deepLink: product.URL,

    imageUrl: images?.[0] ?? imageLarge ?? '',
    imageLarge: imageLarge || undefined,
    imageSmall: imageSmall || undefined,
    images,

    nights: toNumber(getProperty(product, 'duration')),
    durationType: getProperty(product, 'durationType') || undefined,
    departureDate: getProperty(product, 'departureDate') || undefined,
    flightIncluded: getProperty(product, 'flightIncluded') || undefined,
    lastMinute: getProperty(product, 'lastminute') || undefined,
    hasCarRental: deriveCorendonHasCarRental({
      subcategories: getProperty(product, 'subcategories') || undefined,
      flightIncluded: getProperty(product, 'flightIncluded'),
    }),

    departureAirport: getProperty(product, 'iataDeparture') || undefined,
    departureAirportCode: getProperty(product, 'isoCodeDeparture') || undefined,
    airport: getProperty(product, 'airport') || undefined,

    boardType: getProperty(product, 'serviceType') || undefined,

    country: getProperty(product, 'country'),
    province: getProperty(product, 'province') || undefined,
    region: getProperty(product, 'region') || undefined,
    city: getProperty(product, 'city') || undefined,

    latitude: toNumber(getProperty(product, 'latitude')),
    longitude: toNumber(getProperty(product, 'longitude')),

    subcategories: getProperty(product, 'subcategories') || undefined,
    categories: parseCategories(product),
    variations: parseVariations(product),

    affiliateCampaignId: product.campaignID != null ? String(product.campaignID) : undefined,
  };
}

export function importCorendonXml(xml: string): StoredOffer[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
  });

  const parsed = parser.parse(xml) as CorendonXmlFeed;
  const products = parsed.products.product;

  const productList = Array.isArray(products) ? products : [products];

  return productList.map(mapCorendonProduct);
}
