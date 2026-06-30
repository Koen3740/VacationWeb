function parseCorendonFeed(payload) {
  const offers = (payload.offers || []).map((offer) => ({
    externalId: offer.externalId,
    hotelName: offer.hotelName,
    destination: offer.destination,
    country: offer.country,
    region: offer.region,
    price: Number(offer.price),
    currency: offer.currency || 'EUR',
    nights: Number(offer.nights),
    boardType: offer.boardType,
    departureDate: offer.departureDate,
    provider: payload.provider || 'Corendon',
  }));

  return {
    provider: payload.provider || 'Corendon',
    generatedAt: payload.generatedAt,
    offers,
  };
}

module.exports = {
  parseCorendonFeed,
};
