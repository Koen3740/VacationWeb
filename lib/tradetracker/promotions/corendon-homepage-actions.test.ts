import assert from 'node:assert/strict';
import test from 'node:test';
import { corendonHomepageActions } from './corendon-homepage-actions';
import { corendonActionClickHref } from './promotion-click';

test('homepage actions are the two proven Corendon offers with a campaign deeplink', () => {
  const nl = corendonHomepageActions('nl');
  const be = corendonHomepageActions('be');
  assert.deepEqual(
    nl.map((offer) => offer.benefitAmount),
    ['€600', '€200'],
  );
  assert.equal(nl[0]?.title, 'Warme Winter Weken');
  assert.equal(nl[1]?.title, 'Last minutes');
  assert.match(nl[0]?.summary ?? '', /Egypte en de Canarische Eilanden/);
  assert.match(be[0]?.summary ?? '', /Curaçao, Bonaire/);
  assert.equal(nl[0]?.summary.includes('Curaçao'), false);
  assert.match(nl[0]?.clickUrl ?? '', /^https:\/\/referral\.corendon\.nl\/c\?c=38108&m=0&a=512226&r=&u=https%3A%2F%2Fwww\.corendon\.nl%2Fwinterzon$/);
  assert.match(be[1]?.clickUrl ?? '', /^https:\/\/referral\.corendon\.be\/c\?c=38103&m=0&a=511873&r=&u=https%3A%2F%2Fwww\.corendon\.be%2Ftopdeals$/);
  assert.equal(JSON.stringify(nl).includes('2499691'), false);
  assert.equal(JSON.stringify(nl).includes('Kaching'), false);
  assert.equal(nl[0]?.clickUrl.includes('/i?'), false);
  assert.equal(nl[0]?.imageUrl, '');
  assert.equal(nl[1]?.imageUrl, '');
  assert.equal(JSON.stringify(nl).includes('corendonresources'), false);
});

test('a campaign deeplink only accepts the live action pages', () => {
  assert.equal(corendonActionClickHref('nl', 'https://www.corendon.nl/winterzon')?.includes('u=https%3A%2F%2Fwww.corendon.nl%2Fwinterzon'), true);
  assert.equal(corendonActionClickHref('nl', 'https://www.corendon.nl/acties'), null);
  assert.equal(corendonActionClickHref('be', 'https://www.corendon.nl/winterzon'), null);
  assert.equal(corendonActionClickHref('nl', 'https://evil.example/winterzon'), null);
});

