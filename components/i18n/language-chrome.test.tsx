import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import React, { type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { HomeFooter } from '@/components/home/home-footer';
import { HomeHeader } from '@/components/home/home-header';
import { LanguageChoiceDialog } from '@/components/i18n/language-choice-dialog';
import { LanguageSwitcher } from '@/components/i18n/language-switcher';
import { UiLanguageProvider } from '@/components/i18n/ui-language-provider';
import { applyUiLanguageChoice } from '@/components/i18n/use-apply-ui-language';
import { ResultsSiteHeader } from '@/components/results-v2/results-site-header';
import { resolveUiLanguage, UI_LANGUAGE_COOKIE, type UiLanguage } from '@/lib/i18n/ui-language';
import type { SiteMarket } from '@/lib/search/site-market';

// Components use the automatic JSX runtime in Next; tsx compiles tests with the classic runtime.
(globalThis as { React?: typeof React }).React = React;

const router = {
  back() {},
  forward() {},
  refresh() {},
  push() {},
  replace() {},
  prefetch() {},
};

function render(node: ReactNode, market: SiteMarket | undefined, cookie?: string): string {
  return renderToStaticMarkup(
    <AppRouterContext.Provider value={router as never}>
      <UiLanguageProvider value={resolveUiLanguage(market, cookie)}>{node}</UiLanguageProvider>
    </AppRouterContext.Provider>,
  );
}

/** Flag markers that the old header used (tricolour stripes) or emoji flags. */
function assertNoFlags(html: string) {
  assert.equal(/bg-\[#AE1C28\]|bg-\[#21468B\]/.test(html), false, 'no NL tricolour');
  assert.equal(/[\u{1F1E6}-\u{1F1FF}]/u.test(html), false, 'no emoji flags');
}

test('1 .be first visit: language popup "Kies je taal / Choisissez votre langue" with Nederlands + Français', () => {
  const html = render(<LanguageChoiceDialog />, 'be');
  assert.match(html, /role="dialog"/);
  assert.match(html, /aria-modal="true"/);
  assert.match(html, /Kies je taal \/ Choisissez votre langue/);
  assert.match(html, /data-language="nl"[^>]*>Nederlands</);
  assert.match(html, /data-language="fr"[^>]*>Français</);
  assert.equal((html.match(/data-language=/g) ?? []).length, 2, 'exactly two choices, no country choice');
  assertNoFlags(html);
});

test('popup does not reappear once a choice is remembered; never on .nl', () => {
  assert.equal(render(<LanguageChoiceDialog />, 'be', 'nl'), '');
  assert.equal(render(<LanguageChoiceDialog />, 'be', 'fr'), '');
  assert.equal(render(<LanguageChoiceDialog />, 'nl'), '');
  assert.equal(render(<LanguageChoiceDialog />, 'nl', 'fr'), '');
  assert.equal(render(<LanguageChoiceDialog />, undefined), '');
});

test('2 NL works on .be: Dutch chrome, globe + NL indicator', () => {
  const html = render(<HomeHeader />, 'be', 'nl');
  for (const label of ['Discover', 'Bestemmingen', 'Inspiratie', 'Aanbiedingen', 'Over ons', 'Opgeslagen']) {
    assert.ok(html.includes(label), label);
  }
  assert.match(html, /aria-label="Hoofdnavigatie"/);
  assert.match(html, /data-testid="language-switcher"/);
  assert.match(html, /<span>NL<\/span>/);
  assertNoFlags(html);
});

test('3 FR works on .be: French chrome in homepage header, site header and footer', () => {
  const header = render(<HomeHeader />, 'be', 'fr');
  for (const label of ['Découvrir', 'Destinations', 'Inspiration', 'Promotions', 'À propos', 'Favoris']) {
    assert.ok(header.includes(label), label);
  }
  assert.match(header, /aria-label="Navigation principale"/);
  assert.match(header, /<span>FR<\/span>/);
  assert.equal(header.includes('Bestemmingen'), false);
  const site = render(<ResultsSiteHeader />, 'be', 'fr');
  assert.ok(site.includes('À propos') && site.includes('Favoris') && site.includes('<span>FR</span>'));
  const footer = render(<HomeFooter />, 'be', 'fr');
  for (const label of ['Découvrir', 'Notre mission', 'Politique de confidentialité', 'Retour en haut']) {
    assert.ok(footer.includes(label), label);
  }
  assert.ok(footer.includes('GHS-SMOD R2023A'), 'geo attribution unchanged (Dutch source text)');
});

test('4 choice persists after reload: cookie written by the choice is read back on the next request', () => {
  for (const language of ['fr', 'nl'] as const) {
    const fakeDocument = { cookie: '', documentElement: { lang: 'nl-BE' } };
    let refreshed = 0;
    const chosen: UiLanguage[] = [];
    const applied = applyUiLanguageChoice(language, {
      market: 'be',
      supportedLanguages: ['nl', 'fr'],
      document: fakeDocument,
      secure: true,
      dispatchChosen: (value) => chosen.push(value),
      refresh: () => {
        refreshed += 1;
      },
    });
    assert.equal(applied, true);
    assert.equal(refreshed, 1, 'server tree re-rendered (router.refresh), no full redirect');
    assert.deepEqual(chosen, [language]);
    assert.equal(fakeDocument.documentElement.lang, language === 'fr' ? 'fr-BE' : 'nl-BE');
    const value = fakeDocument.cookie.split(';')[0]!.split('=');
    assert.equal(value[0], UI_LANGUAGE_COOKIE);
    const reload = resolveUiLanguage('be', value[1]);
    assert.equal(reload.language, language);
    assert.equal(reload.needsChoice, false);
    assert.equal(render(<LanguageChoiceDialog />, 'be', value[1]), '');
  }
});

test('5 header switch: .be menu offers Nederlands/Français, switching is applied and remembered', () => {
  const html = render(<LanguageSwitcher initialOpen />, 'be', 'nl');
  assert.match(html, /aria-haspopup="menu"/);
  assert.match(html, /role="menuitemradio" aria-checked="true" lang="nl" data-language="nl"/);
  assert.match(html, /role="menuitemradio" aria-checked="false" lang="fr" data-language="fr"/);
  assertNoFlags(html);
  // Switch NL -> FR -> NL: each choice rewrites the cookie.
  const fakeDocument = { cookie: '', documentElement: { lang: 'nl-BE' } };
  const env = {
    market: 'be' as const,
    supportedLanguages: ['nl', 'fr'] as const,
    document: fakeDocument,
    secure: false,
    dispatchChosen: () => undefined,
    refresh: () => undefined,
  };
  applyUiLanguageChoice('fr', env);
  assert.equal(resolveUiLanguage('be', fakeDocument.cookie.split(';')[0]!.split('=')[1]).language, 'fr');
  applyUiLanguageChoice('nl', env);
  assert.equal(resolveUiLanguage('be', fakeDocument.cookie.split(';')[0]!.split('=')[1]).language, 'nl');
  const switcher = readFileSync('components/i18n/language-switcher.tsx', 'utf8');
  assert.match(switcher, /applyLanguage\(next\)/);
});

test('6 .nl: no popup, no FR option, static globe + NL indicator, FR choice refused', () => {
  const header = render(<HomeHeader />, 'nl', 'fr');
  assert.match(header, /data-testid="language-indicator"/);
  assert.equal(header.includes('data-testid="language-switcher"'), false);
  assert.equal(header.includes('Français'), false);
  assert.equal(header.includes('aria-haspopup="menu"'), false);
  assert.match(header, /<span>NL<\/span>/);
  assert.ok(header.includes('Bestemmingen'));
  assertNoFlags(header);
  const switcherOpen = render(<LanguageSwitcher initialOpen />, 'nl');
  assert.equal(switcherOpen.includes('menuitemradio'), false);
  const fakeDocument = { cookie: '', documentElement: { lang: 'nl-NL' } };
  const applied = applyUiLanguageChoice('fr', {
    market: 'nl',
    supportedLanguages: ['nl'],
    document: fakeDocument,
    secure: true,
    dispatchChosen: () => undefined,
    refresh: () => undefined,
  });
  assert.equal(applied, false);
  assert.equal(fakeDocument.cookie, '');
});

test('8 no "Zoeken" header link (homepage header, site header, mobile drawer)', () => {
  for (const html of [render(<HomeHeader />, 'be', 'nl'), render(<ResultsSiteHeader />, 'nl')]) {
    assert.equal(/>Zoeken</.test(html), false);
    assert.equal(html.includes('href="/#hero"'), false);
    assert.equal(html.includes('href="/search"'), false);
  }
});

test('root layout: html lang follows the resolved language; banner waits for the language choice', () => {
  const layout = readFileSync('app/layout.tsx', 'utf8');
  assert.match(layout, /<html lang=\{uiLanguage\.htmlLang\}>/);
  assert.match(layout, /<LanguageChoiceDialog \/>/);
  assert.match(layout, /<CookieBanner deferUntilLanguageChosen=\{uiLanguage\.needsChoice\} \/>/);
  const banner = readFileSync('components/consent/cookie-banner.tsx', 'utf8');
  assert.match(banner, /UI_LANGUAGE_CHOSEN_EVENT/);
});

test('legal pages use the Vacation Next site header and say Dutch-only in French', () => {
  const shell = readFileSync('components/consent/legal-page-shell.tsx', 'utf8');
  assert.match(shell, /<ResultsSiteHeader \/>/);
  assert.match(shell, /dutchOnlyNotice/);
});
