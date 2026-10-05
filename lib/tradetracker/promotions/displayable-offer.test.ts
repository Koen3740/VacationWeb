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

test('explicit promo tokens are taken from source text and amounts are not invented', () => {
  assert.equal(evaluateOfferBenefit({ name: 'Banner1-lastminute' }).benefitText, 'lastminute');
  assert.equal(evaluateOfferBenefit({ name: 'Banner1-lastminute' }).benefitText?.includes('€'), false);
  assert.equal(evaluateOfferBenefit({ title: 'Last-Minute' }).benefitText, 'Last-Minute');
  assert.equal(evaluateOfferBenefit({ description: 'Last minute naar Turkije' }).benefitText, 'Last minute');
  assert.equal(evaluateOfferBenefit({ conditions: '10% korting op een selectie' }).benefitText, 'korting');
  assert.equal(evaluateOfferBenefit({ summary: 'Early booking voor mei' }).benefitText, 'Early booking');
  assert.equal(evaluateOfferBenefit({ description: 'vroegboek' }).outcome, 'displayable');
  assert.equal(evaluateOfferBenefit({ name: 'summer discount' }).benefitText, 'discount');
  assert.equal(
    evaluateOfferBenefit({ name: 'Banner-lastminute', description: 'extra korting' }).benefitText,
    'lastminute · korting',
  );
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

test('this snapshot has 9 BE lastminute offers, 0 NL offers, 116 generic ads and 0 doubts', (t) => {
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
      assert.equal(decision.benefitText, 'lastminute');
      assert.equal(row.creative.staticImageUrlHint, null);
      assert.match(row.creative.embedCode ?? '', /\/i\?/);
    }
  }
  assert.equal(rows.length, 125);
  assert.equal(counts.displayable, 9);
  assert.equal(counts.excluded, 116);
  assert.equal(counts.doubt, 0);
  assert.equal(counts.nl, 0);
  assert.equal(counts.be, 9);
  assert.deepEqual(ids.sort(), ['2499691', '2499692', '2499693', '2499694', '2499695', '2499696', '2499697', '2499698', '2499700'].sort());
});
