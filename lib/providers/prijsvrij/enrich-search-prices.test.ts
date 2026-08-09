import assert from 'node:assert/strict';
import test from 'node:test';
import type { TravelOffer } from '../../feeds/canonical/travel-offer';
import { clearPrijsvrijTokenCache, getPrijsvrijServiceToken } from './auth';
import { enrichPrijsvrijSearchPrices } from './enrich-search-prices';
import { extractPrijsvrijProductId } from './product-id';
import { findFilterValueByName, searchPrijsvrij } from './search-client';

function makeOffer(overrides: Partial<TravelOffer> & Pick<TravelOffer, 'id' | 'provider'>): TravelOffer {
  return {
    hotelName: 'Test Hotel',
    destinationCountry: 'Spanje',
    destinationRegion: 'Mallorca',
    departureDate: '2026-09-30',
    nights: 8,
    flightIncluded: 'true',
    price: 472,
    pricePerDay: 59,
    imageUrl: '',
    deepLink:
      'https://www.prijsvrij.be/vakantie/?r=https%3A%2F%2Fwww.prijsvrij.be%2Fvakanties%2Fspanje%2Fmallorca%2Fporto-cristo%2Fportodrach%3Fvertrekdatum%3D2026-09-30%26reisduurdagen%3D8%26transport%3Dvl',
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeJwt(expSecondsFromNow: number): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + expSecondsFromNow;
  const payload = Buffer.from(JSON.stringify({ exp })).toString('base64url');
  return `${header}.${payload}.sig`;
}

test('extractPrijsvrijProductId reads numeric product id from externalId', () => {
  assert.equal(
    extractPrijsvrijProductId('prijsvrij-446251-2026-09-30-8-472-HP'),
    '446251',
  );
  assert.equal(extractPrijsvrijProductId('sunweb-123'), null);
});

test('getPrijsvrijServiceToken reads token field and caches until near expiry', async () => {
  clearPrijsvrijTokenCache();
  let tokenCalls = 0;
  const token = makeJwt(3600);
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes('/token/service')) {
      tokenCalls += 1;
      return jsonResponse({ token });
    }
    throw new Error(`Unexpected URL ${url}`);
  };

  const first = await getPrijsvrijServiceToken(fetchImpl);
  const second = await getPrijsvrijServiceToken(fetchImpl);
  assert.equal(first, token);
  assert.equal(second, token);
  assert.equal(tokenCalls, 1);
});

test('getPrijsvrijServiceToken fails on token endpoint error', async () => {
  clearPrijsvrijTokenCache();
  const fetchImpl: typeof fetch = async () => jsonResponse({ error: true }, 500);
  await assert.rejects(() => getPrijsvrijServiceToken(fetchImpl), /HTTP 500/);
});

test('searchPrijsvrij sends Bearer + X-Portal and returns List', async () => {
  const fetchImpl: typeof fetch = async (input, init) => {
    assert.match(String(input), /\/api\/v1\/search\/10\/1$/);
    const headers = new Headers(init?.headers);
    assert.equal(headers.get('Authorization'), 'Bearer test-token');
    assert.equal(headers.get('X-Portal'), 'prijsvrij.be');
    return jsonResponse({
      List: [{ Id: '446251', Price: 381, Name: 'Portodrach' }],
      TotalFound: 1,
      Filters: [],
    });
  };

  const result = await searchPrijsvrij(
    'test-token',
    {
      filters: [{ Type: 20, UrlName: 'reisduurdagen', Value: '8' }],
      currentUrl: 'https://www.prijsvrij.be/vakanties',
    },
    { pageSize: 10, page: 1, fetchImpl },
  );

  assert.equal(result.List?.[0]?.Id, '446251');
  assert.equal(result.List?.[0]?.Price, 381);
});

test('findFilterValueByName resolves land/regio Values', () => {
  const value = findFilterValueByName(
    [
      {
        UrlName: 'land',
        Items: [{ Name: 'Spanje', Value: '108' }],
      },
    ],
    'land',
    'Spanje',
  );
  assert.equal(value, '108');
});

test('enrichPrijsvrijSearchPrices maps List[].Price on Id match', async () => {
  clearPrijsvrijTokenCache();
  const token = makeJwt(3600);
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.includes('/token/service')) {
      return jsonResponse({ token });
    }

    const body = JSON.parse(String(init?.body ?? '{}')) as {
      filters?: Array<{ UrlName: string; Value: string }>;
    };
    const hasLand = body.filters?.some((f) => f.UrlName === 'land' && f.Value === '108');
    const hasRegio = body.filters?.some((f) => f.UrlName === 'regio' && f.Value === '204');

    if (hasLand && hasRegio) {
      return jsonResponse({
        List: [{ Id: '446251', Price: 381 }],
        TotalFound: 1,
        Filters: [],
      });
    }

    return jsonResponse({
      List: [],
      TotalFound: 10,
      Filters: [
        { UrlName: 'land', Items: [{ Name: 'Spanje', Value: '108' }] },
        { UrlName: 'regio', Items: [{ Name: 'Mallorca', Value: '204' }] },
      ],
    });
  };

  const offers = [
    makeOffer({
      id: 'prijsvrij-446251-2026-09-30-8-472-HP',
      provider: 'Prijsvrij',
      price: 472,
    }),
    makeOffer({
      id: 'sunweb-999',
      provider: 'Sunweb',
      price: 500,
      destinationCountry: 'Spanje',
      destinationRegion: 'Mallorca',
    }),
  ];

  const enriched = await enrichPrijsvrijSearchPrices(offers, { fetchImpl });
  assert.equal(enriched[0].price, 381);
  assert.equal(enriched[0].pricePerDay, Math.round(381 / 8));
  assert.equal(enriched[1].price, 500);
});

