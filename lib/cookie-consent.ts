export type CookieConsentChoice = 'all' | 'necessary';

export type CookiePreferences = {
  analytics: boolean;
  marketing: boolean;
};

export const COOKIE_CONSENT_STORAGE_KEY = 'vacationweb-cookie-consent';
export const OPEN_COOKIE_PREFERENCES_EVENT = 'vacationweb:open-cookie-preferences';

function isCookiePreferences(value: unknown): value is CookiePreferences {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;

  return typeof record.analytics === 'boolean' && typeof record.marketing === 'boolean';
}

export function getCookieConsent(): CookiePreferences | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const value = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);

  if (!value) {
    return null;
  }

  if (value === 'all') {
    return { analytics: true, marketing: true };
  }

  if (value === 'necessary') {
    return { analytics: false, marketing: false };
  }

  try {
    const parsed: unknown = JSON.parse(value);

    if (isCookiePreferences(parsed)) {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}

export function hasCookieConsent(): boolean {
  return getCookieConsent() !== null;
}

export function setCookieConsent(choice: CookieConsentChoice): void {
  window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, choice);
}

export function setCookiePreferences(preferences: CookiePreferences): void {
  window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(preferences));
}

export function openCookiePreferences(): void {
  window.dispatchEvent(new CustomEvent(OPEN_COOKIE_PREFERENCES_EVENT));
}
