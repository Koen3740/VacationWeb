import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import {
  CONSENT_SCHEMA_VERSION,
  canLoadOptionalCategory,
  clearCookieConsent,
  getConsentRecord,
  getCookieConsent,
  hasCookieConsent,
  isAnalyticsAllowed,
  isMarketingAllowed,
  revokeOptionalConsent,
  setCookieConsent,
  setCookiePreferences,
  COOKIE_CONSENT_STORAGE_KEY,
} from './cookie-consent';

const memory = new Map<string, string>();

function installMemoryStorage() {
  const storage = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value);
    },
    removeItem: (key: string) => {
      memory.delete(key);
    },
    clear: () => memory.clear(),
    key: (index: number) => [...memory.keys()][index] ?? null,
    get length() {
      return memory.size;
    },
  } satisfies Storage;
  Object.defineProperty(globalThis, 'window', {
    value: {
      localStorage: storage,
      dispatchEvent: () => true,
    },
    configurable: true,
    writable: true,
  });
}

afterEach(() => {
  memory.clear();
  clearCookieConsent();
});

test('consent defaults off and has no consent until set', () => {
  installMemoryStorage();
  assert.equal(hasCookieConsent(), false);
  assert.equal(isAnalyticsAllowed(), false);
  assert.equal(isMarketingAllowed(), false);
  assert.equal(canLoadOptionalCategory('analytics'), false);
});

test('accept all stores canonical record with analytics+marketing', () => {
  installMemoryStorage();
  setCookieConsent('all');
  const record = getConsentRecord();
  assert.ok(record);
  assert.equal(record!.version, CONSENT_SCHEMA_VERSION);
  assert.equal(record!.necessary, true);
  assert.equal(record!.analytics, true);
  assert.equal(record!.marketing, true);
  assert.equal(record!.source, 'accept_all');
  assert.equal(isAnalyticsAllowed(), true);
  assert.equal(isMarketingAllowed(), true);
});

test('necessary only keeps analytics/marketing off', () => {
  installMemoryStorage();
  setCookieConsent('necessary');
  assert.deepEqual(getCookieConsent(), { analytics: false, marketing: false });
  assert.equal(getConsentRecord()?.source, 'necessary_only');
});

test('preferences and revoke update store', () => {
  installMemoryStorage();
  setCookiePreferences({ analytics: true, marketing: false });
  assert.equal(isAnalyticsAllowed(), true);
  assert.equal(isMarketingAllowed(), false);
  revokeOptionalConsent();
  assert.equal(isAnalyticsAllowed(), false);
  assert.equal(isMarketingAllowed(), false);
  assert.equal(getConsentRecord()?.source, 'revoke');
});

test('legacy all string migrates to canonical record', () => {
  installMemoryStorage();
  memory.set(COOKIE_CONSENT_STORAGE_KEY, 'all');
  const record = getConsentRecord();
  assert.ok(record);
  assert.equal(record!.analytics, true);
  assert.equal(record!.source, 'legacy');
  const stored = JSON.parse(memory.get(COOKIE_CONSENT_STORAGE_KEY)!);
  assert.equal(stored.version, CONSENT_SCHEMA_VERSION);
});
