import assert from 'node:assert/strict';
import test from 'node:test';
import { assignHeroPlacement, selectHeroOfferId } from './select-offer-hero';

function offer(id: string, providerName: string) {
  return { id, providerName, placement: 'supporting' as const };
}

test('A: one offer is the hero', () => {
  const placed = assignHeroPlacement([offer('c1', 'Corendon')], 4);
  assert.equal(placed.length, 1);
  assert.equal(placed[0]?.placement, 'hero');
});

test('B: Corendon and Sunweb share one hero and both stay visible', () => {
  const offers = [offer('c1', 'Corendon'), offer('s1', 'Sunweb')];
  const day0 = assignHeroPlacement(offers, 0);
  const day1 = assignHeroPlacement(offers, 1);
  assert.equal(day0.filter((item) => item.placement === 'hero').length, 1);
  assert.equal(day1.filter((item) => item.placement === 'hero').length, 1);
  assert.equal(day0.length, 2);
  assert.notEqual(
    day0.find((item) => item.placement === 'hero')?.providerName,
    day1.find((item) => item.placement === 'hero')?.providerName,
  );
});

test('C: three providers yield one hero and the rest are cards', () => {
  const offers = [offer('c1', 'Corendon'), offer('s1', 'Sunweb'), offer('e1', 'Eliza was here')];
  const placed = assignHeroPlacement(offers, 2);
  assert.equal(placed.filter((item) => item.placement === 'hero').length, 1);
  assert.equal(placed.filter((item) => item.placement === 'supporting').length, 2);
  const heroes = new Set([0, 1, 2].map((day) => selectHeroOfferId(offers, day)));
  assert.equal(heroes.size, 3);
});

test('D: two offers from one provider never take two hero slots', () => {
  const offers = [offer('c-a', 'Corendon'), offer('c-b', 'Corendon'), offer('s1', 'Sunweb')];
  for (let day = 0; day < 6; day += 1) {
    const placed = assignHeroPlacement(offers, day);
    const heroes = placed.filter((item) => item.placement === 'hero');
    assert.equal(heroes.length, 1);
    assert.equal(placed.filter((item) => item.providerName === 'Corendon' && item.placement === 'hero').length <= 1, true);
  }
  const corendonTurns = [0, 1, 2, 3].map((day) => selectHeroOfferId(offers, day)).filter((id) => id?.startsWith('c-'));
  assert.equal(new Set(corendonTurns).size, 2);
});

test('E: many offers keep a single hero', () => {
  const offers = Array.from({ length: 9 }, (_, index) => offer(`o${index}`, index % 3 === 0 ? 'Corendon' : index % 3 === 1 ? 'Sunweb' : 'Eliza was here'));
  const placed = assignHeroPlacement(offers, 10);
  assert.equal(placed.filter((item) => item.placement === 'hero').length, 1);
  assert.equal(placed.filter((item) => item.placement === 'supporting').length, 8);
});
