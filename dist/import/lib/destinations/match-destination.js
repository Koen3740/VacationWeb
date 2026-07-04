"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOfferSearchableRegion = getOfferSearchableRegion;
exports.offerMatchesDestination = offerMatchesDestination;
exports.countOffersForDestination = countOffersForDestination;
const searchable_region_1 = require("./searchable-region");
function getOfferSearchableRegion(offer) {
    return (0, searchable_region_1.resolveSearchableRegion)({
        country: offer.destinationCountry,
        region: offer.destinationRegion,
        province: offer.destinationProvince,
        city: offer.destinationCity,
    });
}
function offerMatchesDestination(offer, params) {
    if (params.country && offer.destinationCountry !== params.country) {
        return false;
    }
    if (params.region) {
        const offerRegion = getOfferSearchableRegion(offer);
        if (!offerRegion || offerRegion !== params.region) {
            return false;
        }
    }
    return true;
}
function countOffersForDestination(offers, params) {
    return offers.filter((offer) => offerMatchesDestination(offer, params)).length;
}
