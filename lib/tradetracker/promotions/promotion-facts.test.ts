import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanFactText, extractPromotionFacts } from './promotion-facts';

// TESTFIXTURE: text copied from a real TradeTracker campaign-news item
// (Corendon NL, newsItemId 322951, captured 2026-10-04). Test data only.
const CORENDON_NEWS_CONTENT = [
  'Corendon NL heeft een nieuwe actie: <b>Kaching: extra voordelige vakantiedeals</b>.',
  '',
  'Actie: <b>tot wel € 200,- extra korting,  daarbovenop tot € 100,- kidskorting per kind, ook tijdens de herfstvakantie!</b>',
  'Periode: september en oktober',
  'Landingspagina: <a href="https://www.corendon.nl/kaching">Kaching: extra voordelige vakantiedeals</a>',
  '',
  'Promoot deze actie prominent op jouw website om jouw conversies te verhogen. ',
].join('\n');

test('extracts the labelled Actie and Periode lines verbatim', () => {
  const facts = extractPromotionFacts(CORENDON_NEWS_CONTENT);
  assert.equal(
    facts.highlight,
    'tot wel € 200,- extra korting, daarbovenop tot € 100,- kidskorting per kind, ook tijdens de herfstvakantie!',
  );
  assert.equal(facts.periodLabel, 'Periode');
  assert.equal(facts.period, 'september en oktober');
  assert.equal(facts.conditions, null);
});

test('never surfaces affiliate-facing boilerplate or the landing-page line', () => {
  const facts = extractPromotionFacts(CORENDON_NEWS_CONTENT);
  const all = JSON.stringify(facts);
  assert.doesNotMatch(all, /conversies/i);
  assert.doesNotMatch(all, /prominent/i);
  assert.doesNotMatch(all, /Landingspagina/i);
});

test('returns nulls (no invented discount or date) when the source has no labelled lines', () => {
  const facts = extractPromotionFacts('Corendon heeft een update over een hotel. Veel plezier!');
  assert.deepEqual(facts, { highlight: null, periodLabel: null, period: null, conditions: null });
  assert.deepEqual(extractPromotionFacts(''), {
    highlight: null,
    periodLabel: null,
    period: null,
    conditions: null,
  });
  assert.deepEqual(extractPromotionFacts(null), {
    highlight: null,
    periodLabel: null,
    period: null,
    conditions: null,
  });
});

test('uses the period label priority and keeps the source label', () => {
  const facts = extractPromotionFacts(
    ['Actie: 10% korting', 'Vertrekperiode: 01-11-2026 tot en met 31-03-2027', 'Geldigheid: boek voor 31 oktober'].join('\n'),
  );
  assert.equal(facts.periodLabel, 'Geldigheid');
  assert.equal(facts.period, 'boek voor 31 oktober');
});

test('reads conditions from Voorwaarden / Bijzonderheden', () => {
  assert.equal(
    extractPromotionFacts('Actie: x\nVoorwaarden: minimaal 7 nachten').conditions,
    'minimaal 7 nachten',
  );
  assert.equal(
    extractPromotionFacts('Actie: x<br/>Bijzonderheden: alleen online').conditions,
    'alleen online',
  );
});

test('decodes entities and strips markup without changing the wording', () => {
  const facts = extractPromotionFacts('Actie: <b>Wonen &amp; Slapen</b> &euro; 5 korting\nPeriode: &lt;oktober&gt;');
  assert.equal(facts.highlight, 'Wonen & Slapen \u20AC 5 korting');
  assert.equal(facts.period, '<oktober>');
});

test('shortens very long values at a word boundary', () => {
  const long = `Actie: ${'korting '.repeat(80)}`;
  const facts = extractPromotionFacts(long);
  assert.ok(facts.highlight);
  assert.ok(facts.highlight!.length <= 301);
  assert.ok(facts.highlight!.endsWith('\u2026'));
  assert.equal(cleanFactText('   ', 10), null);
  assert.equal(cleanFactText(null, 10), null);
});
