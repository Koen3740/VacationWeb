import assert from 'node:assert/strict';
import test from 'node:test';
import { VACATIONWEB_TRADETRACKER_AFFILIATE_SITE_ID } from './constants';
import { getTradeTrackerSoapCredentials, resolveAffiliateSiteIdForIngest } from './credentials';
import { redactSecrets, TradeTrackerCredentialsError } from './errors';

test('missing credentials throw without leaking values', () => {
  assert.throws(
    () =>
      getTradeTrackerSoapCredentials({
        loadFiles: false,
        env: {
          // Explicit empty bag: do not inherit .env.local from the host process.
        },
      }),
    (error: unknown) => {
      assert.ok(error instanceof TradeTrackerCredentialsError);
      assert.match(error.message, /TRADETRACKER_CUSTOMER_ID/);
      assert.match(error.message, /TRADETRACKER_ACCESS_KEY/);
      assert.equal(error.message.includes('secret-value'), false);
      return true;
    },
  );
});

test('resolveAffiliateSiteIdForIngest defaults to VacationWeb 512226', () => {
  assert.equal(
    resolveAffiliateSiteIdForIngest({ loadFiles: false, env: {} }),
    VACATIONWEB_TRADETRACKER_AFFILIATE_SITE_ID,
  );
  assert.equal(
    resolveAffiliateSiteIdForIngest({
      loadFiles: false,
      env: { TRADETRACKER_AFFILIATE_SITE_ID: '512226' },
    }),
    '512226',
  );
});

test('BE credentials read TRADETRACKER_BE_* and do not use the NL key', () => {
  const credentials = getTradeTrackerSoapCredentials({
    loadFiles: false,
    market: 'be',
    env: {
      TRADETRACKER_CUSTOMER_ID: '111',
      TRADETRACKER_ACCESS_KEY: 'nl-secret-key',
      TRADETRACKER_BE_CUSTOMER_ID: '303580',
      TRADETRACKER_BE_ACCESS_KEY: 'be-secret-key',
    },
  });
  assert.equal(credentials.customerID, 303580);
  assert.equal(credentials.passphrase, 'be-secret-key');
  assert.equal(credentials.passphrase.includes('nl-secret-key'), false);
});

test('NL credentials stay on TRADETRACKER_* when BE vars are also present', () => {
  const credentials = getTradeTrackerSoapCredentials({
    loadFiles: false,
    env: {
      TRADETRACKER_CUSTOMER_ID: '303580',
      TRADETRACKER_ACCESS_KEY: 'nl-secret-key',
      TRADETRACKER_BE_CUSTOMER_ID: '303580',
      TRADETRACKER_BE_ACCESS_KEY: 'be-secret-key',
    },
  });
  assert.equal(credentials.passphrase, 'nl-secret-key');
});

test('missing BE credentials name the BE env vars and do not leak values', () => {
  assert.throws(
    () =>
      getTradeTrackerSoapCredentials({
        loadFiles: false,
        market: 'be',
        env: {
          TRADETRACKER_CUSTOMER_ID: '303580',
          TRADETRACKER_ACCESS_KEY: 'nl-secret-key',
        },
      }),
    (error: unknown) => {
      assert.ok(error instanceof TradeTrackerCredentialsError);
      assert.match(error.message, /TRADETRACKER_BE_CUSTOMER_ID/);
      assert.match(error.message, /TRADETRACKER_BE_ACCESS_KEY/);
      assert.equal(error.message.includes('nl-secret-key'), false);
      return true;
    },
  );
});

test('invalid BE customer id names TRADETRACKER_BE_CUSTOMER_ID', () => {
  assert.throws(
    () =>
      getTradeTrackerSoapCredentials({
        loadFiles: false,
        market: 'be',
        env: {
          TRADETRACKER_BE_CUSTOMER_ID: 'nope',
          TRADETRACKER_BE_ACCESS_KEY: 'be-secret-key',
        },
      }),
    (error: unknown) => {
      assert.ok(error instanceof TradeTrackerCredentialsError);
      assert.match(error.message, /TRADETRACKER_BE_CUSTOMER_ID/);
      assert.equal(error.message.includes('be-secret-key'), false);
      return true;
    },
  );
});

test('redactSecrets strips passphrase assignments from messages', () => {
  const redacted = redactSecrets(
    'SOAP fault passphrase=abc123 leftover TRADETRACKER_ACCESS_KEY name stays',
  );
  assert.equal(redacted.includes('abc123'), false);
  assert.match(redacted, /\[redacted\]/);
  assert.match(redacted, /TRADETRACKER_ACCESS_KEY/);
});
