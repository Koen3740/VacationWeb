import assert from 'node:assert/strict';
import test from 'node:test';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

(globalThis as { React?: typeof React }).React = React;

import { DiscoveryMagazine } from '@/components/discovery/discovery-magazine';
import { DestinationLongread } from '@/components/discovery/destination-longread';
import { DESTINATIONS } from '@/content/destinations';
import { buildDestinationView, buildMagazine } from '@/lib/discovery/model';

test('discovery has no Video filter chip and still labels cards that have a video', () => {
  const html = renderToStaticMarkup(createElement(DiscoveryMagazine, { magazine: buildMagazine(DESTINATIONS) }));
  const buttons = [...html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)].map((match) =>
    match[1].replace(/<[^>]+>/g, '').trim(),
  );
  assert.deepEqual(buttons.filter((label) => label === 'Video'), []);
  assert.ok(buttons.includes('Alles'));
  assert.ok(buttons.includes('Nieuw'));
  assert.match(html, /<span[^>]*>[\s\S]*?Video<\/span>/);
});

test('longread body is magazine size and the intro lead stays slightly larger', () => {
  const albania = DESTINATIONS.find((doc) => doc.slug === 'albanie');
  assert.ok(albania);
  const view = buildDestinationView(albania, DESTINATIONS);
  assert.ok(view);
  const html = renderToStaticMarkup(createElement(DestinationLongread, { view }));
  assert.match(html, /text-\[19px\][^"]*leading-\[1\.6\][^"]*min-\[901px\]:text-\[20px\]/);
  assert.match(html, /first-letter:text-\[2\.75em\]/);
  assert.match(html, /text-\[16px\] leading-\[1\.6\] text-\[#26324a\] min-\[901px\]:text-\[17px\]/);
  assert.equal(html.includes('min-[901px]:text-[clamp(21px,2vw,26px)]'), false);
  assert.equal(html.includes('min-[901px]:text-[19px]'), false);
});
