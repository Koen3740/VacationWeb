/**
 * Regression: Corendon catalog prefix must not collapse page-1 to a single card when
 * the matchset is large (production Spanje/okt/BE: 313 → 1 after month-index fix).
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { page1DiscoveryRanked } from '@/lib/search/schedule-capped-matchset-live-after-page';
import {
  selectPage1OverlayCandidates,
  PAGE1_OVERLAY_RESERVE,
} from '@/lib/search/results-catalog-page';
import {
  buildPage1SlotOffers,
  createPage1SettleController,
  PAGE1_SETTLE_DEADLINE_MS,
} from '@/lib/search/page-settle';
import { RESULTS_PAGE_SIZE_DEFAULT } from '@/lib/search/pagination';
import type { SearchParams, TravelOffer } from '@/types/travel';

const params: SearchParams = {
  country: 'Spanje',
  adults: 2,
  rooms: 1,
  nights: [7, 8, 9],
  departureStart: '2026-10-01',
  departureEnd: '2026-10-31',
  departureAirport: 'BRU,CRL,ANR,OST,LGG',
  sort: 'value',
};

function corendon(n: number, price: number): TravelOffer {
  return {
    id: `corendon-${n}-BRUAGP-101026-7-DZF`,
    provider: 'Corendon',
    hotelName: `Corendon ${n}`,
    destinationCountry: 'Spanje',
    nights: 8,
    price,
    pricePerDay: Math.round(price / 8),
    imageUrl: 'https://example.com/c.jpg',
    flightIncluded: 'true',
    departureAirport: 'BRU',
    departureDate: '10/10/2026',
    deepLink: `https://www.corendon.be/vakantie#${n}.MLELC.BRUPMI.101026.8.DZI-U`,
  };
}

function sunweb(n: number, price: number): TravelOffer {
  return {
    id: `sunweb-${n}-2026-10-10-8-BRU-Logies`,
    provider: 'Sunweb',
    hotelName: `Sunweb ${n}`,
    destinationCountry: 'Spanje',
    nights: 8,
    price,
    pricePerDay: Math.round(price / 8),
    imageUrl: 'https://example.com/s.jpg',
    flightIncluded: 'true',
    departureAirport: 'BRU',
    departureDate: '2026-10-10',
    deepLink:
      'https://www.sunweb.be/nl/vakantie/reizen?tt=1&r=' +
      encodeURIComponent(
        'https://www.sunweb.be/nl/vakantie/x?Duration[0]=8&TransportType[0]=Flight&Mealplan[0]=LO&DepartureAirport[0]=BRU&DepartureDate[0]=2026-10-10',
      ),
  };
}

function makeMatchset(): TravelOffer[] {
  // Catalog order: 60 expensive Corendon, then 20 cheap Sunweb (mirrors production prefix).
  const ranked: TravelOffer[] = [];
  for (let i = 0; i < 60; i += 1) ranked.push(corendon(i, 2000 + i));
  for (let i = 0; i < 20; i += 1) ranked.push(sunweb(i, 400 + i));
  return ranked;
}

function liveB(offer: TravelOffer, price: number): TravelOffer {
  const total = price * 2;
  if (offer.provider === 'Corendon') {
    return {
      ...offer,
      price,
      pricePerDay: Math.round(price / Math.max(1, offer.nights)),
      livePriceStatus: 'proven',
      livePriceSource: 'upsales',
      liveTotalPrice: total,
      liveTotalPriceField: 'upsales.totalPrice',
    };
  }
  return {
    ...offer,
    price,
    pricePerDay: Math.round(price / Math.max(1, offer.nights)),
    livePriceStatus: 'proven',
    livePriceSource: 'getPromotedPrice',
    liveTotalPrice: total,
    liveTotalPriceField: 'getPromotedPrice.totalPrice',
  };
}

test('catalog-order page1 overlay is Corendon-only when Corendon leads the matchset', () => {
  const ranked = makeMatchset();
  assert.ok(ranked.length >= 15);
  const overlay = selectPage1OverlayCandidates(ranked, RESULTS_PAGE_SIZE_DEFAULT, undefined, params);
  assert.equal(overlay.length, RESULTS_PAGE_SIZE_DEFAULT + PAGE1_OVERLAY_RESERVE);
  assert.ok(overlay.every((o) => o.provider === 'Corendon'));
  assert.equal(overlay.filter((o) => o.provider === 'Sunweb').length, 0);
});

test('shared-pool page1 discovery cheapest-first includes Sunweb in the overlay window', () => {
  const ranked = makeMatchset();
  const discovery = page1DiscoveryRanked(ranked, params);
  const overlay = selectPage1OverlayCandidates(
    discovery,
    RESULTS_PAGE_SIZE_DEFAULT,
    undefined,
    params,
  );
  assert.equal(overlay.length, RESULTS_PAGE_SIZE_DEFAULT + PAGE1_OVERLAY_RESERVE);
  const sunwebCount = overlay.filter((o) => o.provider === 'Sunweb').length;
  assert.ok(
    sunwebCount >= 10,
    `expected >=10 Sunweb in page1 overlay after cheapest-first, got ${sunwebCount}`,
  );
  assert.ok(overlay.some((o) => o.provider === 'Corendon') || sunwebCount === overlay.length);
});

test('page1 settle: Corendon-only overlay + 1 B → 1 card; cheapest-first overlay → 10 cards', async () => {
  const ranked = makeMatchset();
  const pageSize = RESULTS_PAGE_SIZE_DEFAULT;

  // Bug path: catalog overlay, only first Corendon settles as B within deadline.
  const catalogOverlay = selectPage1OverlayCandidates(ranked, pageSize, undefined, params);
  const bugSlots = buildPage1SlotOffers({
    browsable: [],
    overlayCandidates: catalogOverlay,
    frozenIds: undefined,
    pageSize,
  });
  const bugController = createPage1SettleController({
    slotOffers: bugSlots.slotOffers,
    overlays: catalogOverlay.map((offer, index) => ({
      catalog: offer,
      pending: true,
      live:
        index === 0
          ? Promise.resolve(liveB(offer, 900))
          : new Promise<TravelOffer>(() => {
              /* never settles before deadline */
            }),
    })),
    pageSize,
    deadlineMs: 50,
    scheduleDeadline: (onDeadline) => {
      // Allow the first Corendon Promise.resolve to settle, then fire deadline.
      queueMicrotask(() => queueMicrotask(onDeadline));
      return () => {};
    },
  });
  const bugSelection = await bugController.selection;
  assert.equal(bugSelection.selectedIds.length, 1);
  assert.ok(bugSelection.status === 'DEADLINE' || bugSelection.status === 'EXHAUSTED');

  // Fixed path: cheapest-first discovery overlay; first 10 Sunweb settle as B immediately.
  const discoveryOverlay = selectPage1OverlayCandidates(
    page1DiscoveryRanked(ranked, params),
    pageSize,
    undefined,
    params,
  );
  const sunwebSlots = discoveryOverlay.filter((o) => o.provider === 'Sunweb').slice(0, pageSize);
  assert.ok(sunwebSlots.length >= pageSize);
  const fixSlots = buildPage1SlotOffers({
    browsable: [],
    overlayCandidates: discoveryOverlay,
    frozenIds: undefined,
    pageSize,
  });
  const fixController = createPage1SettleController({
    slotOffers: fixSlots.slotOffers,
    overlays: discoveryOverlay.map((offer) => {
      const asSunwebB = sunwebSlots.some((s) => s.id === offer.id);
      return {
        catalog: offer,
        pending: true,
        live: asSunwebB
          ? Promise.resolve(liveB(offer, offer.price))
          : new Promise<TravelOffer>(() => {
              /* slow Corendon */
            }),
      };
    }),
    pageSize,
    deadlineMs: PAGE1_SETTLE_DEADLINE_MS,
    scheduleDeadline: (onDeadline) => {
      // Let microtasks flush Sunweb settles, then hit deadline for remaining Corendon.
      queueMicrotask(() => queueMicrotask(onDeadline));
      return () => {};
    },
  });
  const fixSelection = await fixController.selection;
  assert.ok(
    fixSelection.selectedIds.length >= pageSize,
    `expected >=${pageSize} page1 cards after cheapest-first discovery, got ${fixSelection.selectedIds.length} (${fixSelection.status})`,
  );
  assert.ok(fixSelection.selectedIds.every((id) => id.startsWith('sunweb-')));
});
