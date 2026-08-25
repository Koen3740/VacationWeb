import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CORENDON_IPV4_FETCH_HOSTS,
  nodeHttpToFetchResponse,
  shouldPreferIpv4Fetch,
} from '@/lib/http/prefer-ipv4';
import { fetchCorendonLowestpricesaccoPrice } from '@/lib/providers/corendon/lowestpricesacco-client';
import { CORENDON_FE_HOST } from '@/lib/providers/corendon/constants';

test('HTTP 204 from Corendon must not throw when wrapped as a Fetch Response', () => {
  const response = nodeHttpToFetchResponse(
    204,
    'No Content',
    new Headers({ 'content-type': 'application/json' }),
    Buffer.from(''),
  );
  assert.equal(response.status, 204);
  assert.equal(response.body, null);
});

test('HTTP 204 with leftover bytes still becomes a valid empty Fetch Response', () => {
  const response = nodeHttpToFetchResponse(
    204,
    'No Content',
    new Headers(),
    Buffer.from('not allowed'),
  );
  assert.equal(response.status, 204);
});

test('lowestpricesacco treats a wrapped 204 as empty, not as a thrown crash', async () => {
  const result = await fetchCorendonLowestpricesaccoPrice(
    {
      accommodationId: '9514',
      departureIso: '2026-08-27',
      feHost: CORENDON_FE_HOST,
      fragment: {
        raw: '9514.COSPY.BRUCFU.270826.3-4-3.SZ-U',
        hotelId: '9514',
        accommodationCode: 'COSPY',
        airportRoute: 'BRUCFU',
        dateYymmdd: '270826',
        durationNights: '3-4-3',
        roomBoard: 'SZ-U',
      },
    },
    {
      fetchImpl: async () =>
        nodeHttpToFetchResponse(204, 'No Content', new Headers(), Buffer.from('')),
    },
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.httpStatus, 204);
    assert.equal(result.reason, 'empty');
  }
});

test('Corendon image host uses the same IPv4 fetch path as the API host', () => {
  assert.equal(shouldPreferIpv4Fetch('api-fe.corendonresources.com'), true);
  assert.equal(shouldPreferIpv4Fetch('images.corendonresources.com'), true);
  assert.equal(shouldPreferIpv4Fetch('static.sunweb.be'), false);
  assert.equal(CORENDON_IPV4_FETCH_HOSTS.has('images.corendonresources.com'), true);
});

test('HTTP 200 JSON body is preserved', async () => {
  const response = nodeHttpToFetchResponse(
    200,
    'OK',
    new Headers({ 'content-type': 'application/json' }),
    Buffer.from('{"ok":true}'),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
});
