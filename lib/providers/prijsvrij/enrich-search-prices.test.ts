import assert from 'node:assert/strict';
import test from 'node:test';
import type { TravelOffer } from '../../feeds/canonical/travel-offer';
import { clearPrijsvrijTokenCache, getPrijsvrijServiceToken } from './auth';
import {
  enrichPrijsvrijSearchPrices,
  type EnrichPrijsvrijRequestStats,
} from './enrich-search-prices';
import { extractPrijsvrijProductId } from './product-id';
import { findFilterValueByName, searchPrijsvrij } from './search-client';

function emptyRequestStats(): EnrichPrijsvrijRequestStats {
  return {
    offerCount: 0,
    uniqueAtomicContexts: 0,
    destinationSearchFlows: 0,
    searchHttpRequests: 0,
  };
}

function bootstrapFiltersResponse(): Response {
  return jsonResponse({
    List: [],
    TotalFound: 10,
    Filters: [
      { UrlName: 'land', Items: [{ Name: 'Spanje', Value: '108' }] },
      { UrlName: 'regio', Items: [{ Name: 'Mallorca', Value: '204' }] },
    ],
  });
}

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
  const token = makeJwt(3600);
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes('/token/service')) {
      return jsonResponse({ token });
    }
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
  const retryStats = {
    groupTimeoutRetries: 0,
    groupTimeoutRetrySuccesses: 0,
    groupTimeoutRetryFailures: 0,
  };
  const enriched = await enrichPrijsvrijSearchPrices(offers, { fetchImpl, retryStats });
  assert.equal(enriched[0].price, 472);
  assert.equal(retryStats.groupTimeoutRetries, 1);
  assert.equal(retryStats.groupTimeoutRetryFailures, 1);
  assert.equal(retryStats.groupTimeoutRetrySuccesses, 0);
});

test('enrichPrijsvrijSearchPrices retries once on TimeoutError and applies Search price', async () => {
  clearPrijsvrijTokenCache();
  const token = makeJwt(3600);
  let destinationCalls = 0;
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
      destinationCalls += 1;
      if (destinationCalls === 1) {
        const error = new Error('Aborted');
        error.name = 'TimeoutError';
        throw error;
      }
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

  const retryStats = {
    groupTimeoutRetries: 0,
    groupTimeoutRetrySuccesses: 0,
    groupTimeoutRetryFailures: 0,
  };
  const enriched = await enrichPrijsvrijSearchPrices(
    [
      makeOffer({
        id: 'prijsvrij-446251-2026-09-30-8-472-HP',
        provider: 'Prijsvrij',
        price: 472,
      }),
    ],
    { fetchImpl, retryStats },
  );

  assert.equal(enriched[0].price, 381);
  assert.equal(destinationCalls, 2);
  assert.equal(retryStats.groupTimeoutRetries, 1);
  assert.equal(retryStats.groupTimeoutRetrySuccesses, 1);
  assert.equal(retryStats.groupTimeoutRetryFailures, 0);
});

test('enrichPrijsvrijSearchPrices isolates timeout to one Search-group', async () => {
  clearPrijsvrijTokenCache();
  const token = makeJwt(3600);
  let mallorcaCalls = 0;
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.includes('/token/service')) {
      return jsonResponse({ token });
    }

    const body = JSON.parse(String(init?.body ?? '{}')) as {
      filters?: Array<{ UrlName: string; Value: string }>;
    };
    const filters = body.filters ?? [];
    const land = filters.find((f) => f.UrlName === 'land')?.Value;
    const regio = filters.find((f) => f.UrlName === 'regio')?.Value;
    const date = filters.find((f) => f.UrlName === 'vertrekdatum')?.Value;

    // Istanbul group times out once destination-scoped search runs.
    if (date === '2026-08-29' && land === '120' && regio === '999') {
      const error = new Error('Aborted');
      error.name = 'TimeoutError';
      throw error;
    }

    if (land === '108' && regio === '204') {
      mallorcaCalls += 1;
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
        { UrlName: 'land', Items: [
          { Name: 'Spanje', Value: '108' },
          { Name: 'Turkije', Value: '120' },
        ] },
        { UrlName: 'regio', Items: [
          { Name: 'Mallorca', Value: '204' },
          { Name: 'Istanbul', Value: '999' },
        ] },
      ],
    });
  };

  const offers = [
    makeOffer({
      id: 'prijsvrij-446251-2026-09-30-8-472-HP',
      provider: 'Prijsvrij',
      price: 472,
      departureDate: '2026-09-30',
      destinationCountry: 'Spanje',
      destinationRegion: 'Mallorca',
    }),
    makeOffer({
      id: 'prijsvrij-221-2026-08-29-8-662-LO',
      provider: 'Prijsvrij',
      price: 662,
      departureDate: '2026-08-29',
      destinationCountry: 'Turkije',
      destinationRegion: 'Istanbul',
      deepLink:
        'https://www.prijsvrij.be/vakantie/?r=https%3A%2F%2Fwww.prijsvrij.be%2Fvakanties%2Fturkije%2Fistanbul%2Fx%3Fvertrekdatum%3D2026-08-29%26reisduurdagen%3D8%26transport%3Dvl',
    }),
  ];

  const enriched = await enrichPrijsvrijSearchPrices(offers, { fetchImpl });
  assert.equal(enriched[0].price, 381);
  assert.equal(enriched[1].price, 662);
  assert.ok(mallorcaCalls >= 1);
});

