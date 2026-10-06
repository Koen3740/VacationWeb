import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';

/**
 * t361u privacy closure: private search routes (noindex + no-store), Favorites stay browser-only,
 * and the privacy/cookie pages keep their fact-based wording and OWNER/LEGAL placeholders.
 */
const require = createRequire(import.meta.url);

type HeaderRule = { source: string; headers: { key: string; value: string }[] };

const resultsPage = readFileSync('app/results/page.tsx', 'utf8');
const offerPage = readFileSync('app/offers/[id]/page.tsx', 'utf8');
const robotsSource = readFileSync('app/robots.ts', 'utf8');
const privacyPage = readFileSync('app/privacy/page.tsx', 'utf8');
const cookiesPage = readFileSync('app/cookies/page.tsx', 'utf8');

test('t361u: /results and /offers/[id] declare robots noindex + nofollow in metadata', () => {
  for (const source of [resultsPage, offerPage]) {
    assert.ok(source.includes('export const metadata: Metadata'));
    assert.ok(source.includes('robots: { index: false, follow: false }'));
  }
});

test('t361u: next.config headers set no-store + X-Robots-Tag only for the two private routes', async () => {
  const config = require('../../next.config.js') as { headers?: () => Promise<HeaderRule[]> };
  assert.equal(typeof config.headers, 'function');
  const rules = await config.headers!();
  assert.deepEqual(
    rules.map((rule) => rule.source),
    ['/results', '/offers/:path+'],
  );
  for (const rule of rules) {
    const byKey = new Map(rule.headers.map((header) => [header.key, header.value]));
    assert.equal(byKey.get('Cache-Control'), 'no-store');
    assert.equal(byKey.get('X-Robots-Tag'), 'noindex, nofollow');
  }
});

test('t361u: robots.txt does not Disallow the private routes (crawler must see the noindex)', () => {
  assert.ok(!robotsSource.includes("'/results'"));
  assert.ok(!robotsSource.includes("'/offers"));
});

test('t361u: Favorites code stays browser-only (no network, no cookies)', () => {
  const files = [
    ...readdirSync('lib/favorites').filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts')).map((name) => `lib/favorites/${name}`),
    ...readdirSync('components/favorites').filter((name) => /\.tsx?$/.test(name) && !name.includes('.test.')).map((name) => `components/favorites/${name}`),
  ];
  assert.ok(files.length > 0);
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    assert.ok(!/\bfetch\s*\(|XMLHttpRequest|sendBeacon|document\.cookie|WebSocket/.test(source), file);
  }
  assert.ok(readFileSync('lib/favorites/favorites-storage.ts', 'utf8').includes("'vacationweb.favorites.v1'"));
});

test('t361u: privacy page states child ages in the search URL and drops the misleading hash wording', () => {
  assert.ok(privacyPage.includes('childAges='));
  assert.ok(privacyPage.includes('zoek-URL'));
  assert.ok(!privacyPage.includes('gehashte waarde'));
  assert.ok(!privacyPage.includes('Geboortedata van reizigers'));
  assert.ok(privacyPage.includes('synthetische geboortedatum'));
  assert.ok(privacyPage.includes('Dat is niet de geboortedatum van een reiziger.'));
});

test('t361u: privacy page keeps OWNER/LEGAL placeholders and invents no identity or contact', () => {
  for (const label of ['juridische naam', 'adres', 'privacy-email', 'DPO', 'affiliate/TradeTracker transparantie', 'kwalificatie vacationweb.favorites.v1']) {
    assert.ok(privacyPage.includes(`label="${label}"`), label);
  }
  assert.ok(!/info@vacationweb/i.test(privacyPage + cookiesPage));
  assert.ok(!/gerechtvaardigd belang|artikel 6|art\. 6/i.test(privacyPage + cookiesPage), 'no legal basis presented as settled');
});

test('t361u: cookies page documents Favorites as browser-only and leaves the qualification OPEN', () => {
  assert.ok(cookiesPage.includes('vacationweb.favorites.v1'));
  assert.ok(cookiesPage.includes('Favorieten worden alleen in je browser opgeslagen.'));
  assert.ok(cookiesPage.includes('niet gekoppeld aan een VacationWeb-account'));
  assert.ok(cookiesPage.includes('totdat je ze verwijdert of je browsergegevens wist'));
  assert.ok(cookiesPage.includes('OWNER/LEGAL INPUT OPEN'));
  assert.ok(cookiesPage.includes('label="partnercookie-gedrag na clickout"'));
});