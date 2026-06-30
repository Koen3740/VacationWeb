const fs = require('node:fs');
const path = require('node:path');

function ensureIndexFile(indexPath) {
  const resolvedPath = indexPath || path.join(process.cwd(), 'data', 'offers-index.json');
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(resolvedPath)) {
    fs.writeFileSync(resolvedPath, JSON.stringify({ documents: [] }, null, 2));
  }

  return resolvedPath;
}

function normalizeOfferForIndex(offer) {
  return {
    id: offer.id || offer.externalId,
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
    provider: offer.provider,
  };
}

function buildOfferSearchIndex(offers = []) {
  const documents = offers.map(normalizeOfferForIndex);
  return { documents, createdAt: new Date().toISOString() };
}

function buildOfferIndex({ offers, indexPath } = {}) {
  const resolvedPath = ensureIndexFile(indexPath);
  const index = buildOfferSearchIndex(offers);
  fs.writeFileSync(resolvedPath, JSON.stringify(index, null, 2));
  return { indexPath: resolvedPath, count: index.documents.length };
}

function addOffersToSearchIndex(index, offers = []) {
  const nextDocuments = [...(index?.documents || []), ...offers.map(normalizeOfferForIndex)];
  return { ...index, documents: nextDocuments, updatedAt: new Date().toISOString() };
}

function searchOfferIndex(index, { query } = {}) {
  const normalizedQuery = (query || '').toLowerCase().trim();
  if (!normalizedQuery) {
    return index?.documents || [];
  }

  return (index?.documents || []).filter((record) => {
    const haystack = [record.hotelName, record.destination, record.country, record.region, record.provider]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });
}

function searchOffers({ query, indexPath } = {}) {
  const resolvedPath = ensureIndexFile(indexPath);
  const index = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  return searchOfferIndex(index, { query });
}

module.exports = {
  buildOfferIndex,
  buildOfferSearchIndex,
  addOffersToSearchIndex,
  searchOffers,
  searchOfferIndex,
};
