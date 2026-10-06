import assert from 'node:assert/strict';
import test from 'node:test';
import { promotionMarketsForHost, resolveSiteMarketFromHost } from './site-market';

test('vacationweb hosts map www and apex to one market', () => {
  assert.equal(resolveSiteMarketFromHost('www.vacationweb.nl'), 'nl');
  assert.equal(resolveSiteMarketFromHost('vacationweb.nl'), 'nl');
  assert.equal(resolveSiteMarketFromHost('www.vacationweb.be'), 'be');
  assert.equal(resolveSiteMarketFromHost('vacationweb.be'), 'be');
  assert.equal(resolveSiteMarketFromHost('WWW.VacationWeb.NL:443'), 'nl');
  assert.equal(resolveSiteMarketFromHost('www.vacationweb.be:443'), 'be');
  assert.deepEqual(promotionMarketsForHost('www.vacationweb.nl'), ['nl']);
  assert.deepEqual(promotionMarketsForHost('vacationweb.nl'), ['nl']);
  assert.deepEqual(promotionMarketsForHost('www.vacationweb.be'), ['be']);
  assert.deepEqual(promotionMarketsForHost('vacationweb.be'), ['be']);
  assert.deepEqual(promotionMarketsForHost('vacation-web-delta.vercel.app'), ['nl', 'be']);
  assert.deepEqual(promotionMarketsForHost('localhost:3000'), ['nl', 'be']);
});
