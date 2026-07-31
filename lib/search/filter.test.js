const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { FilterEngine } = require('./filter');

const fixtureIndexPath = path.join(__dirname, '__fixtures__', 'offers-index.json');

function loadFixtureIndex() {
  return JSON.parse(fs.readFileSync(fixtureIndexPath, 'utf8'));
}

test('US-11 filter engine applies multiple filters and returns standardized results', () => {
  const engine = new FilterEngine({ index: loadFixtureIndex() });

  const budgetResults = engine.filter({ budgetMin: 600 });
  assert.equal(budgetResults.total, 2);
  assert.equal(budgetResults.items[0].destination, 'Mallorca');

  const destinationResults = engine.filter({ destination: 'Mallorca' });
  assert.equal(destinationResults.total, 1);
  assert.equal(destinationResults.items[0].externalId, 'cor-1001');

  const combinedResults = engine.filter({ budgetMin: 700, destination: 'Tenerife', boardType: 'Half Board' });
  assert.equal(combinedResults.total, 1);
  assert.equal(combinedResults.items[0].externalId, 'cor-1002');

  const countryResults = engine.filter({ country: 'Spain' });
  assert.equal(countryResults.total, 2);

  const providerResults = engine.filter({ provider: 'Corendon' });
  assert.equal(providerResults.total, 2);
});
