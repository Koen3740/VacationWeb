import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { evaluateOfferBenefit, isDisplayableOffer } from './displayable-offer';
import type { TradeTrackerCreativeSnapshot } from './types';

test('structured discount or voucher is a displayable offer and the source text is kept', () => {
  const discount = evaluateOfferBenefit({ name: 'Banner5', discountFixed: '25' });
  assert.equal(discount.outcome, 'displayable');
  assert.equal(discount.benefitText, '25');
  assert.equal(isDisplayableOffer({ title: 'Banner5', discountVariable: '10%' }), true);
  assert.equal(evaluateOfferBenefit({ title: 'Banner5', discountVariable: '10%' }).benefitText, '10%');
  assert.equal(evaluateOfferBenefit({ name: 'Banner5', voucherCode: 'ZOMER' }).benefitText, 'ZOMER');
  assert.equal(
    evaluateOfferBenefit({ discountFixed: '€ 50', voucherCode: 'ZOMER' }).benefitText,
    '€ 50 · ZOMER',
  );
  assert.equal(evaluateOfferBenefit({ name: 'Banner5', discountFixed: 'tot €600' }).benefitText, 'tot €600');
});

test('a concrete amount in the source is kept and a bare promo word is not an offer', () => {
  assert.equal(evaluateOfferBenefit({ name: 'Banner1-lastminute' }).outcome, 'excluded');
  assert.equal(evaluateOfferBenefit({ name: 'Banner1-lastminute' }).benefitText, null);
  assert.equal(evaluateOfferBenefit({ title: 'Last-Minute' }).outcome, 'excluded');
  assert.equal(evaluateOfferBenefit({ description: 'Last minute naar Turkije' }).outcome, 'excluded');
  assert.equal(evaluateOfferBenefit({ description: 'Boek nu' }).outcome, 'excluded');
  assert.equal(evaluateOfferBenefit({ summary: 'Early booking voor mei' }).outcome, 'excluded');
  assert.equal(evaluateOfferBenefit({ description: 'vroegboek' }).outcome, 'excluded');
  assert.equal(evaluateOfferBenefit({ name: 'summer discount' }).outcome, 'excluded');
  assert.equal(evaluateOfferBenefit({ name: 'Banner-lastminute', description: 'extra korting' }).outcome, 'excluded');
  assert.equal(evaluateOfferBenefit({ conditions: '10% korting op een selectie' }).outcome, 'displayable');
  assert.equal(evaluateOfferBenefit({ conditions: '10% korting op een selectie' }).benefitText, '10%');
  assert.equal(evaluateOfferBenefit({ description: 'tot € 200 extra korting' }).benefitText, '€ 200');
  assert.equal(evaluateOfferBenefit({ title: 'Tot €600 extra korting' }).benefitText, '€600');
  assert.equal(isDisplayableOffer({ name: 'Banner1-lastminute' }), false);
});

test('Kaching is excluded even when the Corendon news states an amount', () => {
  const decision = evaluateOfferBenefit({
    title: 'Kaching: extra voordelige vakantiedeals',
    description: 'Corendon NL heeft een nieuwe actie: Kaching. Actie: tot wel € 200,- extra korting, daarbovenop tot € 100,- kidskorting.',
  });
  assert.equal(decision.outcome, 'excluded');
  assert.equal(decision.benefitText, null);
  assert.equal(isDisplayableOffer({ title: 'Kaching: extra voordelige cruisedeals', description: 'tot wel € 200,- extra korting' }), false);
});

