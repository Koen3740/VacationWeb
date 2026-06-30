"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.importCorendonXml = importCorendonXml;
const fast_xml_parser_1 = require("fast-xml-parser");
const providers_1 = require("../providers");
function getProperties(product) {
    const properties = product.properties?.property;
    if (!properties) {
        return [];
    }
    return Array.isArray(properties) ? properties : [properties];
}
function getProperty(product, name) {
    const found = getProperties(product).find((property) => property.name === name);
    const value = found?.value;
    if (value === undefined || value === null) {
        return '';
    }
    return String(value);
}
function toNumber(value) {
    if (value === '') {
        return null;
    }
    const number = Number(String(value).replace(',', '.'));
    return Number.isNaN(number) ? null : number;
}
function parsePrice(product) {
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
function parseImages(product) {
    const image = product.images?.image;
    if (!image) {
        return undefined;
    }
    const list = Array.isArray(image) ? image : [image];
    const values = list.filter((url) => url.length > 0);
    return values.length > 0 ? values : undefined;
}
function parseCategories(product) {
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
function parseVariations(product) {
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
function parseFeedDescription(product) {
    if (typeof product.description !== 'string') {
        return undefined;
    }
    const trimmed = product.description.trim();
    return trimmed || undefined;
}
function mapCorendonProduct(product) {
    const { price, currency } = parsePrice(product);
    const images = parseImages(product);
    const imageLarge = getProperty(product, 'imageURL_large');
    const imageSmall = getProperty(product, 'imageURL_small');
    return {
        externalId: (0, providers_1.buildExternalId)('corendon', product.ID),
        provider: providers_1.PROVIDERS.corendon.name,
        hotelName: product.name,
        accommodation: getProperty(product, 'accommodation') || undefined,
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
function importCorendonXml(xml) {
    const parser = new fast_xml_parser_1.XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '',
    });
    const parsed = parser.parse(xml);
    const products = parsed.products.product;
    const productList = Array.isArray(products) ? products : [products];
    return productList.map(mapCorendonProduct);
}
