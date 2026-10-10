import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const REMOVED = ['Transparante prijzen', 'Geen verborgen kosten', 'Waarom VacationWeb'] as const;

test('/results sidebar does not render the Waarom VacationWeb card', () => {
  const sidebar = readFileSync('components/results/filter-sidebar.tsx', 'utf8');
  const page = readFileSync('app/results/page.tsx', 'utf8');
  assert.match(page, /<FilterSidebar/);
  assert.equal(sidebar.includes('ResultsWhyCard'), false);
  for (const claim of REMOVED) {
    assert.equal(sidebar.includes(claim), false, claim);
  }
});
