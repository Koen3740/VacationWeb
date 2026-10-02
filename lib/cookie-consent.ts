/**
 * VacationWeb cookie consent store (Sub 25).
 * Analytics/marketing default OFF. No trackers are installed; this gate is
 * ready for future opt-in loading only.
 */

export type CookieConsentChoice = 'all' | 'necessary';

export type CookiePreferences = {
  analytics: boolean;
  marketing: boolean;
};

export type ConsentSource = 'accept_all' | 'necessary_only' | 'preferences' | 'revoke' | 'legacy';

/** Canonical persisted consent record. */
export type ConsentRecord = {
  version: number;
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  timestamp: string;
  source: ConsentSource;
};

export const COOKIE_CONSENT_STORAGE_KEY = 'vacationweb-cookie-consent';
export const OPEN_COOKIE_PREFERENCES_EVENT = 'vacationweb:open-cookie-preferences';
export const CONSENT_CHANGED_EVENT = 'vacationweb:consent-changed';
export const CONSENT_SCHEMA_VERSION = 1;

const DEFAULT_OFF: CookiePreferences = {
  analytics: false,
  marketing: false,
};

function isCookiePreferences(value: unknown): value is CookiePreferences {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record.analytics === 'boolean' && typeof record.marketing === 'boolean';
}

function isConsentRecord(value: unknown): value is ConsentRecord {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.version === 'number' &&
    record.necessary === true &&
    typeof record.analytics === 'boolean' &&
    typeof record.marketing === 'boolean' &&
    typeof record.timestamp === 'string' &&
    typeof record.source === 'string'
  );
}

function toRecord(
  preferences: CookiePreferences,
  source: ConsentSource,
  timestamp: string = new Date().toISOString(),
): ConsentRecord {
  return {
    version: CONSENT_SCHEMA_VERSION,
    necessary: true,
    analytics: preferences.analytics,
    marketing: preferences.marketing,
    timestamp,
    source,
  };
}

function safeGetItem(key: string): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeRemoveItem(key: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore quota / private-mode failures
  }
}

function emitConsentChanged(record: ConsentRecord | null): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT, { detail: record }));
}

function persist(record: ConsentRecord): void {
  safeSetItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(record));
  emitConsentChanged(record);
}

/** Migrate legacy `'all' | 'necessary' | {analytics,marketing}` into canonical record. */
export function getConsentRecord(): ConsentRecord | null {
  const value = safeGetItem(COOKIE_CONSENT_STORAGE_KEY);
  if (!value) {
    return null;
  }

  if (value === 'all') {
    const record = toRecord({ analytics: true, marketing: true }, 'legacy');
    persist(record);
    return record;
  }

  if (value === 'necessary') {
    const record = toRecord(DEFAULT_OFF, 'legacy');
    persist(record);
    return record;
  }

  try {
    const parsed: unknown = JSON.parse(value);
    if (isConsentRecord(parsed)) {
      return parsed;
    }
    if (isCookiePreferences(parsed)) {
      const record = toRecord(parsed, 'legacy');
      persist(record);
      return record;
    }
  } catch {
    return null;
  }

  return null;
}

/** @deprecated Prefer getConsentRecord(); kept for existing callers. */
export function getCookieConsent(): CookiePreferences | null {
  const record = getConsentRecord();
  if (!record) {
    return null;
  }
  return { analytics: record.analytics, marketing: record.marketing };
}

export function hasCookieConsent(): boolean {
  return getConsentRecord() !== null;
}

export function setCookieConsent(choice: CookieConsentChoice): void {
  if (choice === 'all') {
    persist(toRecord({ analytics: true, marketing: true }, 'accept_all'));
    return;
  }
  persist(toRecord(DEFAULT_OFF, 'necessary_only'));
}

export function setCookiePreferences(preferences: CookiePreferences): void {
  persist(
    toRecord(
      {
        analytics: Boolean(preferences.analytics),
        marketing: Boolean(preferences.marketing),
      },
      'preferences',
    ),
  );
}

/** Withdraw optional consent (analytics + marketing off). Necessary remains. */
export function revokeOptionalConsent(): void {
  persist(toRecord(DEFAULT_OFF, 'revoke'));
}

/** Clear stored choice so the banner shows again (first-visit flow). */
export function clearCookieConsent(): void {
  safeRemoveItem(COOKIE_CONSENT_STORAGE_KEY);
  emitConsentChanged(null);
}

export function openCookiePreferences(): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new CustomEvent(OPEN_COOKIE_PREFERENCES_EVENT));
}

/** Gate helpers — always false until a real analytics/marketing loader is installed. */
export function isAnalyticsAllowed(): boolean {
  return getConsentRecord()?.analytics === true;
}

export function isMarketingAllowed(): boolean {
  return getConsentRecord()?.marketing === true;
}

/**
 * Future hook: call before loading any analytics/marketing script.
 * Currently returns false always for script loading because no providers are installed;
 * still reflects stored preference for UI/tests.
 */
export function canLoadOptionalCategory(category: 'analytics' | 'marketing'): boolean {
  if (category === 'analytics') {
    return isAnalyticsAllowed();
  }
  return isMarketingAllowed();
}
