import { XMLParser } from 'fast-xml-parser';
import {
  CorendonXmlFeed,
  CorendonXmlProduct,
  CorendonXmlProperty,
} from '../types/corendon-xml';
import { flattenImageCandidates } from '../../offers/offer-images';
import { StoredOffer } from '../types/stored-offer';
import { buildExternalId, PROVIDERS } from '../providers';
import { deriveCorendonHasCarRental } from '../../offers/has-car-rental';
import { annotateCorendonSource } from './corendon-merge';

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

function propertyUrlList(product: CorendonXmlProduct, name: string): string[] {
  const found = getProperties(product).find((property) => property.name === name);
  if (!found) {
    return [];
  }
  return flattenImageCandidates(found.value);
}

function parseProductImages(product: CorendonXmlProduct): string[] {
  const numbered: Array<{ n: number; urls: string[] }> = [];

  for (const property of getProperties(product)) {
    const match = /^productimage_(\d+)$/i.exec(property.name);
    if (!match) {
      continue;
    }
    const urls = flattenImageCandidates(property.value);
    if (urls.length === 0) {
      continue;
    }
    numbered.push({ n: Number(match[1]), urls });
  }

  numbered.sort((a, b) => a.n - b.n);
  return numbered.flatMap((item) => item.urls);
}

function mergeUniqueUrls(...lists: Array<string[] | undefined>): string[] | undefined {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    if (!list) {
      continue;
    }
    for (const raw of list) {
      const url = raw.trim();
      if (!url || seen.has(url)) {
        continue;
      }
      seen.add(url);
      out.push(url);
    }
  }
  return out.length > 0 ? out : undefined;
}

function parseGalleryImages(product: CorendonXmlProduct): string[] | undefined {
  const image = product.images?.image;

  if (!image) {
    return undefined;
  }

  const list = Array.isArray(image) ? image : [image];
  const values = flattenImageCandidates(list);

  return values.length > 0 ? values : undefined;
}

function parseImages(product: CorendonXmlProduct): string[] | undefined {
  // imageURL_large is the TradeTracker designated large/hotel image. The tagged
  // <images><image> entry is often a thumbnail (e.g. Corendon A2W0H0) and must
  // not win the hero slot when a large URL exists.
  return mergeUniqueUrls(
    propertyUrlList(product, 'imageURL_large'),
    parseGalleryImages(product),
    parseProductImages(product),
    propertyUrlList(product, 'imageURL_small'),
  );
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
  const imageLargeUrls = propertyUrlList(product, 'imageURL_large');
  const imageSmallUrls = propertyUrlList(product, 'imageURL_small');
  const images = parseImages(product);
  const imageLarge = imageLargeUrls[0];
  const imageSmall = imageSmallUrls[0];

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
    arrivalAirport: getProperty(product, 'iataArrival') || undefined,
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

export function importCorendonXml(xml: string, manifestId?: string): StoredOffer[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
  });

  const parsed = parser.parse(xml) as CorendonXmlFeed;
  const products = parsed.products.product;

  const productList = Array.isArray(products) ? products : [products];

  return annotateCorendonSource(productList.map(mapCorendonProduct), manifestId);
}
