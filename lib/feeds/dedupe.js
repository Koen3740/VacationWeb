function dedupeOffers(offers) {
  const seen = new Set();
  const kept = [];
  const duplicates = [];

  for (const offer of offers) {
    const key = offer.externalId || `${offer.hotelName}-${offer.destination}-${offer.departureDate}`;
    if (seen.has(key)) {
      duplicates.push(offer);
      continue;
    }

    seen.add(key);
    kept.push(offer);
  }

  return { kept, duplicates };
}

module.exports = {
  dedupeOffers,
};
