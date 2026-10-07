/**
 * Fase L1 — Sunweb concurrency canary resolver + lockstep page1/matchset.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SUNWEB_LIVE_CONCURRENCY_BASELINE,
  SUNWEB_LIVE_CONCURRENCY_CANARY,
  SUNWEB_LIVE_MATCHSET_CONCURRENCY,
  SUNWEB_LIVE_PAGE1_CONCURRENCY,
  resolveSunwebLiveConcurrency,
} from './sunweb/constants';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '../..');

test('L1 canary resolver: unset → 5; =8 → 8; higher values rejected', () => {
  assert.equal(resolveSunwebLiveConcurrency({}), SUNWEB_LIVE_CONCURRENCY_BASELINE);
  assert.equal(
    resolveSunwebLiveConcurrency({ VACATIONWEB_SUNWEB_LIVE_CONCURRENCY: '8' }),
    SUNWEB_LIVE_CONCURRENCY_CANARY,
  );
  assert.equal(
    resolveSunwebLiveConcurrency({ VACATIONWEB_SUNWEB_LIVE_CONCURRENCY: '10' }),
    SUNWEB_LIVE_CONCURRENCY_BASELINE,
  );
  assert.equal(
    resolveSunwebLiveConcurrency({ VACATIONWEB_SUNWEB_LIVE_CONCURRENCY: '7' }),
    SUNWEB_LIVE_CONCURRENCY_BASELINE,
  );
});

test('L1 page1 and matchset stay in lockstep (no separate hardcoded matchset 5)', () => {
  assert.equal(SUNWEB_LIVE_PAGE1_CONCURRENCY, SUNWEB_LIVE_MATCHSET_CONCURRENCY);
  assert.equal(SUNWEB_LIVE_PAGE1_CONCURRENCY, resolveSunwebLiveConcurrency());
  const pricing = readFileSync(
    join(ROOT, 'lib/providers/prijsvrij/page1-receipt-pricing.ts'),
    'utf8',
  );
  assert.match(pricing, /SUNWEB_LIVE_MATCHSET_CONCURRENCY/);
  assert.equal(/const SUNWEB_LIVE_MATCHSET_CONCURRENCY\s*=\s*5/.test(pricing), false);
});

test('L1 default process (no canary env) remains baseline C=5', () => {
  assert.equal(SUNWEB_LIVE_CONCURRENCY_BASELINE, 5);
  assert.equal(SUNWEB_LIVE_CONCURRENCY_CANARY, 8);
  // Module constants reflect process env at import time. When the canary env is
  // unset in this process, PAGE1/MATCHSET must stay at baseline 5.
  const canary = process.env.VACATIONWEB_SUNWEB_LIVE_CONCURRENCY;
  if (canary === undefined || canary.trim() === '') {
    assert.equal(SUNWEB_LIVE_PAGE1_CONCURRENCY, 5);
    assert.equal(SUNWEB_LIVE_MATCHSET_CONCURRENCY, 5);
  } else {
    assert.equal(SUNWEB_LIVE_PAGE1_CONCURRENCY, resolveSunwebLiveConcurrency());
    assert.equal(SUNWEB_LIVE_MATCHSET_CONCURRENCY, resolveSunwebLiveConcurrency());
  }
});
