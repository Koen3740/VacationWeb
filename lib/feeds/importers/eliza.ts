import { XMLParser } from 'fast-xml-parser';
import { canonicalizeBoardType } from '../../offers/canonicalize-board-type';
import { deriveElizaHasCarRental } from '../../offers/has-car-rental';
import { unwrapElizaProductUrl } from '../../providers/eliza/offer-context';
import { buildExternalId, PROVIDERS } from '../providers';
import { StoredOffer } from '../types/stored-offer';
import {
  CorendonXmlFeed,
  CorendonXmlProduct,
  CorendonXmlProperty,
} from '../types/corendon-xml';

function getProperties(product: CorendonXmlProduct): CorendonXmlProperty[] {
  const properties = product.properties?.property;
  if (!properties) {
    return [];
  }
  return Array.isArray(properties) ? properties : [properties];
}

function propertyValues(value: CorendonXmlProperty['value'] | undefined): string[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.map(String).map((item) => item.trim()).filter(Boolean);
  }
  const text = String(value).trim();
  return text ? [text] : [];
}

function getProperty(product: CorendonXmlProduct, name: string): string {
  const found = getProperties(product).find((property) => property.name === name);
  return propertyValues(found?.value)[0] ?? '';
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

function parseFeedDescription(product: CorendonXmlProduct): string | undefined {
  if (typeof product.description !== 'string') {
    return undefined;
  }
  const trimmed = product.description.trim();
  return trimmed || undefined;
}

/** Eliza / Sunweb TradeTracker dates are MM/DD/YYYY; store ISO YYYY-MM-DD. */
function parseMmDdYyyy(raw: string): string | undefined {
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

/**
 * Canonical trip fields come from productURL (Bijbel §3).
 * Feed property airport/date may differ; live pricing already uses the URL.
 */
function catalogContextFromProductUrl(productUrl: string): {
  departureDate?: string;
  departureAirport?: string;
  duration?: string;
} {
  try {
    const landing = new URL(unwrapElizaProductUrl(productUrl));
    const departureDate = landing.searchParams.get('DepartureDate[0]')?.trim() || undefined;
    const departureAirport =
      landing.searchParams.get('DepartureAirport[0]')?.trim().toUpperCase() || undefined;
    const duration = landing.searchParams.get('Duration[0]')?.trim() || undefined;
    return { departureDate, departureAirport, duration };
  } catch {
    return {};
  }
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

function mapElizaProduct(product: CorendonXmlProduct): StoredOffer {
  const { price, currency } = parsePrice(product);
  const images = parseImages(product);
  const productUrl = product.URL;
  const fromUrl = catalogContextFromProductUrl(productUrl);
  const propertyDate = parseMmDdYyyy(getProperty(product, 'departureDate'));
  const propertyAirport = getProperty(product, 'airport');
  const propertyDuration = getProperty(product, 'duration');
  const durationRaw = fromUrl.duration || propertyDuration;
  const nights = toNumber(durationRaw);
  const serviceType = getProperty(product, 'serviceType');
  const transportType = getProperty(product, 'transportType');
  const usps = getProperty(product, 'usps')
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean);
  const descriptionLong = getProperty(product, 'descriptionLong') || undefined;

  return {
    externalId: buildExternalId('eliza', product.ID),
    provider: PROVIDERS.eliza.name,

    hotelName: product.name,
    accommodation: getProperty(product, 'accommodation') || undefined,
    stars: toNumber(getProperty(product, 'stars')),
    rating: toNumber(getProperty(product, 'rating')),

    descriptionShort: usps[0] || undefined,
    descriptionLong,
    feedDescription: parseFeedDescription(product) || descriptionLong,
    extraInfo: usps.length > 1 ? usps.slice(1).join('; ') : undefined,

    price,
    currency,
    deepLink: productUrl,

    imageUrl: images?.[0] ?? '',
    imageLarge: images?.[0],
    imageSmall: images?.[1],
    images,

    nights,
    durationType: nights != null ? 'dagen' : undefined,
    departureDate: fromUrl.departureDate || propertyDate,
    flightIncluded: parseFlightIncluded(transportType),
    hasCarRental: deriveElizaHasCarRental({ transportType }),

    departureAirport: fromUrl.departureAirport || propertyAirport || undefined,
    departureAirportCode: fromUrl.departureAirport || undefined,
    airport: propertyAirport || undefined,

    boardType: canonicalizeBoardType(serviceType) ?? (serviceType || undefined),

    country: getProperty(product, 'country'),
    region: getProperty(product, 'region') || undefined,
    city: getProperty(product, 'city') || undefined,

    latitude: toNumber(getProperty(product, 'latitude')),
    longitude: toNumber(getProperty(product, 'longitude')),

    subcategories: usps.length > 0 ? usps : undefined,
    variations: undefined,

    affiliateCampaignId: product.campaignID != null ? String(product.campaignID) : undefined,
  };
}

export function importElizaXml(xml: string): StoredOffer[] {
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

  const parsed = parser.parse(xml) as CorendonXmlFeed;
  const products = parsed.products?.product;
  if (!products) {
    return [];
  }

  const productList = Array.isArray(products) ? products : [products];
  return productList.map(mapElizaProduct);
}
