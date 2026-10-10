import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { CHROME_COPY } from '@/lib/i18n/chrome-copy';
import { SITE_NAV_ITEMS } from '@/lib/site/site-nav';

/** Homepage section ids rendered by app/page.tsx (anchor targets). */
const HOME_ANCHORS: Record<string, { component: string; tag: string }> = {
  ontdekt: { component: 'components/home/home-discover-teaser.tsx', tag: '<HomeDiscoverTeaser' },
  inspiratie: { component: 'components/home/home-inspiration-band.tsx', tag: '<HomeInspirationBand' },
  value: { component: 'components/home/home-value-section.tsx', tag: '<HomeValueSection' },
  hero: { component: 'components/home/home-hero.tsx', tag: '<HomeHero' },
};

function assertLinkTargetExists(href: string) {
  const [path, anchor] = href.split('#');
  const route = path === '/' || path === '' ? '' : path!.replace(/^\//, '');
  assert.ok(existsSync(join('app', route, 'page.tsx')), `route exists for ${href}`);
  if (anchor) {
    assert.equal(route, '', `anchors only on the homepage (${href})`);
    const target = HOME_ANCHORS[anchor];
    assert.ok(target, `known homepage anchor ${href}`);
    assert.ok(readFileSync(target.component, 'utf8').includes(`id="${anchor}"`), `id="${anchor}" present`);
    assert.ok(readFileSync('app/page.tsx', 'utf8').includes(target.tag), `${target.tag} rendered on /`);
  }
}

test('9 header links go to their intended Vacation Next routes', () => {
  assert.deepEqual(
    SITE_NAV_ITEMS.map((item) => [item.key, item.href]),
    [
      ['discover', '/ontdek'],
      ['destinations', '/bestemmingen'],
      ['inspiration', '/#inspiratie'],
      ['offers', '/aanbiedingen'],
      ['about', '/#value'],
    ],
  );
  for (const language of ['nl', 'fr'] as const) {
    for (const item of SITE_NAV_ITEMS) {
      assert.ok(CHROME_COPY[language].nav[item.key], `${language} label for ${item.key}`);
    }
  }
  // Both headers use the shared list (no divergent per-page nav).
  for (const file of ['components/home/home-header.tsx', 'components/results-v2/results-site-header.tsx']) {
    const source = readFileSync(file, 'utf8');
    assert.match(source, /SITE_NAV_ITEMS/, file);
    assert.equal(/label:\s*'/.test(source), false, `${file}: no hard-coded nav labels`);
  }
});

test('8 no "Zoeken" entry and no legacy /search destination in the navigation', () => {
  assert.equal(SITE_NAV_ITEMS.some((item) => item.href === '/#hero' || item.href.startsWith('/search')), false);
  for (const language of ['nl', 'fr'] as const) {
    const labels = Object.values(CHROME_COPY[language].nav);
    assert.equal(labels.some((label) => /^(Zoeken|Rechercher)$/i.test(label)), false);
  }
});

test('10 no dead links: nav, footer and legal sub-nav targets exist', () => {
  for (const item of SITE_NAV_ITEMS) {
    assertLinkTargetExists(item.href);
  }
  for (const href of ['/favorieten', '/privacy', '/cookies', '/cookie-settings', '/#value', '/#inspiratie']) {
    assertLinkTargetExists(href);
  }
  // Empty states no longer send users to the legacy /search page.
  // No-results links back to the homepage search. The 150-result cap keeps the
  // exact two-sentence copy and has no extra link.
  for (const file of ['components/results/no-results.tsx', 'components/results/results-refinement-required.tsx']) {
    assert.equal(readFileSync(file, 'utf8').includes('href="/search"'), false, file);
  }
  assert.match(readFileSync('components/results/no-results.tsx', 'utf8'), /href="\/#hero"/);
  // No component in the site chrome links to /search anymore.
  for (const file of [
    'components/home/home-header.tsx',
    'components/results-v2/results-site-header.tsx',
    'components/home/home-footer.tsx',
    'components/consent/legal-page-shell.tsx',
  ]) {
    assert.equal(readFileSync(file, 'utf8').includes("'/search'"), false, file);
  }
});

test('/search stays a working route (kept for direct URLs) but is not indexed', () => {
  const page = readFileSync('app/search/page.tsx', 'utf8');
  assert.match(page, /<SearchForm/);
  assert.match(page, /robots: \{ index: false, follow: true \}/);
});
