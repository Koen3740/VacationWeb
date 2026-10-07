import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { ResultsMobileNav } from './results-mobile-nav';

const LINKS = [
  { label: 'Bestemmingen', href: '/bestemmingen' },
  { label: 'Aanbiedingen', href: '/aanbiedingen' },
] as const;

test('mobile nav: closed state is a collapsed, labelled disclosure button that is hidden from lg up', () => {
  const html = renderToStaticMarkup(<ResultsMobileNav links={LINKS} />);
  assert.match(html, /<button[^>]*type="button"/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /aria-controls="results-mobile-nav-panel"/);
  assert.match(html, /aria-label="Menu"/);
  assert.match(html, /class="lg:hidden"/);
  // The panel (and its links) exist only while open, so there is no duplicate nav landmark.
  assert.doesNotMatch(html, /<nav/);
});

test('header: desktop nav stays lg-only and the mobile nav receives the same links plus the shared route targets', () => {
  const header = readFileSync('components/results-v2/results-site-header.tsx', 'utf8');
  assert.match(header, /hidden items-center gap-7 lg:flex/);
  assert.match(header, /<ResultsMobileNav links=\{NAV_LINKS\}/);
  assert.match(header, /href: '\/aanbiedingen'/);
  assert.match(header, /<header className="relative /);
});

test('labels: the home header and footer call the /aanbiedingen route "Aanbiedingen"', () => {
  for (const file of ['components/home/home-header.tsx', 'components/home/home-footer.tsx']) {
    const source = readFileSync(file, 'utf8');
    assert.match(source, /label:\s*'Aanbiedingen',\s*href:\s*'\/aanbiedingen'/, file);
    assert.doesNotMatch(source, /label:\s*'Aanbod'/, file);
  }
});
