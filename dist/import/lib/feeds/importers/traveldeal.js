"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.importTraveldealXml = importTraveldealXml;
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
    if (Array.isArray(value)) {
        return value.map(String).join(', ');
    }
    return String(value);
}
function getPropertyValues(product, name) {
    const found = getProperties(product).find((property) => property.name === name);
    const value = found?.value;
    if (value === undefined || value === null) {
        return [];
    }
    return Array.isArray(value) ? value.map(String) : [String(value)];
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
    const values = [];
    const primaryImage = product.images?.image;
    if (typeof primaryImage === 'string' && primaryImage.length > 0) {
        values.push(primaryImage);
    }
    for (const propertyName of ['imageURL_large', 'imageURL_small']) {
        const imageUrl = getProperty(product, propertyName);
        if (imageUrl && !values.includes(imageUrl)) {
            values.push(imageUrl);
        }
    }
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
    const values = list
        .map((entry) => {
        if (typeof entry === 'string') {
            return entry;
        }
        if (typeof entry === 'object' && entry !== null) {
            const record = entry;
            return record['#text'] || record.path || '';
        }
        return String(entry);
    })
        .filter((value) => value.trim().length > 0);
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
function parseNights(product) {
    const text = [
        getProperty(product, 'accommodation'),
        getProperty(product, 'label'),
        ...getPropertyValues(product, 'USP'),
    ].join(' ');
    const ofMatch = text.match(/(?:,\s*\d+\s*)*of\s+(\d+)\s+(?:overnachtingen|nachten|dagen)/i);
    if (ofMatch) {
        return Number(ofMatch[1]);
    }
    const durationMatch = text.match(/(\d+)\s+(?:overnachtingen|nachten|dagen)/i);
    if (durationMatch) {
        return Number(durationMatch[1]);
    }
    const stayMatch = text.match(/verblijf\s+(\d+)/i);
    if (stayMatch) {
        return Number(stayMatch[1]);
    }
    return null;
}
function parseBoardType(product) {
    const text = [
        getProperty(product, 'accommodation'),
        getProperty(product, 'descriptionShort'),
        ...getPropertyValues(product, 'USP'),
    ]
        .join(' ')
        .toLowerCase();
    if (text.includes('all inclusive')) {
        return 'All Inclusive';
    }
    if (text.includes('half pension') || text.includes('halfpension')) {
        return 'Half pension';
    }
    if (text.includes('vol pension') || text.includes('volpension')) {
        return 'Vol pension';
    }
    if (text.includes('ontbijt')) {
        return 'Logies en ontbijt';
    }
    if (text.includes('logies')) {
        return 'Logies';
    }
    return undefined;
}
function mapTraveldealProduct(product) {
    const { price, currency } = parsePrice(product);
    const images = parseImages(product);
    const imageLarge = getProperty(product, 'imageURL_large');
    const imageSmall = getProperty(product, 'imageURL_small');
    const uspValues = getPropertyValues(product, 'USP');
    const nights = parseNights(product);
    return {
        externalId: (0, providers_1.buildExternalId)('traveldeal', product.ID),
        provider: providers_1.PROVIDERS.traveldeal.name,
        hotelName: product.name,
        accommodation: getProperty(product, 'accommodation') || undefined,
        stars: toNumber(getProperty(product, 'stars')),
        descriptionShort: getProperty(product, 'descriptionShort') || undefined,
        descriptionLong: getProperty(product, 'descriptionLong') || undefined,
        extraInfo: getProperty(product, 'label') || undefined,
        feedDescription: parseFeedDescription(product),
        price,
        currency,
        deepLink: product.URL,
        imageUrl: images?.[0] ?? imageLarge ?? '',
        imageLarge: imageLarge || undefined,
        imageSmall: imageSmall || undefined,
        images,
        nights,
        durationType: nights != null ? 'dagen' : undefined,
        flightIncluded: 'false',
        boardType: parseBoardType(product),
        country: getProperty(product, 'country'),
        region: getProperty(product, 'region') || undefined,
        city: getProperty(product, 'city') || undefined,
        latitude: toNumber(getProperty(product, 'latitude')),
        longitude: toNumber(getProperty(product, 'longitude')),
        subcategories: uspValues.length > 0 ? uspValues.join(' | ') : undefined,
        categories: parseCategories(product),
        variations: parseVariations(product),
        affiliateCampaignId: product.campaignID != null ? String(product.campaignID) : undefined,
    };
}
function importTraveldealXml(xml) {
    const parser = new fast_xml_parser_1.XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '',
    });
    const parsed = parser.parse(xml);
    const products = parsed.products.product;
    const productList = Array.isArray(products) ? products : [products];
    return productList.map(mapTraveldealProduct);
}
