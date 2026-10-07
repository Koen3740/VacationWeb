import assert from 'node:assert/strict';
import test from 'node:test';
import type React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PromotionCard } from '@/lib/tradetracker/promotions/present-promotions';

// next/image validates remote hosts against the real next.config.js in non-production runs.
// Feed it the project's own images config (and fail if the config does not allow the logo).
const nextConfig = require(`${process.cwd()}/next.config.js`) as { images: Record<string, unknown> };
const { imageConfigDefault } = require('next/dist/shared/lib/image-config') as {
  imageConfigDefault: Record<string, unknown>;
};
const { ImageConfigContext } = require('next/dist/shared/lib/image-config-context.shared-runtime') as {
  ImageConfigContext: React.Context<unknown>;
};
const imagesConfig = { ...imageConfigDefault, ...nextConfig.images };

async function renderCard(overrides: Partial<PromotionCard>): Promise<string> {
  const { PromotionCardView } = await import('./promotion-card');
  return renderToStaticMarkup(
    <ImageConfigContext.Provider value={imagesConfig}>
      <PromotionCardView card={card(overrides)} lead={false} />
    </ImageConfigContext.Provider>,
  );
}

// TESTFIXTURE: card model for markup assertions. Never used outside tests.
function card(overrides: Partial<PromotionCard> = {}): PromotionCard {
  return {
    id: 'promo-0-news-1',
    providerName: 'Corendon',
    kindLabel: 'Actie',
    title: 'TESTFIXTURE Actie',
    highlight: null,
    description: null,
    periodLabel: null,
    period: null,
    conditions: null,
    publishedLabel: null,
    validToLabel: null,
    voucherCode: null,
    providerLogo: null,
    ctaLabel: 'Bekijk actie',
    links: [{ href: 'https://www.example.test/', domain: 'example.test' }],
    ...overrides,
  };
}

test('provider logo: rendered through next/image as a decorative provider mark, lazy, fixed box', async () => {
  const html = await renderCard({
    providerLogo: 'https://cdn.tradetracker.net/nl/campaign_image_square/38108.png',
  });
  assert.match(html, /<img[^>]*alt=""/);
  assert.match(html, /loading="lazy"/);
  assert.match(html, /width="44"/);
  assert.match(html, /height="44"/);
  assert.match(html, /\/_next\/image\?url=https%3A%2F%2Fcdn\.tradetracker\.net%2Fnl%2Fcampaign_image_square%2F38108\.png/);
  assert.match(html, /Deze actie wordt aangeboden door Corendon\./);
});

test('provider logo: absent logo falls back to the text monogram, no <img>', async () => {
  const html = await renderCard({});
  assert.doesNotMatch(html, /<img/);
  assert.match(html, />C<\/span>/);
});

test('next.config.js: the only TradeTracker image host is cdn.tradetracker.net, path-restricted to campaign images', () => {
  const patterns = (nextConfig.images.remotePatterns as { hostname: string; pathname?: string }[]).filter(
    (pattern) => /tradetracker/.test(pattern.hostname),
  );
  assert.deepEqual(patterns.map((pattern) => [pattern.hostname, pattern.pathname]), [
    ['cdn.tradetracker.net', '/*/campaign_image_square/**'],
  ]);
});
