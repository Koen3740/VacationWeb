"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deriveFilterExtras = deriveFilterExtras;
exports.deriveFilterOptions = deriveFilterOptions;
function deriveFilterExtras(offers) {
    const boardTypeSet = new Set();
    const airportSet = new Set();
    for (const offer of offers) {
        if (offer.boardType) {
            boardTypeSet.add(offer.boardType);
        }
        if (offer.departureAirport) {
            airportSet.add(offer.departureAirport);
        }
    }
    return {
        boardTypes: [...boardTypeSet].sort(),
        departureAirports: [...airportSet].sort(),
    };
}
function deriveFilterOptions(offers) {
    const countrySet = new Set();
    const regionsByCountryMap = new Map();
    const boardTypeSet = new Set();
    const airportSet = new Set();
    for (const offer of offers) {
        const country = offer.destinationCountry;
        if (country) {
            countrySet.add(country);
            if (offer.destinationRegion) {
                const regions = regionsByCountryMap.get(country) ?? new Set();
                regions.add(offer.destinationRegion);
                regionsByCountryMap.set(country, regions);
            }
        }
        if (offer.boardType) {
            boardTypeSet.add(offer.boardType);
        }
        if (offer.departureAirport) {
            airportSet.add(offer.departureAirport);
        }
    }
    const regionsByCountry = {};
    for (const [country, regions] of regionsByCountryMap) {
        regionsByCountry[country] = [...regions].sort();
    }
    return {
        countries: [...countrySet].sort(),
        regionsByCountry,
        boardTypes: [...boardTypeSet].sort(),
        departureAirports: [...airportSet].sort(),
    };
}
