import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { RECOMMENDED_LIVE_CLICK_MATERIAL_ID, promotionClickHref } from './promotion-click';
import type { SelectedTradeTrackerCreativeSnapshot } from './types';

const BE_CLICK = 'https://referral.corendon.be/c?c=38103&m=2499693&a=511873&r=&u=';

function source(overrides: Partial<Parameters<typeof promotionClickHref>[0]> = {}) {
  return {
    market: 'be' as const,
    campaignId: '38103',
    affiliateSiteId: '511873',
    materialItemId: '2499693',
    trackingClickUrlTemplate: BE_CLICK,
    ...overrides,
  };
}

test('a matching click template is returned unchanged', () => {
  assert.equal(promotionClickHref(source()), BE_CLICK);
  assert.equal(promotionClickHref(source({ trackingClickUrlTemplate: null })), null);
  assert.equal(promotionClickHref(source({ trackingClickUrlTemplate: '   ' })), null);
});

test('mismatched ids, extra params, impression URLs, and PII are refused', () => {
  assert.equal(promotionClickHref(source({ materialItemId: '2499691' })), null);
  assert.equal(promotionClickHref(source({ campaignId: '38108' })), null);
  assert.equal(promotionClickHref(source({ affiliateSiteId: '512226' })), null);
  assert.equal(promotionClickHref(source({ market: 'nl' })), null);
  assert.equal(
    promotionClickHref(source({ trackingClickUrlTemplate: 'https://referral.corendon.be/i?c=38103&m=2499693&a=511873' })),
    null,
  );
  assert.equal(
    promotionClickHref(
      source({
        trackingClickUrlTemplate: 'https://referral.corendon.be/c?c=38103&m=2499693&a=511873&r=&u=&email=a@b.be',
      }),
    ),
    null,
  );
  assert.equal(
    promotionClickHref(
      source({
        trackingClickUrlTemplate: 'https://referral.corendon.be/c?c=38103&m=2499693&a=511873&u=dob%401990-01-01',
      }),
    ),
    null,
  );
  assert.equal(
    promotionClickHref(source({ trackingClickUrlTemplate: 'https://ti.tradetracker.net/c?c=38103&m=2499693&a=511873' })),
    null,
  );
});

test('the nine BE lastminute templates are deterministic and one material is the live check', (t) => {
  const filePath = path.join(process.cwd(), 'data', 'tradetracker-creatives', 'selected-be-511873.json');
  if (!fs.existsSync(filePath)) {
    t.skip('Selected creative snapshots are gitignored and are not in this checkout');
    return;
  }
  const snapshot = JSON.parse(fs.readFileSync(filePath, 'utf8')) as SelectedTradeTrackerCreativeSnapshot;
  const offers = snapshot.creatives.filter((creative) => /lastminute/i.test(creative.title));
  assert.equal(offers.length, 9);
  const ids = offers.map((creative) => creative.materialItemId).sort((a, b) => Number(a) - Number(b));
  assert.deepEqual(ids, ['2499691', '2499692', '2499693', '2499694', '2499695', '2499696', '2499697', '2499698', '2499700']);
  assert.equal(ids.includes(RECOMMENDED_LIVE_CLICK_MATERIAL_ID), true);
  for (const creative of offers) {
    const href = promotionClickHref(creative);
    assert.equal(href, creative.trackingClickUrlTemplate);
    const url = new URL(href ?? '');
    assert.equal(url.hostname, 'referral.corendon.be');
    assert.equal(url.pathname, '/c');
    assert.equal(url.searchParams.get('c'), '38103');
    assert.equal(url.searchParams.get('a'), '511873');
    assert.equal(url.searchParams.get('m'), creative.materialItemId);
    assert.equal(url.searchParams.get('r'), '');
    assert.equal(url.searchParams.get('u'), '');
    assert.deepEqual([...url.searchParams.keys()].sort(), ['a', 'c', 'm', 'r', 'u']);
  }
  const sourceText = fs.readFileSync(path.join(process.cwd(), 'lib/tradetracker/promotions/promotion-click.ts'), 'utf8');
  assert.equal(/\bfetch\s*\(/.test(sourceText), false);
  assert.equal(sourceText.includes('node:http'), false);
});
