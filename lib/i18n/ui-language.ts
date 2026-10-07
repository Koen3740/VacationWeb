import type { SiteMarket } from '@/lib/search/site-market';

/**
 * UI language (presentation only). The domain decides the market: vacationweb.be = BE market
 * (NL + FR), vacationweb.nl = NL market (NL only). Language never filters inventory, never
 * changes the market and never chooses the click-out host (Search Architecture / Data Model).
 * No IP or browser-locale based choice: on .be the visitor chooses once via the language popup.
 */
export type UiLanguage = 'nl' | 'fr';

/** First-party preference cookie (vacationweb.be only). Strictly necessary UI preference. */
export const UI_LANGUAGE_COOKIE = 'vacationweb-lang';
/** 12 months. */
export const UI_LANGUAGE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
/** Fired on window after the visitor picks a language (popup or header switch). */
export const UI_LANGUAGE_CHOSEN_EVENT = 'vacationweb:ui-language-chosen';

export const UI_LANGUAGE_NAMES: Readonly<Record<UiLanguage, string>> = {
  nl: 'Nederlands',
  fr: 'Français',
};

export const UI_LANGUAGE_CODES: Readonly<Record<UiLanguage, string>> = {
  nl: 'NL',
  fr: 'FR',
};

export function parseUiLanguage(value: string | undefined | null): UiLanguage | undefined {
  const normalized = value?.trim().toLowerCase();
  return normalized === 'nl' || normalized === 'fr' ? normalized : undefined;
}

/** .be offers NL + FR; .nl and hosts without a market (localhost, previews) are Dutch only. */
export function supportedUiLanguages(market: SiteMarket | undefined): readonly UiLanguage[] {
  return market === 'be' ? ['nl', 'fr'] : ['nl'];
}

export type UiLanguageState = {
  market: SiteMarket | undefined;
  language: UiLanguage;
  supportedLanguages: readonly UiLanguage[];
  /** .be without a remembered choice: show the first-visit language popup. */
  needsChoice: boolean;
  /** Value for <html lang>. */
  htmlLang: string;
};

export function htmlLangFor(language: UiLanguage, market: SiteMarket | undefined): string {
  if (market === 'be') {
    return language === 'fr' ? 'fr-BE' : 'nl-BE';
  }
  if (market === 'nl') {
    return 'nl-NL';
  }
  return 'nl';
}

/**
 * Resolve the UI language for a request. Only .be reads the preference cookie; on .nl a stale
 * cookie is ignored (Dutch only, no popup, no FR option).
 */
export function resolveUiLanguage(
  market: SiteMarket | undefined,
  cookieValue: string | undefined | null,
): UiLanguageState {
  const supportedLanguages = supportedUiLanguages(market);
  const remembered = market === 'be' ? parseUiLanguage(cookieValue) : undefined;
  const language: UiLanguage =
    remembered && supportedLanguages.includes(remembered) ? remembered : 'nl';
  return {
    market,
    language,
    supportedLanguages,
    needsChoice: market === 'be' && !remembered,
    htmlLang: htmlLangFor(language, market),
  };
}

/** `document.cookie` value that remembers the choice (host-only, Lax, Secure on https). */
export function buildUiLanguageCookie(language: UiLanguage, secure: boolean): string {
  return [
    `${UI_LANGUAGE_COOKIE}=${language}`,
    'Path=/',
    `Max-Age=${UI_LANGUAGE_COOKIE_MAX_AGE_SECONDS}`,
    'SameSite=Lax',
    ...(secure ? ['Secure'] : []),
  ].join('; ');
}
