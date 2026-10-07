import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SITE_NAV_ITEMS } from '../../lib/site/site-nav';

const ROOT = join(process.cwd());

test('homepage and site header Bestemmingen link to /bestemmingen', () => {
  const homeHeader = readFileSync(join(ROOT, 'components/home/home-header.tsx'), 'utf8');
  const siteHeader = readFileSync(join(ROOT, 'components/results-v2/results-site-header.tsx'), 'utf8');

  // t66u: both headers render the shared nav list.
  assert.equal(SITE_NAV_ITEMS.find((item) => item.key === 'destinations')?.href, '/bestemmingen');
  assert.match(homeHeader, /SITE_NAV_ITEMS/);
  assert.match(siteHeader, /SITE_NAV_ITEMS/);
  assert.equal(SITE_NAV_ITEMS.some((item) => item.key === 'destinations' && item.href === '/results'), false);
});
