import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { AanbiedingenPromotionList } from './aanbiedingen-promotion-list';
import { AanbiedingenStateMessage } from './aanbiedingen-state-message';
import { PromotionCardView } from './promotion-card';
import type { PromotionCard } from '@/lib/tradetracker/promotions/present-promotions';

// TESTFIXTURE: card models for markup assertions. Never used outside tests.
function card(overrides: Partial<PromotionCard> = {}): PromotionCard {
  return {
    id: 'promo-0-news-1',
    providerName: 'Corendon',
    kindLabel: 'Actie',
    title: 'Testactie',
    highlight: 'tot wel € 200,- extra korting',
    description: null,
    periodLabel: 'Periode',
    period: 'september en oktober',
    conditions: null,
    publishedLabel: '15 september 2026',
    validToLabel: null,
    voucherCode: null,
    providerLogo: null,
    ctaLabel: 'Bekijk actie',
    links: [{ href: 'https://referral.example.test/c?c=1&a=2&u=https%3A%2F%2Fexample.test%2F', domain: 'example.test' }],
    ...overrides,
  };
}

test('L: the card shows source text, the provider attribution and a safe external CTA', () => {
  const html = renderToStaticMarkup(<PromotionCardView card={card()} lead={false} />);
  assert.match(html, /<article[^>]*aria-labelledby="promo-0-news-1-title"/);
  assert.match(html, /<h3[^>]*id="promo-0-news-1-title"[^>]*>Testactie<\/h3>/);
  assert.match(html, /tot wel € 200,- extra korting/);
  assert.match(html, /Deze actie wordt aangeboden door Corendon\./);
  assert.match(html, /<a [^>]*href="https:\/\/referral\.example\.test\/c\?c=1&amp;a=2&amp;u=https%3A%2F%2Fexample\.test%2F"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/);
  assert.match(html, /Bekijk actie/);
  assert.match(html, /opent in een nieuw tabblad/);
  assert.doesNotMatch(html, /Boek nu/i);
  assert.doesNotMatch(html, /beste deal|top 3/i);
});

test('L: optional fields are omitted instead of rendered as placeholders', () => {
  const html = renderToStaticMarkup(
    <PromotionCardView
      card={card({ highlight: null, period: null, periodLabel: null, publishedLabel: null, links: [] })}
      lead={false}
    />,
  );
  assert.doesNotMatch(html, /<dl/);
  assert.doesNotMatch(html, /Actie<\/p>/);
  assert.doesNotMatch(html, /<a /);
  assert.doesNotMatch(html, /null|undefined/);
});

test('L: several click-out domains get one labelled CTA each', () => {
  const html = renderToStaticMarkup(
    <PromotionCardView
      card={card({
        links: [
          { href: 'https://www.corendon.be/x', domain: 'corendon.be' },
          { href: 'https://www.corendon.nl/x', domain: 'corendon.nl' },
        ],
      })}
      lead
    />,
  );
  assert.match(html, /Bekijk actie op corendon\.be/);
  assert.match(html, /Bekijk actie op corendon\.nl/);
});

test('L: the provider filter is hidden for a single provider', () => {
  const html = renderToStaticMarkup(
    <AanbiedingenPromotionList cards={[card()]} providers={[{ name: 'Corendon', count: 1 }]} />,
  );
  assert.doesNotMatch(html, /aria-pressed/);
  assert.match(html, /<ul /);
  assert.match(html, /1 aanbieding/);
});

test('L: with two providers the filter uses buttons with aria-pressed and lists no empty provider', () => {
  const cards = [card(), card({ id: 'promo-1-news-2', providerName: 'Sunweb', title: 'Tweede' })];
  const html = renderToStaticMarkup(
    <AanbiedingenPromotionList
      cards={cards}
      providers={[
        { name: 'Corendon', count: 1 },
        { name: 'Sunweb', count: 1 },
      ]}
    />,
  );
  assert.match(html, /role="group"[^>]*aria-label="Filter op aanbieder"/);
  assert.equal((html.match(/<button /g) ?? []).length, 3);
  assert.match(html, /<button[^>]*aria-pressed="true"[^>]*>[\s\S]*?Alle/);
  assert.doesNotMatch(html, /Eliza|TUI/);
  assert.match(html, /Testactie/);
  assert.match(html, /Tweede/);
});

test('L: with four or more cards the first one is the wide lead card; with fewer there is none', () => {
  const make = (n: number) =>
    renderToStaticMarkup(
      <AanbiedingenPromotionList
        cards={Array.from({ length: n }, (_, i) => card({ id: 'promo-' + i + '-x', title: 'Actie ' + i }))}
        providers={[{ name: 'Corendon', count: n }]}
      />,
    );
  assert.equal((make(4).match(/md:col-span-2/g) ?? []).length, 1);
  assert.equal((make(3).match(/md:col-span-2/g) ?? []).length, 0);
  assert.equal((make(2).match(/xl:grid-cols-3/g) ?? []).length, 0);
  assert.equal((make(3).match(/xl:grid-cols-3/g) ?? []).length, 1);
});
test('G: the empty state says so and links only to existing routes', () => {
  const html = renderToStaticMarkup(
    <AanbiedingenStateMessage
      title="Op dit moment hebben we geen actieve aanbiedingen."
      body="Kom binnenkort terug."
    />,
  );
  assert.match(html, /Op dit moment hebben we geen actieve aanbiedingen\./);
  assert.match(html, /href="\/bestemmingen"/);
  assert.match(html, /href="\/"/);
  assert.doesNotMatch(html, /privacy|cookies/i);
});
