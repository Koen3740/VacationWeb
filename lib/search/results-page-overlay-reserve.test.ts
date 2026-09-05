import assert from 'node:assert/strict';
import test from 'node:test';
import type { TravelOffer } from '@/types/travel';
import { slicePriceSortPoolPage } from '@/lib/search/prepare-results-offers';
import { PAGE1_OVERLAY_RESERVE, selectPageOverlayCandidates } from '@/lib/search/results-catalog-page';

function makeOffer(index: number): TravelOffer {
  return {
    id: `offer-${index}`,
    provider: 'Corendon',
    hotelName: `Hotel ${index}`,
    destinationCountry: 'Spanje',
    destinationRegion: 'Costa de la Luz',
    destinationCity: 'Sevilla',
    nights: 8,
    flightIncluded: 'true',
    price: 500 + index,
    pricePerDay: Math.round((500 + index) / 8),
    imageUrl: '/images/results-card-placeholder.png',
    deepLink: 'https://example.com',
    livePriceStatus: 'catalog',
    livePriceSource: 'feed',
  };
}

test('selectPageOverlayCandidates adds a reserve window for intermediate pages', () => {
  const ordered = Array.from({ length: 200 }, (_, i) => makeOffer(i));
  const pageSize = 10;
  const reserve = PAGE1_OVERLAY_RESERVE;

  const page = 4;
  const startIndex = (page - 1) * pageSize;
  const expectedEnd = startIndex + pageSize + reserve;

  const window = selectPageOverlayCandidates(ordered, page, pageSize, reserve);
  assert.equal(window.length, Math.min(ordered.length, expectedEnd) - startIndex);
  assert.equal(window[0]?.id, `offer-${startIndex}`);
  assert.equal(window[window.length - 1]?.id, `offer-${Math.min(ordered.length, expectedEnd) - 1}`);
});

test('intermediate overlay windows are larger than pageSize so Page1ResultsCap can backfill', () => {
  const ranked = Array.from({ length: 108 }, (_, i) => makeOffer(i));
  const pageSize = 10;
  const page = 4;
  const overlayWindow = selectPageOverlayCandidates(ranked, page, pageSize);
  const pageSlice = ranked.slice((page - 1) * pageSize, page * pageSize);
  assert.equal(pageSlice.length, 10);
  assert.ok(overlayWindow.length > pageSlice.length);
  assert.ok(overlayWindow.length <= pageSize + PAGE1_OVERLAY_RESERVE);
});

test('slicePriceSortPoolPage is exact membership page slice (no paint reserve)', () => {
  const ranked = Array.from({ length: 200 }, (_, i) => makeOffer(i));
  const pageSize = 10;

  const page1 = slicePriceSortPoolPage(ranked, 1, pageSize, {
    provisional: false,
  });
  assert.equal(page1.paginationTotal, 200);
  assert.equal(page1.visibleOffers.length, 10);
  assert.equal(page1.visibleOffers[0]?.id, 'offer-0');

  const page4 = slicePriceSortPoolPage(ranked, 4, pageSize, {
    provisional: false,
  });
  assert.equal(page4.paginationTotal, 200);
  // Overlay reserve lives in selectPageOverlayCandidates — not in membership slice.
  assert.equal(page4.visibleOffers.length, 10);
  assert.equal(page4.visibleOffers[0]?.id, 'offer-30');
  assert.equal(page4.visibleOffers[9]?.id, 'offer-39');
});

