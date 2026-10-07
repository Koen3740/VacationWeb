import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { CHROME_COPY } from '@/lib/i18n/chrome-copy';
import {
  buildUiLanguageCookie,
  parseUiLanguage,
  resolveUiLanguage,
  supportedUiLanguages,
  UI_LANGUAGE_COOKIE,
  UI_LANGUAGE_COOKIE_MAX_AGE_SECONDS,
} from '@/lib/i18n/ui-language';
import { attachSiteMarket, resolveSiteMarketFromHost } from '@/lib/search/site-market';

/** Value the browser would send back for our cookie string (name=value before the first ';'). */
function cookieValueFrom(setCookie: string): string | undefined {
  const [pair] = setCookie.split(';');
  const [name, value] = (pair ?? '').split('=');
  return name === UI_LANGUAGE_COOKIE ? value : undefined;
}

test('.be first visit: no remembered choice -> popup needed, Dutch until chosen, nl-BE', () => {
  const state = resolveUiLanguage('be', undefined);
  assert.equal(state.needsChoice, true);
  assert.equal(state.language, 'nl');
  assert.deepEqual([...state.supportedLanguages], ['nl', 'fr']);
  assert.equal(state.htmlLang, 'nl-BE');
});

test('.be NL chosen: Dutch, no popup', () => {
  const state = resolveUiLanguage('be', 'nl');
  assert.equal(state.language, 'nl');
  assert.equal(state.needsChoice, false);
  assert.equal(state.htmlLang, 'nl-BE');
});

test('.be FR chosen: French, no popup, fr-BE, market stays BE', () => {
  const state = resolveUiLanguage('be', 'fr');
  assert.equal(state.language, 'fr');
  assert.equal(state.needsChoice, false);
  assert.equal(state.htmlLang, 'fr-BE');
  assert.equal(state.market, 'be');
});

test('choice persists across reload / next session (cookie round trip, 12 months)', () => {
  for (const language of ['nl', 'fr'] as const) {
    const setCookie = buildUiLanguageCookie(language, true);
    assert.match(setCookie, new RegExp(`^${UI_LANGUAGE_COOKIE}=${language}; `));
    assert.match(setCookie, /Path=\//);
    assert.match(setCookie, new RegExp(`Max-Age=${UI_LANGUAGE_COOKIE_MAX_AGE_SECONDS}`));
    assert.equal(UI_LANGUAGE_COOKIE_MAX_AGE_SECONDS, 31_536_000);
    assert.match(setCookie, /SameSite=Lax/);
    assert.match(setCookie, /Secure/);
    const reloaded = resolveUiLanguage('be', cookieValueFrom(setCookie));
    assert.equal(reloaded.language, language);
    assert.equal(reloaded.needsChoice, false);
  }
  assert.equal(buildUiLanguageCookie('fr', false).includes('Secure'), false);
});

test('.nl: Dutch only, no popup, a stale fr cookie is ignored', () => {
  for (const cookie of [undefined, 'nl', 'fr']) {
    const state = resolveUiLanguage('nl', cookie);
    assert.equal(state.language, 'nl');
    assert.equal(state.needsChoice, false);
    assert.deepEqual([...state.supportedLanguages], ['nl']);
    assert.equal(state.htmlLang, 'nl-NL');
  }
  assert.deepEqual([...supportedUiLanguages('nl')], ['nl']);
});

test('hosts without market (localhost/previews): Dutch, no popup', () => {
  const state = resolveUiLanguage(undefined, 'fr');
  assert.equal(state.language, 'nl');
  assert.equal(state.needsChoice, false);
  assert.equal(state.htmlLang, 'nl');
});

test('invalid cookie values never select a language', () => {
  assert.equal(parseUiLanguage('de'), undefined);
  assert.equal(parseUiLanguage(''), undefined);
  assert.equal(parseUiLanguage(' FR '), 'fr');
  assert.equal(resolveUiLanguage('be', 'en').needsChoice, true);
});

test('market isolation: the domain decides the market; language never changes it', () => {
  assert.equal(resolveSiteMarketFromHost('www.vacationweb.be'), 'be');
  assert.equal(resolveSiteMarketFromHost('www.vacationweb.nl'), 'nl');
  assert.deepEqual(attachSiteMarket({}, 'www.vacationweb.be'), { siteMarket: 'be' });
  assert.equal(resolveUiLanguage('be', 'fr').market, 'be');
  assert.equal(resolveUiLanguage('nl', 'fr').market, 'nl');
  const request = readFileSync('lib/i18n/request-ui-language.ts', 'utf8');
  assert.match(request, /requestSiteMarket\(\)/);
  // No IP / geo / browser-locale based choice, no redirects.
  for (const source of [request, readFileSync('lib/i18n/ui-language.ts', 'utf8')]) {
    assert.equal(/accept-language|x-vercel-ip|geo|redirect\(/i.test(source), false);
  }
  // Search/inventory code does not depend on the UI language.
  for (const file of ['lib/search/site-market.ts', 'lib/search/market-inventory.ts', 'lib/search/request-site-market.ts']) {
    assert.equal(readFileSync(file, 'utf8').includes('i18n'), false, file);
  }
});

test('dictionary: NL and FR define the same chrome keys; popup title is bilingual', () => {
  const keys = (value: object): string[] =>
    Object.entries(value).flatMap(([key, child]) =>
      child && typeof child === 'object' && !Array.isArray(child) && key !== 'countryNames' && key !== 'blurbs'
        ? keys(child).map((sub) => `${key}.${sub}`)
        : [key],
    );
  assert.deepEqual(keys(CHROME_COPY.fr).sort(), keys(CHROME_COPY.nl).sort());
  assert.equal(CHROME_COPY.nl.languageDialog.title, 'Kies je taal / Choisissez votre langue');
  assert.equal(CHROME_COPY.fr.languageDialog.title, 'Kies je taal / Choisissez votre langue');
  assert.equal(CHROME_COPY.fr.trust.items.length, CHROME_COPY.nl.trust.items.length);
  assert.equal(CHROME_COPY.fr.value.points.length, CHROME_COPY.nl.value.points.length);
  assert.equal(CHROME_COPY.fr.search.countries(3), '3 pays');
  assert.equal(CHROME_COPY.nl.search.countries(3), '3 landen');
});
