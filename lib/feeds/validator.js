function validateOffers(offers) {
  const valid = [];
  const invalid = [];

  for (const offer of offers) {
    const requiredFields = ['externalId', 'hotelName', 'destination', 'country', 'price', 'nights', 'boardType', 'departureDate'];
    const missing = requiredFields.filter((field) => {
      const value = offer[field];
      if (field === 'price' || field === 'nights') {
        return value === undefined || value === null || Number.isNaN(Number(value));
      }
      return value === undefined || value === null || String(value).trim() === '';
    });

    if (missing.length > 0) {
      invalid.push({
        offer,
        reason: missing.includes('hotelName') ? 'missing_hotel_name' : 'missing_required_fields',
      });
      continue;
    }

    valid.push(offer);
  }

  return { valid, invalid };
}

module.exports = {
  validateOffers,
};
