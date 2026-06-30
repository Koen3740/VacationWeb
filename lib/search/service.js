const fs = require('node:fs');
const path = require('node:path');

class SearchService {
  constructor({ index, indexPath } = {}) {
    this.indexPath = indexPath;
    this.index = index || this.loadIndex(indexPath);
  }

  loadIndex(indexPath) {
    const resolvedPath = indexPath || path.join(process.cwd(), 'data', 'phase1a-proof', 'offers-index.json');
    if (!fs.existsSync(resolvedPath)) {
      return { documents: [] };
    }

    return JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  }

  search({ query } = {}) {
    const normalizedQuery = (query || '').toLowerCase().trim();
    const documents = this.index?.documents || [];

    if (!normalizedQuery) {
      return {
        query: normalizedQuery,
        total: documents.length,
        items: this.sortDocuments(documents),
      };
    }

    const filtered = documents.filter((document) => {
      const haystack = [
        document.hotelName,
        document.destination,
        document.country,
        document.region,
        document.provider,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });

    return {
      query: normalizedQuery,
      total: filtered.length,
      items: this.sortDocuments(filtered),
    };
  }

  sortDocuments(documents) {
    return [...documents].sort((left, right) => {
      const leftValue = [left.destination, left.hotelName, left.externalId].filter(Boolean).join(' ').toLowerCase();
      const rightValue = [right.destination, right.hotelName, right.externalId].filter(Boolean).join(' ').toLowerCase();
      return leftValue.localeCompare(rightValue);
    });
  }
}

module.exports = {
  SearchService,
};
