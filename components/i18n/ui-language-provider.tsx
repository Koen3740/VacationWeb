'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { chromeCopy, type ChromeCopy } from '@/lib/i18n/chrome-copy';
import { resolveUiLanguage, type UiLanguageState } from '@/lib/i18n/ui-language';

const DEFAULT_STATE: UiLanguageState = resolveUiLanguage(undefined, undefined);

const UiLanguageContext = createContext<UiLanguageState>(DEFAULT_STATE);

/** Server-resolved UI language (root layout) for client chrome. One mechanism, no client guess. */
export function UiLanguageProvider({
  value,
  children,
}: {
  value: UiLanguageState;
  children: ReactNode;
}) {
  return <UiLanguageContext.Provider value={value}>{children}</UiLanguageContext.Provider>;
}

export function useUiLanguage(): UiLanguageState {
  return useContext(UiLanguageContext);
}

export function useChromeCopy(): ChromeCopy {
  return chromeCopy(useUiLanguage().language);
}
