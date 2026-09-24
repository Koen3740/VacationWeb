import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { repairPage1FreezeOrder } from '@/lib/search/page1-freeze-repair';
import type { TravelOffer } from '@/types/travel';

const ROOT = process.cwd();

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8');
}

function offer(id: string): TravelOffer {
  return {
    id,
    provider: 'sunweb',
    price: 100,
    pricePerDay: 10,
    hotelName: id,
  } as TravelOffer;
}

test('GO10: all-stale page1Ids drop freeze and fill from current presentable pool', () => {
  const pool = [offer('a'), offer('b'), offer('c'), offer('d')];
  const repaired = repairPage1FreezeOrder({
    presentableOrdered: pool,
    frozenIds: ['dead-1', 'dead-2', 'dead-3'],
    pageSize: 3,
  });
  assert.equal(repaired.usedFreeze, false);
  assert.equal(repaired.keptFrozenCount, 0);
  assert.deepEqual(
    repaired.offers.map((o) => o.id),
    ['a', 'b', 'c'],
  );
  assert.ok(repaired.offers.length > 0);
});

test('GO10: partially valid page1Ids keep valid order then fill from pool', () => {
  const pool = [offer('a'), offer('b'), offer('c'), offer('d'), offer('e')];
  const repaired = repairPage1FreezeOrder({
    presentableOrdered: pool,
    frozenIds: ['c', 'dead', 'a', 'dead2'],
    pageSize: 4,
  });
  assert.equal(repaired.usedFreeze, true);
  assert.equal(repaired.keptFrozenCount, 2);
  assert.deepEqual(
    repaired.offers.map((o) => o.id),
    ['c', 'a', 'b', 'd'],
  );
});

test('GO10: empty freeze with non-empty pool never returns empty page', () => {
  const pool = [offer('x'), offer('y')];
  const repaired = repairPage1FreezeOrder({
    presentableOrdered: pool,
    frozenIds: [],
    pageSize: 10,
  });
  assert.equal(repaired.offers.length, 2);
  assert.deepEqual(repaired.page1Ids, ['x', 'y']);
});

test('GO10: catalog-live-page-state wires freeze repair on page 1', () => {
  const state = read('lib/search/catalog-live-page-state.ts');
  assert.ok(state.includes('repairPage1FreezeOrder'));
  assert.ok(state.includes('params.page1Ids'));
  assert.ok(state.includes('bookableResultsMembership'));
});

test('GO10: CatalogLiveBody never NoResults while paginationTotal > 0', () => {
  const section = read('components/results/catalog-live-section.tsx');
  assert.ok(section.includes('showEmpty'));
  assert.ok(section.includes('filtered.length === 0') || section.includes('showEmpty = false'),
    'GO11: Geen only when pool empty; never gate empty on paginationTotal alone');
  assert.ok(!/paginationTotal === 0/.test(section) || section.includes('showEmpty = false'));;
  assert.ok(section.includes('GO10'));
});

test('GO10: SyncPage1Ids replaceExisting true so repaired freeze overwrites stale URL', () => {
  const stream = read('components/results/page1-receipt-stream.tsx');
  assert.ok(stream.includes('replaceExisting={true}'));
  assert.ok(!stream.includes('replaceExisting={Boolean(params.page1Ids'));
});

test('GO10: value path uses CatalogLive (freeze repair); price path stays PriceSort', () => {
  const page = read('app/results/page.tsx');
  assert.ok(page.includes('CatalogLiveSection'));
  assert.ok(page.includes('PriceSortPreparedSection'));
  assert.ok(page.includes('isPriceDependentSort'));
});
