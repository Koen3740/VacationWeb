import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CONTEXT_ITEM_ID_CACHE_TTL_MS,
  getCachedContextItemId,
  getContextItemIdCacheStats,
  getSitecoreSiteGuidConfig,
  resetContextItemIdCacheForTests,
  setCachedContextItemId,
  setContextItemIdCacheNowMsForTests,
  setSitecoreSiteGuidConfig,
} from './context-item-id-cache';
import {
  ELIZA_LANDING_HTML,
  okPromotedBody as okElizaPromotedBody,
} from './eliza/promoted-price-client.test';
import { fetchElizaPromotedPrice } from './eliza/promoted-price-client';
import type { ElizaLiveContext } from './eliza/offer-context';
import { ELIZA_FE_HOST } from './eliza/constants';
import {
  SUNWEB_LANDING_HTML,
  echoGroupedPricesFromUrl,
  okPromotedBody as okSunwebPromotedBody,
} from './sunweb/promoted-price-client.test';
import { fetchSunwebPromotedPrice } from './sunweb/promoted-price-client';
import type { SunwebLiveContext } from './sunweb/offer-context';
import { SUNWEB_FE_HOST } from './sunweb/constants';

const SUNWEB_CONTEXT = 'c1440175-b6ef-4dd3-b7ea-96c7143d47ea';
const SUNWEB_PROMOTED = 'D07B99C8-DFE0-4B7A-86C5-B4DE9A4C6077';
const SUNWEB_GATE = 'D7AF6C79-A074-4724-8595-F0A5DE507A04';
const ELIZA_CONTEXT = '29c6d01a-70c6-4297-9422-1c3dab8c94ad';
const ELIZA_PROMOTED = 'C6E4E13C-D74A-4A4D-BC6B-C151B6FF1E42';
const STALE_CONTEXT = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

function sunwebCtx(): SunwebLiveContext {
  return {
    accoId: '84012',
    landingUrl:
      'https://www.sunweb.be/nl/vakantie/griekenland/kos/kos-stad/appartementen-bristol-seaview' +
      '?Duration[0]=8&TransportType[0]=Flight&Mealplan[0]=LG' +
      '&DepartureAirport[0]=BRU&DepartureDate[0]=2026-09-26' +
      '&Participants[0][0]=1990-01-15&Participants[0][1]=1988-03-03' +
      '&Participants[1][0]=2014-06-14&Participants[1][1]=2018-01-22',
    feHost: SUNWEB_FE_HOST,
    query: {
      accoId: '84012',
      departureDate: '2026-09-26',
      departureAirport: 'BRU',
      duration: '8',
      mealplan: 'LG',
      transportType: 'Flight',
      month: '2026-09',
      participants: [
        { key: 'Participants[0][0]', value: '1990-01-15' },
        { key: 'Participants[0][1]', value: '1988-03-03' },
        { key: 'Participants[1][0]', value: '2014-06-14' },
        { key: 'Participants[1][1]', value: '2018-01-22' },
      ],
    },
  };
}

function elizaCtx(): ElizaLiveContext {
  return {
    accoId: '6270665',
    landingUrl:
      'https://www.elizawashere.be/spanje/andalusie/ronda/casita-paradise-island' +
      '?Duration[0]=8&TransportType[0]=Flight&Mealplan[0]=LG' +
      '&DepartureAirport[0]=BRU&DepartureDate[0]=2026-11-19' +
      '&Participants[0][0]=1996-07-30&Participants[0][1]=1996-07-30',
    feHost: ELIZA_FE_HOST,
    query: {
      accoId: '6270665',
      departureDate: '2026-11-19',
      departureAirport: 'BRU',
      duration: '8',
      mealplan: 'LG',
      transportType: 'Flight',
      month: '2026-11',
      participants: [
        { key: 'Participants[0][0]', value: '1996-07-30' },
        { key: 'Participants[0][1]', value: '1996-07-30' },
      ],
    },
  };
}

function sunwebFetch(options: {
  landingBody?: string;
  priceBody?: string;
  onLanding?: () => void;
  onPrice?: (url: string) => void;
  onGrouped?: () => void;
}): typeof fetch {
  return async (input) => {
    const url = String(input);
    if (url.includes('GetPromotedPriceApi')) {
      options.onPrice?.(url);
      return new Response(options.priceBody ?? okSunwebPromotedBody(), { status: 200 });
    }
    if (url.includes('GetPricesGroupedByDurationApi')) {
      options.onGrouped?.();
      return new Response(echoGroupedPricesFromUrl(url), { status: 200 });
    }
    options.onLanding?.();
    return new Response(options.landingBody ?? SUNWEB_LANDING_HTML, { status: 200 });
  };
}

function elizaFetch(options: {
  landingBody?: string;
  priceBody?: string;
  onLanding?: () => void;
  onPrice?: (url: string) => void;
}): typeof fetch {
  return async (input) => {
    const url = String(input);
    if (url.includes('GetPromotedPriceApi')) {
      options.onPrice?.(url);
      return new Response(options.priceBody ?? okElizaPromotedBody(), { status: 200 });
    }
    options.onLanding?.();
    return new Response(options.landingBody ?? ELIZA_LANDING_HTML, { status: 200 });
  };
}

test.beforeEach(() => {
  resetContextItemIdCacheForTests();
});

test('1. TTL is exactly the L3 10s window', () => {
  assert.equal(CONTEXT_ITEM_ID_CACHE_TTL_MS, 10_000);
});

