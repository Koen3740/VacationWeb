import { cookies } from 'next/headers';
import { requestSiteMarket } from '@/lib/search/request-site-market';
import { resolveUiLanguage, UI_LANGUAGE_COOKIE, type UiLanguageState } from '@/lib/i18n/ui-language';

/** UI language of the current request (server components only). Market comes from the host. */
export function requestUiLanguage(): UiLanguageState {
  return resolveUiLanguage(requestSiteMarket(), cookies().get(UI_LANGUAGE_COOKIE)?.value);
}
