/**
 * GO3 regression: Corendon L2 rows are written under listingKey-scoped cache keys.
 * Bare-id hydrate (GO2) must miss; hydrate with `offers` must hit and seed L1
 * so applyResultsLivePriceOverlay can resolve the listing-scoped overlay.
 */
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import {
  clearResultsLivePriceCache,
  getResultsLivePriceOverlay,
  hasResultsLivePriceOverlay,
  hydrateResultsLivePriceOverlaysFromL2,
  livePriceCacheKey,
  setResultsLivePriceOverlay,
  applyResultsLivePriceOverlay,
} from './results-live-price-cache';
import {
  getLivePriceL2MemoryBackendForTests,
  hashLivePriceCacheKey,
  livePriceL2ObjectKey,
  readLivePriceL2Record,
  resetLivePriceL2MemoryBackendForTests,
  setLivePriceL2BackendForTests,
  setLivePriceL2EnabledForTests,
} from './live-price-l2-store';
import { CORENDON_PROVIDER_NAME } from '../providers/corendon/constants';
import {
  corendonListingCacheKey,
  rankCorendonListings,
} from '../providers/corendon/listing-selection';
import type { TravelOffer } from '@/types/travel';

const occupancy = { adults: 2, children: 0, babies: 0, rooms: 1 } as const;

const proven = {
  price: 421,
  pricePerDay: 53,
  livePriceStatus: 'proven' as const,
  livePriceSource: 'getPromotedPrice' as const,
  liveTotalPrice: 842,
  liveTotalPriceField: 'getPromotedPrice.totalPrice' as const,
};

afterEach(() => {
  clearResultsLivePriceCache();
  setLivePriceL2EnabledForTests(null);
  setLivePriceL2BackendForTests(null);
});

test('GO3: bare hydrate misses Corendon listingKey L2 row; offers-aware hydrate hits', async () => {
  resetLivePriceL2MemoryBackendForTests();
  setLivePriceL2BackendForTests(getLivePriceL2MemoryBackendForTests());
  setLivePriceL2EnabledForTests(true);

  const offer = {
    id: 'corendon-go3-listingkey-1',
    provider: CORENDON_PROVIDER_NAME,
    nights: 8,
    price: 999,
    deepLink: 'https://www.corendon.nl/offer',
    providerListings: [
      {
        host: 'www.corendon.nl',
        feedId: 'corendon-nl',
        deepLink: 'https://www.corendon.nl/offer',
      },
    ],
  } as unknown as TravelOffer;

  const listings = rankCorendonListings(offer, occupancy);
  assert.ok(listings.length > 0, 'expected at least one Corendon listing');
  const listingKey = corendonListingCacheKey(listings[0]!);
  const listingScoped = livePriceCacheKey(offer.id, { ...occupancy, listingKey });
  const bare = livePriceCacheKey(offer.id, occupancy);

  assert.notEqual(hashLivePriceCacheKey(listingScoped), hashLivePriceCacheKey(bare));
  assert.notEqual(livePriceL2ObjectKey(listingScoped), livePriceL2ObjectKey(bare));

  setResultsLivePriceOverlay(offer.id, { ...occupancy, listingKey }, proven);
  await new Promise((r) => setTimeout(r, 25));

  assert.ok(await readLivePriceL2Record(listingScoped), 'listingKey L2 row must exist');
  assert.equal(await readLivePriceL2Record(bare), null, 'bare L2 row must not exist');

  clearResultsLivePriceCache();
  const miss = await hydrateResultsLivePriceOverlaysFromL2([offer.id], occupancy);
  assert.equal(miss.hydrated, 0);
  assert.equal(hasResultsLivePriceOverlay(offer.id, occupancy), false);

  clearResultsLivePriceCache();
  const hit = await hydrateResultsLivePriceOverlaysFromL2([offer.id], occupancy, {
    offers: [offer],
  });
  assert.equal(hit.hydrated, 1);
  assert.equal(
    getResultsLivePriceOverlay(offer.id, { ...occupancy, listingKey })?.price,
    421,
  );

  const applied = applyResultsLivePriceOverlay(offer, occupancy);
  assert.equal(applied.livePriceStatus, 'proven');
  assert.equal(applied.price, 421);
});