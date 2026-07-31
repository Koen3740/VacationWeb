const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { SearchService } = require('./service');

const fixtureIndexPath = path.join(__dirname, '__fixtures__', 'offers-index.json');

function loadFixtureIndex() {
  return JSON.parse(fs.readFileSync(fixtureIndexPath, 'utf8'));
}

test('US-10 search service returns standardized results from the existing index', () => {
  const service = new SearchService({ index: loadFixtureIndex() });

  const destinationResults = service.search({ query: 'Mallorca' });
  assert.equal(destinationResults.total, 1);
  assert.equal(destinationResults.items[0].destination, 'Mallorca');
  assert.equal(destinationResults.items[0].externalId, 'cor-1001');

  const hotelResults = service.search({ query: 'Palma' });
  assert.equal(hotelResults.total, 1);
  assert.equal(hotelResults.items[0].hotelName, 'Hotel Palma Bay');

  const regionResults = service.search({ query: 'Tenerife' });
  assert.equal(regionResults.total, 1);
  assert.equal(regionResults.items[0].destination, 'Tenerife');

  const countryResults = service.search({ query: 'Spain' });
  assert.equal(countryResults.total, 2);
  assert.equal(countryResults.items[0].destination, 'Mallorca');

  const emptyResults = service.search({ query: 'unknown-term' });
  assert.equal(emptyResults.total, 0);
  assert.deepEqual(emptyResults.items, []);
});
