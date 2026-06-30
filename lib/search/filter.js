const fs = require('node:fs');
const path = require('node:path');

class FilterEngine {
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

  filter(filters = {}) {
    const documents = this.index?.documents || [];
    const activeFilters = Object.entries(filters).filter(([, value]) => value !== undefined && value !== null && value !== '');

    const filtered = documents.filter((document) => {
      return activeFilters.every(([key, value]) => {
        switch (key) {
          case 'budgetMin':
            return Number(document.price) >= Number(value);
          case 'budgetMax':
            return Number(document.price) <= Number(value);
          case 'nightsMin':
          case 'minNights':
            return Number(document.nights) >= Number(value);
          case 'nightsMax':
          case 'maxNights':
            return Number(document.nights) <= Number(value);
          case 'destination':
            return String(document.destination || '').toLowerCase().includes(String(value).toLowerCase());
          case 'country':
            return String(document.country || '').toLowerCase().includes(String(value).toLowerCase());
          case 'boardType':
          case 'board':
          case 'careType':
            return String(document.boardType || '').toLowerCase().includes(String(value).toLowerCase());
          case 'provider':
            return String(document.provider || '').toLowerCase().includes(String(value).toLowerCase());
          default:
            return true;
        }
      });
    });

    return {
      filters,
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
  FilterEngine,
};
