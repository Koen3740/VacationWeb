const { parseCorendonFeed } = require('./parser');
const { validateOffers } = require('./validator');
const { saveNormalizedOffers } = require('./repository');

function ingestCorendonFeed({ payload, storePath } = {}) {
  const parsed = parseCorendonFeed(payload);
  const validation = validateOffers(parsed.offers);
  const saveResult = saveNormalizedOffers({ offers: validation.valid, storePath });

  return {
    savedCount: saveResult.count,
    invalidCount: validation.invalid.length,
    storePath: saveResult.storePath,
  };
}

module.exports = {
  ingestCorendonFeed,
};
