import assert from 'node:assert/strict';
import test from 'node:test';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DurationPopupPanel } from './duration-popup';
import { durationDraftFromApplied } from './duration-popup-utils';

const noop = () => {};

function markup(selected: number[]): string {
  return renderToStaticMarkup(
    createElement(DurationPopupPanel, {
      draft: durationDraftFromApplied(selected),
      onClose: noop,
      onToggleChip: noop,
      onToggleCustom: noop,
      onStepCustom: noop,
      onClear: noop,
      onSave: noop,
    }),
  );
}

function openTag(html: string, testId: string): string {
  const match = html.match(new RegExp(`<button\\b(?=[^>]*data-testid="${testId}")[^>]*>`));
  assert.ok(match, testId);
  return match[0];
}

test('opening with no duration shows 8 filled navy and hides the custom stepper', () => {
  const html = markup([]);
  const eight = openTag(html, 'duration-chip-8');
  const fifteen = openTag(html, 'duration-chip-15');
  assert.match(eight, /aria-pressed="true"/);
  assert.match(eight, /bg-vw-navy/);
  assert.match(eight, /min-h-12/);
  assert.match(fifteen, /aria-pressed="false"/);
  assert.equal(html.includes('duration-custom-stepper'), false);
  assert.equal(html.includes('role="tablist"'), false);
  assert.equal(html.includes('Exact'), false);
  assert.equal(html.includes('Flexibel'), false);
  assert.match(html, /Ander aantal/);
  assert.match(html, />8 dagen</);
});

test('several applied durations press every matching chip', () => {
  const html = markup([8, 15]);
  assert.match(openTag(html, 'duration-chip-8'), /aria-pressed="true"/);
  assert.match(openTag(html, 'duration-chip-15'), /aria-pressed="true"/);
  assert.match(openTag(html, 'duration-chip-3-4'), /aria-pressed="false"/);
  assert.match(html, />8, 15 dagen</);
});

test('a custom day shows the 2-32 stepper with 44px controls', () => {
  const html = markup([9]);
  const custom = openTag(html, 'duration-custom');
  assert.match(custom, /aria-pressed="true"/);
  assert.match(custom, /bg-vw-navy/);
  assert.match(html, /data-testid="duration-custom-stepper"/);
  assert.match(openTag(html, 'duration-custom-dec'), /h-11 w-11/);
  assert.match(openTag(html, 'duration-custom-inc'), /h-11 w-11/);
  assert.match(html, /data-testid="duration-custom-value"[^>]*>9/);
});