test('enrichPrijsvrijSearchPrices keeps feed price when no Id match', async () => {
  clearPrijsvrijTokenCache();
  const token = makeJwt(3600);
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes('/token/service')) {
      return jsonResponse({ token });
    }
    return jsonResponse({
      List: [{ Id: '999999', Price: 100 }],
      TotalFound: 1,
      Filters: [
        { UrlName: 'land', Items: [{ Name: 'Spanje', Value: '108' }] },
        { UrlName: 'regio', Items: [{ Name: 'Mallorca', Value: '204' }] },
      ],
    });
  };

  const offers = [
    makeOffer({
      id: 'prijsvrij-446251-2026-09-30-8-472-HP',
      provider: 'Prijsvrij',
      price: 472,
    }),
  ];

  const enriched = await enrichPrijsvrijSearchPrices(offers, { fetchImpl });
  assert.equal(enriched[0].price, 472);
});

test('enrichPrijsvrijSearchPrices keeps feed price when Price missing', async () => {
  clearPrijsvrijTokenCache();
  const token = makeJwt(3600);
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.includes('/token/service')) {
      return jsonResponse({ token });
    }
    const body = JSON.parse(String(init?.body ?? '{}')) as {
      filters?: Array<{ UrlName: string; Value: string }>;
    };
    const scoped = body.filters?.some((f) => f.UrlName === 'regio');
    if (scoped) {
      return jsonResponse({
        List: [{ Id: '446251', Name: 'Portodrach' }],
        TotalFound: 1,
        Filters: [],
      });
    }
    return jsonResponse({
      List: [],
      TotalFound: 1,
      Filters: [
        { UrlName: 'land', Items: [{ Name: 'Spanje', Value: '108' }] },
        { UrlName: 'regio', Items: [{ Name: 'Mallorca', Value: '204' }] },
      ],
    });
  };

  const offers = [
    makeOffer({
      id: 'prijsvrij-446251-2026-09-30-8-472-HP',
      provider: 'Prijsvrij',
      price: 472,
    }),
  ];

  const enriched = await enrichPrijsvrijSearchPrices(offers, { fetchImpl });
  assert.equal(enriched[0].price, 472);
});

test('enrichPrijsvrijSearchPrices falls back on token/API error', async () => {
  clearPrijsvrijTokenCache();
  const fetchImpl: typeof fetch = async () => jsonResponse({ error: true }, 401);
  const offers = [
    makeOffer({
      id: 'prijsvrij-446251-2026-09-30-8-472-HP',
      provider: 'Prijsvrij',
      price: 472,
    }),
  ];
  const enriched = await enrichPrijsvrijSearchPrices(offers, { fetchImpl });
  assert.equal(enriched[0].price, 472);
});

test('enrichPrijsvrijSearchPrices falls back on timeout', async () => {
  clearPrijsvrijTokenCache();
  const fetchImpl: typeof fetch = async () => {
    const error = new Error('Aborted');
    error.name = 'TimeoutError';
    throw error;
  };
  const offers = [
    makeOffer({
      id: 'prijsvrij-446251-2026-09-30-8-472-HP',
      provider: 'Prijsvrij',
      price: 472,
    }),
  ];
  const enriched = await enrichPrijsvrijSearchPrices(offers, { fetchImpl });
  assert.equal(enriched[0].price, 472);
});

test('non-Prijsvrij providers remain unchanged when enrichment runs', async () => {
  clearPrijsvrijTokenCache();
  const offers = [
    makeOffer({
      id: 'corendon-1',
      provider: 'Corendon',
      price: 600,
    }),
    makeOffer({
      id: 'sunweb-1',
      provider: 'Sunweb',
      price: 700,
    }),
  ];

  let fetchCalled = false;
  const fetchImpl: typeof fetch = async () => {
    fetchCalled = true;
    return jsonResponse({ token: makeJwt(3600) });
  };

  const enriched = await enrichPrijsvrijSearchPrices(offers, { fetchImpl });
  assert.equal(fetchCalled, false);
  assert.equal(enriched[0].price, 600);
  assert.equal(enriched[1].price, 700);
});
