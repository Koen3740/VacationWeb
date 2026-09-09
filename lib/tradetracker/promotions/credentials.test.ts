import assert from 'node:assert/strict';
import test from 'node:test';
import { getTradeTrackerSoapCredentials } from './credentials';
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

test('redactSecrets strips passphrase assignments from messages', () => {
  const redacted = redactSecrets(
    'SOAP fault passphrase=abc123 leftover TRADETRACKER_ACCESS_KEY name stays',
  );
  assert.equal(redacted.includes('abc123'), false);
  assert.match(redacted, /\[redacted\]/);
  assert.match(redacted, /TRADETRACKER_ACCESS_KEY/);
});
