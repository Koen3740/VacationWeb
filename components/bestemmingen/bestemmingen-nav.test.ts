import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd());

test('homepage and site header Bestemmingen link to /bestemmingen', () => {
  const homeHeader = readFileSync(join(ROOT, 'components/home/home-header.tsx'), 'utf8');
  const siteHeader = readFileSync(join(ROOT, 'components/results-v2/results-site-header.tsx'), 'utf8');

  assert.match(homeHeader, /label:\s*'Bestemmingen',\s*href:\s*'\/bestemmingen'/);
  assert.match(siteHeader, /label:\s*'Bestemmingen',\s*href:\s*'\/bestemmingen'/);
  assert.equal(homeHeader.includes("label: 'Bestemmingen', href: '/results'"), false);
});
