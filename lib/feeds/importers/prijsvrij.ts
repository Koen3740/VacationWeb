import { XMLParser } from 'fast-xml-parser';
import {
  PrijsvrijXmlFeed,
  PrijsvrijXmlProduct,
  PrijsvrijXmlProperty,
} from '../types/prijsvrij-xml';
import { StoredOffer } from '../types/stored-offer';
import { buildExternalId, PROVIDERS } from '../providers';

const BOARD_TYPE_LABELS: Record<string, string> = {
  LG: 'Logies',
  LO: 'Logies en ontbijt',
  HP: 'Half pension',
  VP: 'Vol pension',
  AI: 'All Inclusive',
  UA: 'Ultra All Inclusive',
};

const IMAGE_PROPERTY_NAMES = [
  'imageURL2',
  'imageURL3',
  'imageURL4',
  'imageURL5',
  'imageURL6',
  'imageURL7',
  'imageURL8',
  'imageURL9',
  'imageURL10',
] as const;

function getProperties(product: PrijsvrijXmlProduct): PrijsvrijXmlProperty[] {
  const properties = product.properties?.property;

  if (!properties) {
    return [];
  }

  return Array.isArray(properties) ? properties : [properties];
}

function getProperty(product: PrijsvrijXmlProduct, name: string): string {
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

function parseCurrency(product: PrijsvrijXmlProduct): string {
  const rawPrice = product.price;

  if (typeof rawPrice === 'object' && rawPrice !== null && 'currency' in rawPrice) {
    return rawPrice.currency ?? 'EUR';
  }

  return 'EUR';
}

function parseBoardType(product: PrijsvrijXmlProduct): string | undefined {
  const code = getProperty(product, 'board_type');

  if (!code) {
    return undefined;
  }

  return BOARD_TYPE_LABELS[code] ?? code;
}

function parseImages(product: PrijsvrijXmlProduct): string[] | undefined {
  const values: string[] = [];
  const primaryImage = product.images?.image;

  if (typeof primaryImage === 'string' && primaryImage.length > 0) {
    values.push(primaryImage);
  }

  for (const propertyName of IMAGE_PROPERTY_NAMES) {
    const imageUrl = getProperty(product, propertyName);

    if (imageUrl && !values.includes(imageUrl)) {
      values.push(imageUrl);
    }
  }

  return values.length > 0 ? values : undefined;
}

function parseFeedDescription(product: PrijsvrijXmlProduct): string | undefined {
  if (typeof product.description !== 'string') {
    return undefined;
  }

  const trimmed = product.description.trim();
  return trimmed || undefined;
}

function parseCategories(product: PrijsvrijXmlProduct): string[] | undefined {
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

function parseVariations(product: PrijsvrijXmlProduct): string | undefined {
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

function mapPrijsvrijProduct(product: PrijsvrijXmlProduct): StoredOffer {
  const images = parseImages(product);
  const minimumPrice = getProperty(product, 'minimum_price');
  const transportType = getProperty(product, 'transportType');
  const departureDate = getProperty(product, 'departureDate');
  const duration = getProperty(product, 'duration');
  const boardTypeCode = getProperty(product, 'board_type');

  return {
    externalId: buildExternalId('prijsvrij', product.ID, [
      departureDate,
      duration,
      minimumPrice,
      boardTypeCode,
    ]),
    provider: PROVIDERS.prijsvrij.name,

    hotelName: product.name,
    accommodationType: getProperty(product, 'accommodationType') || undefined,
    stars: toNumber(getProperty(product, 'stars')),

    descriptionShort: getProperty(product, 'descriptionShort') || undefined,
    feedDescription: parseFeedDescription(product),

    price: toNumber(minimumPrice) ?? 0,
    currency: parseCurrency(product),
    deepLink: product.URL,

    imageUrl: images?.[0] ?? '',
    imageLarge: images?.[0],
    imageSmall: images?.[1],
    images,

    nights: toNumber(duration),
    durationType: 'dagen',
    departureDate: departureDate || undefined,
    flightIncluded: transportType === 'VL' ? 'true' : transportType || undefined,

    boardType: parseBoardType(product),

    country: getProperty(product, 'country'),
    region: getProperty(product, 'region') || undefined,
    city: getProperty(product, 'city') || undefined,

    latitude: toNumber(getProperty(product, 'latitude')),
    longitude: toNumber(getProperty(product, 'longitude')),

    categories: parseCategories(product),
    variations: parseVariations(product),

    affiliateCampaignId: product.campaignID != null ? String(product.campaignID) : undefined,
  };
}

export function importPrijsvrijXml(xml: string): StoredOffer[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
  });

  const parsed = parser.parse(xml) as PrijsvrijXmlFeed;
  const products = parsed.products.product;
  const productList = Array.isArray(products) ? products : [products];

  return productList.map(mapPrijsvrijProduct);
}

export function decodePrijsvrijBoardType(code: string): string {
  return BOARD_TYPE_LABELS[code] ?? code;
}
