import './globals.css';
import { ConsentProvider } from '@/components/consent/consent-provider';
import { CookieBanner } from '@/components/consent/cookie-banner';
import { FavoritesProvider } from '@/components/favorites/favorites-provider';
import { LanguageChoiceDialog } from '@/components/i18n/language-choice-dialog';
import { UiLanguageProvider } from '@/components/i18n/ui-language-provider';
import { chromeCopy } from '@/lib/i18n/chrome-copy';
import { requestUiLanguage } from '@/lib/i18n/request-ui-language';
import type { Metadata } from 'next';

export function generateMetadata(): Metadata {
  const copy = chromeCopy(requestUiLanguage().language);
  return {
    title: copy.meta.title,
    description: copy.meta.description,
    keywords: ['vakantie', 'vacationweb', 'vakantie vergelijken', 'vakantievergelijking', 'bestemmingen'],
    referrer: 'strict-origin-when-cross-origin',
    openGraph: {
      title: copy.meta.title,
      description: copy.meta.ogDescription,
      type: 'website',
    },
  };
}

/**
 * t66u: the host decides the market (.be BE, .nl NL); on .be the UI language is NL or FR
 * (remembered choice, first-visit popup), on .nl always NL. <html lang> follows.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  const uiLanguage = requestUiLanguage();
  return (
    <html lang={uiLanguage.htmlLang}>
      <body>
        <UiLanguageProvider value={uiLanguage}>
          <ConsentProvider>
            <FavoritesProvider>
              {children}
              <LanguageChoiceDialog />
              <CookieBanner deferUntilLanguageChosen={uiLanguage.needsChoice} />
            </FavoritesProvider>
          </ConsentProvider>
        </UiLanguageProvider>
      </body>
    </html>
  );
}
