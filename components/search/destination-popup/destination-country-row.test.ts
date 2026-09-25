import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import React, { createElement } from 'react';
import { DestinationCountryRow } from '@/components/search/destination-popup/destination-country-row';

// tsx runs .tsx with the classic JSX runtime (tsconfig jsx: preserve); the row file has no React import.
(globalThis as { React?: typeof React }).React ??= React;

/**
 * Regression: the visually hidden checkbox (`sr-only` = position:absolute) must be
 * positioned inside its own row. Without a positioned row, its containing block is the
 * `overflow-hidden` popup dialog; focusing the checkbox of a row far down the
 * "Alle bestemmingen" list scrolled that dialog and left an empty white panel.
 */
function renderRow(selected: boolean): string {
  return renderToStaticMarkup(
    createElement(DestinationCountryRow, {
      country: { name: 'Portugal', count: 3 },
      selected,
      onToggle: () => {},
    }),
  );
}

test('destination row: sr-only checkbox is contained by a positioned (relative) label', () => {
  for (const selected of [false, true]) {
    const html = renderRow(selected);
    const label = html.match(/^<label class="([^"]*)"/);
    assert.ok(label, 'row root is a <label>');
    assert.ok(label[1].split(/\s+/).includes('relative'), `label must be relative, got: ${label[1]}`);
    assert.match(html, /<input type="checkbox"[^>]*class="sr-only"/);
    assert.match(html, />Portugal</);
  }
});