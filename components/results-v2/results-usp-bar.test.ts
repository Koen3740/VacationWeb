import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ResultsUspBar } from '@/components/results-v2/results-usp-bar';

const REMOVED = [
  'Betrouwbare partners en veilige betaling',
  '24/7 ondersteuning voor en na je reis',
] as const;

test('Results USP bar drops the two claims VacationWeb does not make', () => {
  const html = renderToStaticMarkup(createElement(ResultsUspBar, { variant: 'results' }));
  for (const claim of REMOVED) {
    assert.equal(html.includes(claim), false, claim);
  }
  assert.match(html, /Meer vakantie voor jouw budget/);
  assert.match(html, /Geselecteerd op prijs-kwaliteit/);
  assert.match(html, /data-testid="results-usp-bar"/);
});

test('/results uses the results USP variant and shows the trip summary', () => {
  const page = readFileSync('components/results-v2/results-page-client.tsx', 'utf8');
  const route = readFileSync('app/results/page.tsx', 'utf8');
  assert.match(page, /ResultsUspBar variant="results"/);
  assert.match(page, /data-testid="results-trip-summary"/);
  assert.match(page, /ResultsActiveFilters/);
  assert.match(route, /buildResultsTripSummary/);
  assert.match(route, /tripSummary: buildResultsTripSummary/);
  for (const claim of REMOVED) {
    assert.equal(page.includes(claim), false, claim);
  }
});

test('other pages keep the existing USP bar unless they opt into results', () => {
  const html = renderToStaticMarkup(createElement(ResultsUspBar));
  assert.match(html, /Betrouwbare partners en veilige betaling/);
  assert.match(html, /24\/7 ondersteuning voor en na je reis/);
  const offers = readFileSync('app/aanbiedingen/page.tsx', 'utf8');
  assert.match(offers, /<ResultsUspBar \/>/);
  assert.doesNotMatch(offers, /variant="results"/);
});
