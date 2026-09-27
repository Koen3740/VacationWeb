/**
 * Provider filter must scope Page-1 settle / paint / page1Ids — not only heading.
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import type { SearchParams, TravelOffer } from '@/types/travel';
import {
  CORENDON_PROVIDER_NAME,
  ELIZA_PROVIDER_NAME,
  SUNWEB_PROVIDER_NAME,
} from '@/lib/search/presentable-price';
import {
  buildPage1SlotOffers,
  createPage1SettleController,
  isPage1VisibleOffer,
  resolvePage1SettleOutput,
} from '@/lib/search/page-settle';
import { scopeOffersToProviderFilter } from '@/lib/search/provider-filter';
import {
  bookableResultsMembership,
  selectResultsBrowsePool,
} from '@/lib/search/results-catalog-page';
import {
  clearResultsLivePriceCache,
  setResultsLivePriceOverlay,
} from '@/lib/search/results-live-price-cache';

const baseParams: SearchParams = { adults: 2, countries: ['Spanje'] };

function makeOffer(id: string, price: number, provider: string): TravelOffer {
  return {
    id,
    provider,
    hotelName: `Hotel ${id}`,
    destinationCountry: 'Spanje',
    departureDate: '2026-10-10',
    departureAirport: 'BRU',
    nights: 8,
    flightIncluded: 'true',
    price,
    pricePerDay: Math.round(price / 8),
    currency: 'EUR',
    imageUrl: '/images/results-card-placeholder.png',
    deepLink: `https://example.com/${id}`,
    livePriceStatus: 'catalog',
  };
}

function seedB(id: string, price: number, provider: string, params: SearchParams = baseParams): void {
  const source =
    provider === CORENDON_PROVIDER_NAME
      ? ('upsales' as const)
      : ('getPromotedPrice' as const);
  setResultsLivePriceOverlay(id, params, {
    price,
    pricePerDay: Math.round(price / 8),
    livePriceStatus: 'proven',
    livePriceSource: source,
    liveTotalPrice: price * 2,
    liveTotalPriceField:
      provider === CORENDON_PROVIDER_NAME
        ? 'upsales.totalPrice'
        : 'getPromotedPrice.totalPrice',
  });
}

beforeEach(() => {
  clearResultsLivePriceCache();
});

describe('Page-1 provider filter (settle / paint / page1Ids)', () => {
  it('isPage1VisibleOffer rejects offers outside active provider', () => {
    const sun = makeOffer('sun-1', 400, SUNWEB_PROVIDER_NAME);
    const cor = makeOffer('cor-1', 500, CORENDON_PROVIDER_NAME);
    seedB('sun-1', 400, SUNWEB_PROVIDER_NAME);
    seedB('cor-1', 500, CORENDON_PROVIDER_NAME);
    const overlaidSun = bookableResultsMembership([sun], baseParams)[0] ?? sun;
    const overlaidCor = bookableResultsMembership([cor], baseParams)[0] ?? cor;

    assert.equal(
      isPage1VisibleOffer(overlaidSun, { ...baseParams, provider: CORENDON_PROVIDER_NAME }),
      false,
    );
    assert.equal(
      isPage1VisibleOffer(overlaidCor, { ...baseParams, provider: CORENDON_PROVIDER_NAME }),
      true,
    );
    assert.equal(isPage1VisibleOffer(overlaidSun, baseParams), true);
  });

  it('Page-1 slots + settle page1Ids stay inside Corendon when provider=Corendon', async () => {
    const catalog = [
      makeOffer('sun-1', 300, SUNWEB_PROVIDER_NAME),
      makeOffer('sun-2', 310, SUNWEB_PROVIDER_NAME),
      makeOffer('eliza-1', 320, ELIZA_PROVIDER_NAME),
      makeOffer('cor-1', 900, CORENDON_PROVIDER_NAME),
      makeOffer('cor-2', 910, CORENDON_PROVIDER_NAME),
      makeOffer('cor-3', 920, CORENDON_PROVIDER_NAME),
    ];
    for (const offer of catalog) {
      seedB(offer.id, offer.price, offer.provider);
    }

    const params: SearchParams = { ...baseParams, provider: CORENDON_PROVIDER_NAME };
    const bookable = bookableResultsMembership(catalog, params);
    assert.equal(bookable.length, 3);
    assert.ok(bookable.every((o) => o.provider === CORENDON_PROVIDER_NAME));

    const browsable = selectResultsBrowsePool(catalog, params, 150);
    const scoped = scopeOffersToProviderFilter(catalog, params);
    assert.equal(scoped.length, 3);

    // Simulate the old bug: overlay window from FULL matchset (cheapest first = Sunweb).
    const buggyOverlay = bookableResultsMembership(catalog, baseParams);
    assert.ok(buggyOverlay.some((o) => o.provider === SUNWEB_PROVIDER_NAME));

    const slots = buildPage1SlotOffers({
      browsable,
      overlayCandidates: scopeOffersToProviderFilter(buggyOverlay, params),
      frozenIds: undefined,
      pageSize: 10,
    });
    assert.ok(slots.slotOffers.every((o) => o.provider === CORENDON_PROVIDER_NAME));
    assert.equal(slots.slotOffers.length, 3);

    const overlays = slots.slotOffers.map((offer) => ({
      catalog: offer,
      live: Promise.resolve(offer),
      pending: false,
    }));
    const settle = createPage1SettleController({
      slotOffers: slots.slotOffers,
      overlays,
      pageSize: 10,
      isPresentable: (offer) => isPage1VisibleOffer(offer, params),
      scheduleDeadline: (onDeadline) => {
        onDeadline();
        return () => {};
      },
    });
    const selection = await settle.selection;
    assert.ok(selection.selectedIds.every((id) => id.startsWith('cor-')));
    assert.equal(selection.selectedIds.length, 3);

    const output = resolvePage1SettleOutput({
      result: selection,
      browseTotal: browsable.length,
      pageSize: 10,
    });
    assert.ok(output.page1Ids.every((id) => id.startsWith('cor-')));
    assert.equal(output.page1Ids.length, 3);
  });

  it('stale Sunweb page1Ids are not kept when provider=Corendon', () => {
    const catalog = [
      makeOffer('sun-1', 300, SUNWEB_PROVIDER_NAME),
      makeOffer('cor-1', 900, CORENDON_PROVIDER_NAME),
      makeOffer('cor-2', 910, CORENDON_PROVIDER_NAME),
    ];
    for (const offer of catalog) {
      seedB(offer.id, offer.price, offer.provider);
    }
    const params: SearchParams = { ...baseParams, provider: CORENDON_PROVIDER_NAME };
    const browsable = selectResultsBrowsePool(catalog, params, 150);
    const slots = buildPage1SlotOffers({
      browsable,
      overlayCandidates: browsable,
      frozenIds: ['sun-1', 'cor-1'],
      pageSize: 10,
    });
    assert.ok(!slots.slotOffers.some((o) => o.id === 'sun-1'));
    assert.ok(slots.slotOffers.every((o) => o.provider === CORENDON_PROVIDER_NAME));
  });
});