test('L: a named free benefit is an offer and a bare gratis is not', () => {
  assert.equal(evaluateOfferBenefit({ description: '1 kind gratis bij deze reis' }).outcome, 'displayable');
  assert.equal(evaluateOfferBenefit({ description: '1 kind gratis bij deze reis' }).benefitText, '1 kind gratis');
  assert.equal(evaluateOfferBenefit({ description: 'één kindje gratis' }).benefitText, 'één kindje gratis');
  assert.equal(evaluateOfferBenefit({ title: '2e persoon gratis' }).outcome, 'displayable');
  assert.equal(evaluateOfferBenefit({ summary: 'gratis bagage' }).benefitText, 'gratis bagage');
  assert.equal(evaluateOfferBenefit({ conditions: 'transfer gratis' }).benefitText, 'transfer gratis');
  assert.equal(evaluateOfferBenefit({ description: 'gratis' }).outcome, 'excluded');
  assert.equal(evaluateOfferBenefit({ title: 'Ontdek Corendon' }).outcome, 'excluded');
  assert.equal(evaluateOfferBenefit({ title: 'Boek nu' }).outcome, 'excluded');
  assert.equal(isDisplayableOffer({ description: '1 kind gratis' }), true);
  assert.equal(isDisplayableOffer({ description: 'gratis' }), false);
});

test('generic ads and doubtful compounds are not offers', () => {
  for (const name of ['Banner5', 'Banner 12', 'Banner-12', 'Zonvakantie deze zomer', 'Nazomeractie']) {
    const decision = evaluateOfferBenefit({ name });
    assert.equal(decision.outcome, 'excluded', name);
    assert.equal(decision.benefitText, null);
    assert.equal(isDisplayableOffer({ name }), false);
  }
  assert.equal(evaluateOfferBenefit({ name: 'kortingsactie' }).outcome, 'doubt');
  assert.equal(evaluateOfferBenefit({ name: 'lastminutedeal' }).outcome, 'doubt');
  assert.equal(evaluateOfferBenefit({ name: 'vroegboekkorting' }).outcome, 'doubt');
  assert.equal(isDisplayableOffer({ name: 'kortingsactie' }), false);
  assert.equal(evaluateOfferBenefit({ discountFixed: '0' }).outcome, 'excluded');
  assert.equal(evaluateOfferBenefit({ discountFixed: '€0,00' }).outcome, 'excluded');
  assert.equal(evaluateOfferBenefit({ voucherCode: ' ' }).outcome, 'excluded');
  assert.equal(isDisplayableOffer({}), false);
});

test('this snapshot has no amount-backed offers: the 9 BE lastminute banners are excluded', (t) => {
  const dir = path.join(process.cwd(), 'data', 'tradetracker-creatives');
  const nlPath = path.join(dir, 'snapshot-nl-512226.json');
  const bePath = path.join(dir, 'snapshot-be-511873.json');
  if (!fs.existsSync(nlPath) || !fs.existsSync(bePath)) {
    t.skip('Slice 1 snapshots are gitignored and are not in this checkout');
    return;
  }
  const nl = JSON.parse(fs.readFileSync(nlPath, 'utf8')) as TradeTrackerCreativeSnapshot;
  const be = JSON.parse(fs.readFileSync(bePath, 'utf8')) as TradeTrackerCreativeSnapshot;
  const rows = [
    ...nl.creatives.map((creative) => ({ market: 'nl' as const, creative })),
    ...be.creatives.map((creative) => ({ market: 'be' as const, creative })),
  ];
  const counts = { displayable: 0, excluded: 0, doubt: 0, nl: 0, be: 0 };
  const ids: string[] = [];
  for (const row of rows) {
    const decision = evaluateOfferBenefit({
      name: row.creative.name,
      description: row.creative.description,
      conditions: row.creative.conditions,
      discountFixed: row.creative.discountFixed,
      discountVariable: row.creative.discountVariable,
      voucherCode: row.creative.voucherCode,
    });
    counts[decision.outcome] += 1;
    if (decision.outcome === 'displayable') {
      counts[row.market] += 1;
      ids.push(row.creative.materialItemId);
    }
    if (/lastminute/i.test(row.creative.name)) {
      assert.equal(decision.outcome, 'excluded');
      assert.equal(decision.benefitText, null);
      assert.equal(row.creative.discountFixed, null);
      assert.equal(row.creative.staticImageUrlHint, null);
    }
  }
  assert.equal(rows.length, 125);
  assert.equal(counts.displayable, 0);
  assert.equal(counts.excluded, 125);
  assert.equal(counts.doubt, 0);
  assert.equal(counts.nl, 0);
  assert.equal(counts.be, 0);
  assert.deepEqual(ids, []);
});