test('2. cache stores contextItemId per acco; site GUIDs are config not per-acco', () => {
  setCachedContextItemId('sunweb', SUNWEB_FE_HOST, '84012', SUNWEB_CONTEXT);
  setSitecoreSiteGuidConfig('sunweb', {
    promotedPriceId: SUNWEB_PROMOTED,
    bookingGateId: SUNWEB_GATE,
  });
  assert.equal(getCachedContextItemId('sunweb', SUNWEB_FE_HOST, '84012'), SUNWEB_CONTEXT);
  assert.equal(getCachedContextItemId('sunweb', SUNWEB_FE_HOST, '99999'), undefined);
  const site = getSitecoreSiteGuidConfig('sunweb');
  assert.equal(site?.promotedPriceId, SUNWEB_PROMOTED);
  assert.equal(site?.bookingGateId, SUNWEB_GATE);
});

test('3. Eliza: second request within TTL skips landing HTML', async () => {
  let landingCalls = 0;
  let priceCalls = 0;
  const fetchImpl = elizaFetch({
    onLanding: () => {
      landingCalls += 1;
    },
    onPrice: () => {
      priceCalls += 1;
    },
  });

  const first = await fetchElizaPromotedPrice(elizaCtx(), { fetchImpl });
  const second = await fetchElizaPromotedPrice(elizaCtx(), { fetchImpl });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  if (first.ok && second.ok) {
    assert.equal(first.pricePerPerson, second.pricePerPerson);
  }
  assert.equal(landingCalls, 1);
  assert.equal(priceCalls, 2);
  const stats = getContextItemIdCacheStats();
  assert.equal(stats.hits, 1);
  assert.equal(stats.ttlMs, CONTEXT_ITEM_ID_CACHE_TTL_MS);
});

test('4. Sunweb: second request within TTL skips landing HTML (still live price)', async () => {
  let landingCalls = 0;
  let priceCalls = 0;
  const fetchImpl = sunwebFetch({
    onLanding: () => {
      landingCalls += 1;
    },
    onPrice: () => {
      priceCalls += 1;
    },
  });

  const first = await fetchSunwebPromotedPrice(sunwebCtx(), { fetchImpl });
  const second = await fetchSunwebPromotedPrice(sunwebCtx(), { fetchImpl });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(landingCalls, 1);
  assert.equal(priceCalls, 2);
});

test('5. expired contextItemId triggers fresh landing (never stale price)', async () => {
  let landingCalls = 0;
  const fetchImpl = elizaFetch({
    onLanding: () => {
      landingCalls += 1;
    },
  });

  setContextItemIdCacheNowMsForTests(1_000);
  await fetchElizaPromotedPrice(elizaCtx(), { fetchImpl });
  assert.equal(landingCalls, 1);

  setContextItemIdCacheNowMsForTests(1_000 + CONTEXT_ITEM_ID_CACHE_TTL_MS + 1);
  const second = await fetchElizaPromotedPrice(elizaCtx(), { fetchImpl });
  assert.equal(landingCalls, 2);
  assert.equal(second.ok, true);
});

test('6. stale_context from cached id → invalidate + fresh landing; no wrong price', async () => {
  let landingCalls = 0;
  let priceUrls: string[] = [];
  let priceRound = 0;

  // Seed cache with a wrong contextItemId + valid site config.
  setSitecoreSiteGuidConfig('eliza', { promotedPriceId: ELIZA_PROMOTED });
  setCachedContextItemId('eliza', ELIZA_FE_HOST, '6270665', STALE_CONTEXT);

  const freshHtml =
    JSON.stringify({ template: 'AccommodationPage', contextItemId: ELIZA_CONTEXT }) +
    `"PDP.promotedPriceId":"${ELIZA_PROMOTED}"`;

  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes('GetPromotedPriceApi')) {
      priceUrls.push(url);
      priceRound += 1;
      if (priceRound === 1) {
        // Cached STALE_CONTEXT produces mismatched trip → stale_context
        return new Response(
          okElizaPromotedBody({ accommodationId: 999, departureDate: '2026-12-01' }),
          { status: 200 },
        );
      }
      return new Response(okElizaPromotedBody(), { status: 200 });
    }
    landingCalls += 1;
    return new Response(freshHtml, { status: 200 });
  };

  const result = await fetchElizaPromotedPrice(elizaCtx(), { fetchImpl });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.pricePerPerson, 652);
    assert.equal(result.accoId, '6270665');
  }
  assert.equal(landingCalls, 1);
  assert.equal(priceUrls.length, 2);
  assert.ok(priceUrls[0]?.includes(STALE_CONTEXT));
  assert.ok(priceUrls[1]?.includes(ELIZA_CONTEXT));
  assert.equal(getContextItemIdCacheStats().landingFallbacks, 1);
});

test('7. after TTL expiry, cache miss does not reuse old id', () => {
  setContextItemIdCacheNowMsForTests(5_000);
  setCachedContextItemId('sunweb', SUNWEB_FE_HOST, '84012', SUNWEB_CONTEXT);
  assert.equal(getCachedContextItemId('sunweb', SUNWEB_FE_HOST, '84012'), SUNWEB_CONTEXT);

  setContextItemIdCacheNowMsForTests(5_000 + CONTEXT_ITEM_ID_CACHE_TTL_MS + 1);
  assert.equal(getCachedContextItemId('sunweb', SUNWEB_FE_HOST, '84012'), undefined);
});
