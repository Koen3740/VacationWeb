import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import type { TravelOffer } from '@/types/travel';
import {
  collectPage1VisibleTravelCards,
  page1PendingSlotUsesCardFallback,
  type Page1RenderSlot,
} from '@/lib/search/page1-visible-cards';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

function makeCatalog(id: string, overrides: Partial<TravelOffer> = {}): TravelOffer {
  return {
    id,
    provider: 'Corendon',
    hotelName: `Hotel ${id}`,
    destinationCountry: 'Spanje',
    destinationRegion: 'Mallorca',
    departureDate: '2026-08-27',
    nights: 8,
    flightIncluded: 'true',
    price: 458,
    pricePerDay: 57,
    imageUrl: overrides.imageUrl === undefined ? 'https://example.com/a.jpg' : overrides.imageUrl,
    deepLink: 'https://www.corendon.be/vakantie#9514.COSPY.BRUCFU.270826.3-4-3.SZ-U',
    livePriceStatus: 'catalog',
    livePriceSource: 'feed',
    ...overrides,
  };
}

function makeProven(id: string, overrides: Partial<TravelOffer> = {}): TravelOffer {
  return makeCatalog(id, {
    livePriceStatus: 'proven',
    livePriceSource: 'upsales',
    price: 717,
    pricePerDay: 90,
    liveTotalPrice: 1434,
    liveTotalPriceField: 'upsales.totalPrice',
    ...overrides,
  });
}

test('pending page-1 slots render the catalog TravelCard, not an empty hole', () => {
  assert.equal(page1PendingSlotUsesCardFallback(), true);
  const streamSource = readFileSync(
    join(ROOT, 'components/results/page1-receipt-stream.tsx'),
    'utf8',
  );
  assert.equal(streamSource.includes('TravelCardReceiptFallback'), false);
  assert.match(streamSource, /fallback=\{\s*<TravelCard/);
  assert.doesNotMatch(streamSource, /fallback=\{null\}/);
});

test('catalog offers without a proven live price still count as visible TravelCards', () => {
  const slots: Page1RenderSlot[] = Array.from({ length: 10 }, (_, index) => ({
    kind: 'immediate',
    offer: makeCatalog(`catalog-${index + 1}`),
  }));
  assert.equal(collectPage1VisibleTravelCards({ slots }).length, 10);
});

test('timeout live overlay keeps the catalog card; provider-unavailable does not', () => {
  const first = makeCatalog('corendon-1');
  const second = makeCatalog('corendon-2', { imageUrl: '' });
  const third = makeCatalog('corendon-3');
  const visible = collectPage1VisibleTravelCards({
    slots: [
      {
        kind: 'pending',
        settledOffer: makeCatalog('corendon-1', {
          livePriceStatus: 'unavailable',
          livePriceFailureReason: 'timeout',
        }),
        catalogOffer: first,
      },
      { kind: 'pending', settledOffer: null, catalogOffer: second },
      {
        kind: 'pending',
        settledOffer: makeCatalog('corendon-3', {
          livePriceStatus: 'unavailable',
          livePriceFailureReason: 'http_204',
        }),
        catalogOffer: third,
      },
      ...Array.from({ length: 7 }, (_, index) => ({
        kind: 'pending' as const,
        settledOffer: null,
        catalogOffer: makeCatalog(`catalog-${index + 4}`),
      })),
    ],
  });
  assert.equal(visible.length, 9);
  assert.equal(visible[0].id, 'corendon-1');
  assert.equal(visible[1].id, 'corendon-2');
  assert.ok(!visible.some((offer) => offer.id === 'corendon-3'));
});

test('a catalog card without an image stays in the page-1 list', () => {
  const offer = makeCatalog('corendon-no-photo', { imageUrl: '' });
  const visible = collectPage1VisibleTravelCards({
    slots: [{ kind: 'immediate', offer }],
  });
  assert.equal(visible.length, 1);
  assert.equal(visible[0].id, 'corendon-no-photo');
});

test('proven live overlay replaces the catalog price but does not shrink the list', () => {
  const catalog = makeCatalog('corendon-1');
  const proven = makeProven('corendon-1');
  const visible = collectPage1VisibleTravelCards({
    slots: [{ kind: 'pending', settledOffer: proven, catalogOffer: catalog }],
  });
  assert.equal(visible.length, 1);
  assert.equal(visible[0].livePriceStatus, 'proven');
});

test('parked Prijsvrij is still not a Results card', () => {
  const visible = collectPage1VisibleTravelCards({
    slots: [
      {
        kind: 'immediate',
        offer: makeCatalog('pv-1', { provider: 'Prijsvrij' }),
      },
    ],
  });
  assert.equal(visible.length, 0);
});