test('enrichPrijsvrijSearchPrices paginates until TotalFound is covered', async () => {
  clearPrijsvrijTokenCache();
  const token = makeJwt(3600);
  const pagesSeen: number[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.includes('/token/service')) {
      return jsonResponse({ token });
    }

    const pageMatch = /\/search\/100\/(\d+)$/.exec(url);
    if (pageMatch) {
      const page = Number(pageMatch[1]);
      pagesSeen.push(page);
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        filters?: Array<{ UrlName: string; Value: string }>;
      };
      const scoped = body.filters?.some((f) => f.UrlName === 'regio' && f.Value === '204');
      if (scoped) {
        if (page < 3) {
          return jsonResponse({
            List: Array.from({ length: 100 }, (_, i) => ({
              Id: String(1000 + (page - 1) * 100 + i),
              Price: 100,
            })),
            TotalFound: 250,
            Filters: [],
          });
        }
        return jsonResponse({
          List: [
            ...Array.from({ length: 49 }, (_, i) => ({
              Id: String(1200 + i),
              Price: 100,
            })),
            { Id: '446251', Price: 381 },
          ],
          TotalFound: 250,
          Filters: [],
        });
      }
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
  ];

  const enriched = await enrichPrijsvrijSearchPrices(offers, { fetchImpl });
  assert.equal(enriched[0].price, 381);
  assert.deepEqual(pagesSeen, [1, 2, 3]);
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

test('Strategy D: 10 offers with identical atomic context use one destination Search-flow', async () => {
  clearPrijsvrijTokenCache();
  const token = makeJwt(3600);
  let destinationFlows = 0;
  let destinationPages = 0;

  const list = Array.from({ length: 10 }, (_, i) => ({
    Id: String(446250 + i),
    Price: 300 + i,
  }));

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
      destinationFlows += 1;
      if (/\/search\/100\//.test(url)) {
        destinationPages += 1;
      }
      return jsonResponse({
        List: list,
        TotalFound: list.length,
        Filters: [],
      });
    }

    return bootstrapFiltersResponse();
  };

  const offers = Array.from({ length: 10 }, (_, i) =>
    makeOffer({
      id: `prijsvrij-${446250 + i}-2026-09-30-8-${400 + i}-HP`,
      provider: 'Prijsvrij',
      price: 400 + i,
    }),
  );

  const requestStats = emptyRequestStats();
  const enriched = await enrichPrijsvrijSearchPrices(offers, { fetchImpl, requestStats });

  assert.equal(destinationFlows, 1);
  assert.equal(destinationPages, 1);
  assert.equal(requestStats.offerCount, 10);
  assert.equal(requestStats.uniqueAtomicContexts, 1);
  assert.equal(requestStats.destinationSearchFlows, 1);
  for (let i = 0; i < 10; i += 1) {
    assert.equal(enriched[i].price, 300 + i);
  }
});

test('Strategy D: 10 offers with different atomic contexts use at most 10 destination Search-flows', async () => {
  clearPrijsvrijTokenCache();
  const token = makeJwt(3600);
  let destinationFlows = 0;

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
    const date = body.filters?.find((f) => f.UrlName === 'vertrekdatum')?.Value;

    if (hasLand && hasRegio && date) {
      destinationFlows += 1;
      const day = date.slice(-2);
      const id = `4462${day}`;
      return jsonResponse({
        List: [{ Id: id, Price: 350 + Number(day) }],
        TotalFound: 1,
        Filters: [],
      });
    }

    return bootstrapFiltersResponse();
  };

  const offers = Array.from({ length: 10 }, (_, i) => {
    const day = String(i + 1).padStart(2, '0');
    const departureDate = `2026-10-${day}`;
    return makeOffer({
      id: `prijsvrij-4462${day}-${departureDate}-8-400-HP`,
      provider: 'Prijsvrij',
      price: 400,
      departureDate,
      deepLink:
        `https://www.prijsvrij.be/vakantie/?r=https%3A%2F%2Fwww.prijsvrij.be%2Fvakanties%2Fspanje%2Fmallorca%2Fx%3Fvertrekdatum%3D${departureDate}%26reisduurdagen%3D8%26transport%3Dvl`,
    });
  });

  const requestStats = emptyRequestStats();
  const enriched = await enrichPrijsvrijSearchPrices(offers, { fetchImpl, requestStats });

  assert.equal(destinationFlows, 10);
  assert.ok(destinationFlows <= 10);
  assert.equal(requestStats.offerCount, 10);
  assert.equal(requestStats.uniqueAtomicContexts, 10);
  assert.equal(requestStats.destinationSearchFlows, 10);
  for (let i = 0; i < 10; i += 1) {
    const day = i + 1;
    assert.equal(enriched[i].price, 350 + day);
  }
});

test('Strategy D: Id→Price map is reused for multiple offers in one atomic context', async () => {
  clearPrijsvrijTokenCache();
  const token = makeJwt(3600);
  let destinationListBuilds = 0;

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
      destinationListBuilds += 1;
      return jsonResponse({
        List: [
          { Id: '111', Price: 501 },
          { Id: '222', Price: 502 },
          { Id: '333', Price: 503 },
        ],
        TotalFound: 3,
        Filters: [],
      });
    }

    return bootstrapFiltersResponse();
  };

  const offers = [
    makeOffer({ id: 'prijsvrij-111-2026-09-30-8-900-HP', provider: 'Prijsvrij', price: 900 }),
    makeOffer({ id: 'prijsvrij-222-2026-09-30-8-900-HP', provider: 'Prijsvrij', price: 900 }),
    makeOffer({ id: 'prijsvrij-333-2026-09-30-8-900-HP', provider: 'Prijsvrij', price: 900 }),
  ];

  const enriched = await enrichPrijsvrijSearchPrices(offers, { fetchImpl });
  assert.equal(destinationListBuilds, 1);
  assert.equal(enriched[0].price, 501);
  assert.equal(enriched[1].price, 502);
  assert.equal(enriched[2].price, 503);
});
