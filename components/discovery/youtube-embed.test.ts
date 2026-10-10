import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

(globalThis as { React?: typeof React }).React = React;

import { YouTubeEmbedView } from '@/components/discovery/youtube-embed-view';
import { albanie } from '@/content/destinations/albanie';
import { canShowYoutubeEmbed, youtubeNocookieEmbedSrc } from '@/lib/discovery/youtube-embed';

const video = albanie.video;
if (!video) throw new Error('Albania video missing');

test('nocookie embed URL never autoplays', () => {
  const src = youtubeNocookieEmbedSrc(video.id);
  assert.equal(src.startsWith('https://www.youtube-nocookie.com/embed/RaNkjYE-dwM?'), true);
  assert.equal(src.includes('autoplay'), false);
  assert.equal(src.includes('youtube.com/embed'), false);
});

test('embed stays behind the marketing consent category', () => {
  assert.equal(canShowYoutubeEmbed({ analytics: true, marketing: false }, 'marketing'), false);
  assert.equal(canShowYoutubeEmbed({ analytics: false, marketing: true }, 'marketing'), true);
  assert.equal(canShowYoutubeEmbed({ analytics: false, marketing: false }, 'marketing'), false);
});

test('no iframe before consent', () => {
  const html = renderToStaticMarkup(createElement(YouTubeEmbedView, { video, allowed: false }));
  assert.equal(html.includes('<iframe'), false);
  assert.equal(html.includes('youtube-nocookie'), false);
  assert.equal(html.includes('ytimg.com'), false);
  assert.match(html, /Deze video eet alleen cookies/);
  assert.match(html, /Ja, smakelijk!/);
  assert.match(html, /Bekijk op YouTube/);
  assert.match(html, /youtube\.com\/shorts\/RaNkjYE-dwM/);
});

test('iframe loads from youtube-nocookie only after consent', () => {
  const html = renderToStaticMarkup(createElement(YouTubeEmbedView, { video, allowed: true }));
  assert.match(html, /<iframe/);
  assert.match(html, /src="https:\/\/www\.youtube-nocookie\.com\/embed\/RaNkjYE-dwM\?/);
  assert.equal(html.includes('autoplay'), false);
  assert.equal(html.includes('Ja, smakelijk'), false);
});

test('accepting the video uses the existing consent API', () => {
  const source = readFileSync(new URL('./youtube-consent-embed.tsx', import.meta.url), 'utf8');
  assert.match(source, /setCookiePreferences/);
  assert.match(source, /getCookieConsent/);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('youtube.com/embed'), false);
});
