import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildElizaPromotedPriceUrl,
  extractElizaLandingGuids,
  fetchElizaPromotedPrice,
} from './promoted-price-client';
import type { ElizaLiveContext } from './offer-context';
import { ELIZA_FE_HOST } from './constants';

const CONTEXT_ITEM_ID = '29c6d01a-70c6-4297-9422-1c3dab8c94ad';
const PROMOTED_PRICE_ID = 'C6E4E13C-D74A-4A4D-BC6B-C151B6FF1E42';

export const ELIZA_LANDING_HTML = JSON.stringify({
  template: 'AccommodationPage',
  contextItemId: CONTEXT_ITEM_ID,
}) + `"PDP.promotedPriceId":"${PROMOTED_PRICE_ID}"`;

function ctx(): ElizaLiveContext {
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

export function okPromotedBody(overrides: {
  averagePrice?: number;
  totalPrice?: number;
  accommodationId?: number | string;
  duration?: number;
  departureDate?: string;
  mealplan?: string;
} = {}): string {
  return JSON.stringify({
    accommodationId: overrides.accommodationId ?? 6270665,
    duration: overrides.duration ?? 8,
    price: {
      totalPrice: overrides.totalPrice ?? 1304,
      averagePrice: overrides.averagePrice ?? 652,
      value: overrides.averagePrice ?? 652,
      legend: 'Vanafprijs p.p.',
    },
    departureDate: { raw: overrides.departureDate ?? '2026-11-19' },
    featuredFilters: ['8 dagen', '2 personen', 'Logies'],
    acmInformation: {
      mealplanCode: overrides.mealplan ?? 'LG',
    },
  });
}

function makeFetch(options: {
  landingStatus?: number;
  landingBody?: string;
  priceStatus?: number;
  priceBody?: string | null;
  onLanding?: (url: string) => void;
  onPrice?: (url: string) => void;
}): typeof fetch {
  return async (input) => {
    const url = String(input);
    if (url.includes('GetPromotedPriceApi')) {
      options.onPrice?.(url);
      const status = options.priceStatus ?? 200;
      if (status === 204) {
        return new Response(null, { status: 204 });
      }
      return new Response(options.priceBody ?? okPromotedBody(), { status });
    }
    options.onLanding?.(url);
    const status = options.landingStatus ?? 200;
    return new Response(options.landingBody ?? ELIZA_LANDING_HTML, { status });
  };
}

test('extractElizaLandingGuids: AccommodationPage contextItemId + PDP.promotedPriceId', () => {
  const guids = extractElizaLandingGuids(ELIZA_LANDING_HTML);
  assert.ok(guids);
  assert.equal(guids.contextItemId, CONTEXT_ITEM_ID);
  assert.equal(guids.promotedPriceId, PROMOTED_PRICE_ID);
  assert.equal(extractElizaLandingGuids('<html></html>'), null);
});

test('buildElizaPromotedPriceUrl: proven query shape', () => {
  const url = new URL(
    buildElizaPromotedPriceUrl(ctx(), {
      contextItemId: CONTEXT_ITEM_ID,
      promotedPriceId: PROMOTED_PRICE_ID,
    }),
  );
  assert.equal(url.hostname, ELIZA_FE_HOST);
  assert.equal(url.pathname, '/api/sitecore/PromotedPrice/GetPromotedPriceApi');
  assert.equal(url.searchParams.get('accoId'), '6270665');
  assert.equal(url.searchParams.get('DepartureAirport[0]'), 'BRU');
  assert.equal(url.searchParams.get('DepartureDate[0]'), '2026-11-19');
  assert.equal(url.searchParams.get('Duration[0]'), '8');
  assert.equal(url.searchParams.get('Mealplan'), 'LG');
  assert.equal(url.searchParams.get('TransportType'), 'Flight');
  assert.equal(url.searchParams.get('Month'), '2026-11');
  assert.equal(url.searchParams.get('Participants[0][0]'), '1996-07-30');
  assert.equal(url.searchParams.get('Participants[0][1]'), '1996-07-30');
  assert.equal(url.searchParams.get('contextItemId'), CONTEXT_ITEM_ID);
  assert.equal(url.searchParams.get('promotedPriceId'), PROMOTED_PRICE_ID);
});

test('fetch: landing + PromotedPrice success uses averagePrice, not feed', async () => {
  let landingCalls = 0;
  let priceCalls = 0;
  const result = await fetchElizaPromotedPrice(ctx(), {
    fetchImpl: makeFetch({
      onLanding: () => {
        landingCalls += 1;
      },
      onPrice: () => {
        priceCalls += 1;
      },
    }),
  });
  assert.equal(landingCalls, 1);
  assert.equal(priceCalls, 1);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.pricePerPerson, 652);
    assert.equal(result.totalPrice, 1304);
    assert.equal(result.accoId, '6270665');
  }
});

test('fetch: HTTP 204 is empty, not a feed price', async () => {
  const result = await fetchElizaPromotedPrice(ctx(), {
    fetchImpl: makeFetch({ priceStatus: 204 }),
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, 'empty');
    assert.equal(result.httpStatus, 204);
  }
});

test('fetch: API failure does not invent a price', async () => {
  const result = await fetchElizaPromotedPrice(ctx(), {
    fetchImpl: makeFetch({ priceStatus: 500 }),
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, 'http_error');
  }
});

test('fetch: acco/date/duration/meal mismatch is stale_context', async () => {
  const result = await fetchElizaPromotedPrice(ctx(), {
    fetchImpl: makeFetch({
      priceBody: okPromotedBody({ accommodationId: 999, departureDate: '2026-12-01' }),
    }),
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, 'stale_context');
  }
});

test('fetch: missing landing GUIDs does not call a fake price', async () => {
  let priceCalls = 0;
  const result = await fetchElizaPromotedPrice(ctx(), {
    fetchImpl: makeFetch({
      landingBody: '<html>no guids</html>',
      onPrice: () => {
        priceCalls += 1;
      },
    }),
  });
  assert.equal(priceCalls, 0);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, 'missing_page_context');
  }
});

test('fetch: zero/invalid PromotedPrice is not presentable', async () => {
  const result = await fetchElizaPromotedPrice(ctx(), {
    fetchImpl: makeFetch({ priceBody: okPromotedBody({ averagePrice: 0 }) }),
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, 'invalid_price');
  }
});
