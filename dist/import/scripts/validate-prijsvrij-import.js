"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const normalize_offer_1 = require("../lib/feeds/canonical/normalize-offer");
const feed_paths_1 = require("../lib/feeds/feed-paths");
const corendon_1 = require("../lib/feeds/importers/corendon");
const prijsvrij_1 = require("../lib/feeds/importers/prijsvrij");
const STORED_OFFER_FIELDS = [
    'externalId',
    'provider',
    'hotelName',
    'accommodation',
    'accommodationType',
    'country',
    'province',
    'region',
    'city',
    'departureAirport',
    'departureAirportCode',
    'airport',
    'departureDate',
    'boardType',
    'nights',
    'durationType',
    'flightIncluded',
    'lastMinute',
    'price',
    'currency',
    'stars',
    'rating',
    'imageUrl',
    'imageLarge',
    'imageSmall',
    'images',
    'descriptionShort',
    'descriptionLong',
    'extraInfo',
    'feedDescription',
    'latitude',
    'longitude',
    'subcategories',
    'categories',
    'variations',
    'deepLink',
    'affiliateCampaignId',
];
const PRIJSVRIJ_XML_PRODUCT_FIELDS = [
    'ID',
    'campaignID',
    'name',
    'price',
    'URL',
    'images',
    'description',
    'categories',
    'variations',
    'properties',
];
const PRIJSVRIJ_XML_PROPERTY_FIELDS = [
    'minimum_price',
    'priority',
    'country_of_origin',
    'duration',
    'board_type',
    'stars',
    'imageURL2',
    'imageURL3',
    'imageURL4',
    'imageURL5',
    'imageURL6',
    'imageURL7',
    'imageURL8',
    'imageURL9',
    'imageURL10',
    'descriptionShort',
    'region',
    'transportType',
    'departureDate',
    'minPersons',
    'latitude',
    'longitude',
    'accommodationType',
    'city',
    'country',
];
const CORENDON_XML_PROPERTY_FIELDS = [
    'accommodation',
    'accommodationType',
    'airport',
    'city',
    'country',
    'departureDate',
    'descriptionLong',
    'descriptionShort',
    'duration',
    'durationType',
    'extraInfo',
    'flightIncluded',
    'iataDeparture',
    'imageURL_large',
    'imageURL_small',
    'isoCodeDeparture',
    'lastminute',
    'latitude',
    'longitude',
    'province',
    'rating',
    'region',
    'serviceType',
    'stars',
    'subcategories',
];
function hasValue(value) {
    if (value === undefined || value === null || value === '') {
        return false;
    }
    if (Array.isArray(value)) {
        return value.length > 0;
    }
    return true;
}
function countFieldPresence(offers, field) {
    return offers.filter((offer) => hasValue(offer[field])).length;
}
function sampleMissingOffers(offers, field, limit) {
    return offers.filter((offer) => !hasValue(offer[field])).slice(0, limit);
}
function main() {
    const prijsvrijXml = node_fs_1.default.readFileSync(feed_paths_1.FEED_PATHS.prijsvrij, 'utf8');
    const corendonXml = node_fs_1.default.readFileSync(feed_paths_1.FEED_PATHS.corendon, 'utf8');
    const prijsvrijStored = (0, prijsvrij_1.importPrijsvrijXml)(prijsvrijXml);
    const corendonStored = (0, corendon_1.importCorendonXml)(corendonXml);
    const prijsvrijNormalized = prijsvrijStored.map(normalize_offer_1.normalizeOffer);
    const corendonNormalized = corendonStored.map(normalize_offer_1.normalizeOffer);
    const prijsvrijFieldCoverage = Object.fromEntries(STORED_OFFER_FIELDS.map((field) => [
        field,
        {
            count: countFieldPresence(prijsvrijStored, field),
            percentage: Number(((countFieldPresence(prijsvrijStored, field) / prijsvrijStored.length) * 100).toFixed(1)),
        },
    ]));
    const corendonFieldCoverage = Object.fromEntries(STORED_OFFER_FIELDS.map((field) => [
        field,
        {
            count: countFieldPresence(corendonStored, field),
            percentage: Number(((countFieldPresence(corendonStored, field) / corendonStored.length) * 100).toFixed(1)),
        },
    ]));
    const prijsvrijOnlyXmlProperties = PRIJSVRIJ_XML_PROPERTY_FIELDS.filter((field) => !CORENDON_XML_PROPERTY_FIELDS.includes(field));
    const corendonOnlyXmlProperties = CORENDON_XML_PROPERTY_FIELDS.filter((field) => !PRIJSVRIJ_XML_PROPERTY_FIELDS.includes(field));
    const sharedXmlProperties = PRIJSVRIJ_XML_PROPERTY_FIELDS.filter((field) => CORENDON_XML_PROPERTY_FIELDS.includes(field));
    const missingRequired = {
        missingCountry: prijsvrijStored.filter((offer) => !offer.country).length,
        missingHotelName: prijsvrijStored.filter((offer) => !offer.hotelName).length,
        missingPrice: prijsvrijStored.filter((offer) => offer.price <= 0).length,
        missingDeepLink: prijsvrijStored.filter((offer) => !offer.deepLink).length,
        missingImageUrl: prijsvrijStored.filter((offer) => !offer.imageUrl).length,
        missingNights: prijsvrijStored.filter((offer) => offer.nights === null || offer.nights <= 0).length,
    };
    const corendonIds = new Set(corendonStored.map((offer) => offer.externalId));
    const overlappingIds = prijsvrijStored.filter((offer) => corendonIds.has(offer.externalId)).length;
    const unmappedPrijsvrijFeedFields = [
        {
            xmlField: 'property: priority',
            reason: 'Feed-interne ranking, geen TravelOffer-equivalent',
        },
        {
            xmlField: 'property: country_of_origin',
            reason: 'Markt/locale (nl), geen veld in TravelOffer',
        },
        {
            xmlField: 'property: minPersons',
            reason: 'Minimum aantal personen, geen veld in TravelOffer',
        },
        {
            xmlField: 'property: board_type (raw code)',
            reason: 'Opgeslagen als gedecodeerde boardType, ruwe code niet bewaard',
        },
        {
            xmlField: 'property: transportType (raw code)',
            reason: 'Afgeleid naar flightIncluded=true, ruwe code niet bewaard',
        },
        {
            xmlField: 'product.price',
            reason: 'Altijd 0.00 in feed; minimum_price gebruikt als price',
        },
    ];
    const proposedTravelOfferFields = [
        {
            field: 'minPersons?: number',
            source: 'property: minPersons',
            recommendation: 'Optioneel toevoegen voor zoek/filter op reisgezelschap',
        },
        {
            field: 'transportType?: string',
            source: 'property: transportType',
            recommendation: 'Optioneel; nu afgeleid naar flightIncluded',
        },
        {
            field: 'marketCountry?: string',
            source: 'property: country_of_origin',
            recommendation: 'Optioneel voor BE/NL-markt onderscheid',
        },
        {
            field: 'boardTypeCode?: string',
            source: 'property: board_type',
            recommendation: 'Optioneel om ruwe provider-code te bewaren naast boardType',
        },
    ];
    const report = {
        generatedAt: new Date().toISOString(),
        summary: {
            prijsvrijSourceFile: feed_paths_1.FEED_PATHS.prijsvrij,
            corendonSourceFile: feed_paths_1.FEED_PATHS.corendon,
            prijsvrijOfferCount: prijsvrijStored.length,
            corendonOfferCount: corendonStored.length,
            prijsvrijNormalizedCount: prijsvrijNormalized.length,
            overlappingExternalIdsWithCorendon: overlappingIds,
            writesToOffersJson: false,
        },
        validation: missingRequired,
        xmlStructure: {
            sharedProductFields: PRIJSVRIJ_XML_PRODUCT_FIELDS,
            prijsvrijPropertyCount: PRIJSVRIJ_XML_PROPERTY_FIELDS.length,
            corendonPropertyCount: CORENDON_XML_PROPERTY_FIELDS.length,
            sharedProperties: sharedXmlProperties,
            prijsvrijOnlyProperties: prijsvrijOnlyXmlProperties,
            corendonOnlyProperties: corendonOnlyXmlProperties,
        },
        mapping: {
            prijsvrijFieldCoverage,
            corendonFieldCoverage,
            prijsvrijFieldsAlwaysMissing: STORED_OFFER_FIELDS.filter((field) => countFieldPresence(prijsvrijStored, field) === 0),
            corendonFieldsAlwaysMissing: STORED_OFFER_FIELDS.filter((field) => countFieldPresence(corendonStored, field) === 0),
        },
        unmappedFeedFields: unmappedPrijsvrijFeedFields,
        proposedTravelOfferFields,
        samples: {
            prijsvrijOffer: prijsvrijStored[0],
            prijsvrijNormalizedOffer: prijsvrijNormalized[0],
            missingDepartureAirportExamples: sampleMissingOffers(prijsvrijStored, 'departureAirport', 3).map((offer) => offer.externalId),
        },
    };
    const reportPath = node_path_1.default.join(process.cwd(), 'data', 'prijsvrij-validation-report.json');
    node_fs_1.default.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log('Prijsvrij import validatie');
    console.log('========================');
    console.log(`Bronbestand: ${report.summary.prijsvrijSourceFile}`);
    console.log(`Aanbiedingen: ${report.summary.prijsvrijOfferCount}`);
    console.log(`Corendon ter vergelijking: ${report.summary.corendonOfferCount}`);
    console.log(`Overlappende externalId met Corendon: ${report.summary.overlappingExternalIdsWithCorendon}`);
    console.log('');
    console.log('Validatie');
    for (const [key, value] of Object.entries(missingRequired)) {
        console.log(`- ${key}: ${value}`);
    }
    console.log('');
    console.log('StoredOffer-dekking Prijsvrij (selectie)');
    for (const field of ['price', 'country', 'region', 'city', 'boardType', 'departureDate', 'images', 'feedDescription', 'departureAirport', 'rating', 'province', 'descriptionLong']) {
        const coverage = prijsvrijFieldCoverage[field];
        console.log(`- ${field}: ${coverage.count} (${coverage.percentage}%)`);
    }
    console.log('');
    console.log('Altijd leeg bij Prijsvrij:', report.mapping.prijsvrijFieldsAlwaysMissing.join(', '));
    console.log('');
    console.log('Prijsvrij-only XML properties:', prijsvrijOnlyXmlProperties.join(', '));
    console.log('Corendon-only XML properties:', corendonOnlyXmlProperties.join(', '));
    console.log('');
    console.log('Voorgestelde nieuwe TravelOffer-velden:');
    for (const item of proposedTravelOfferFields) {
        console.log(`- ${item.field} ← ${item.source}`);
    }
    console.log('');
    console.log(`Rapport geschreven naar: ${reportPath}`);
    console.log('offers.json is niet gewijzigd.');
}
main();
