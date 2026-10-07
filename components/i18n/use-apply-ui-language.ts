'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import type { SiteMarket } from '@/lib/search/site-market';
import {
  buildUiLanguageCookie,
  htmlLangFor,
  UI_LANGUAGE_CHOSEN_EVENT,
  type UiLanguage,
} from '@/lib/i18n/ui-language';
import { useUiLanguage } from '@/components/i18n/ui-language-provider';

export type ApplyUiLanguageEnv = {
  market: SiteMarket | undefined;
  supportedLanguages: readonly UiLanguage[];
  document: { cookie: string; documentElement: { lang: string } };
  secure: boolean;
  dispatchChosen: (language: UiLanguage) => void;
  refresh: () => void;
};

/**
 * Remember the language (cookie) and re-render the server tree in that language.
 * Returns false (and does nothing) for a language the market does not offer (.nl: FR).
 */
export function applyUiLanguageChoice(language: UiLanguage, env: ApplyUiLanguageEnv): boolean {
  if (!env.supportedLanguages.includes(language)) {
    return false;
  }
  env.document.cookie = buildUiLanguageCookie(language, env.secure);
  env.document.documentElement.lang = htmlLangFor(language, env.market);
  env.dispatchChosen(language);
  env.refresh();
  return true;
}

export function useApplyUiLanguage(): (language: UiLanguage) => void {
  const router = useRouter();
  const { market, supportedLanguages } = useUiLanguage();
  return useCallback(
    (language: UiLanguage) => {
      applyUiLanguageChoice(language, {
        market,
        supportedLanguages,
        document,
        secure: window.location.protocol === 'https:',
        dispatchChosen: (chosen) =>
          window.dispatchEvent(new CustomEvent(UI_LANGUAGE_CHOSEN_EVENT, { detail: { language: chosen } })),
        refresh: () => router.refresh(),
      });
    },
    [market, router, supportedLanguages],
  );
}
