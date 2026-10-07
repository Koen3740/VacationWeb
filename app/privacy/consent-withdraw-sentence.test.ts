import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

// Privacy_Cookie_Consent v1.0 point G: the withdraw sentence must appear exactly once on
// /cookies and /privacy, directly followed by the /cookie-settings link.
const SENTENCE = 'Je kunt je toestemming altijd wijzigen of intrekken via';
const ROOT = join(__dirname, '..');

for (const page of ['cookies/page.tsx', 'privacy/page.tsx']) {
  test(`${page}: consent withdraw sentence present once, linked to /cookie-settings`, () => {
    const src = readFileSync(join(ROOT, page), 'utf8');
    assert.equal(src.split(SENTENCE).length - 1, 1);
    const after = src.slice(src.indexOf(SENTENCE), src.indexOf(SENTENCE) + 300);
    assert.match(after, /href="\/cookie-settings"[^>]*>\s*cookie-instellingen/);
    assert.doesNotMatch(src, /Pas toestemming aan via|pas keuzes aan via/);
  });
}