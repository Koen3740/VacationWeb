import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildOpsClientAuthHeaders } from './client-auth-headers';
import { extractOpsTokenFromRequest } from './auth';

test('without token: no auth headers', () => {
  assert.deepEqual(buildOpsClientAuthHeaders(''), {});
  assert.deepEqual(buildOpsClientAuthHeaders('?foo=bar'), {});
  assert.deepEqual(buildOpsClientAuthHeaders('period=24h'), {});
});

test('with token in querystring: Authorization Bearer header only', () => {
  const headers = buildOpsClientAuthHeaders('?token=ops-test-token&period=24h');
  assert.equal(Object.keys(headers).length, 1);
  assert.equal(headers.Authorization, 'Bearer ops-test-token');
});

test('Bearer header is accepted by extractOpsTokenFromRequest', () => {
  const headers = buildOpsClientAuthHeaders('?token=ops-test-token');
  const extracted = extractOpsTokenFromRequest({
    headers: { get: (name: string) => (name.toLowerCase() === 'authorization' ? headers.Authorization! : null) },
  });
  assert.equal(extracted, 'ops-test-token');
});

test('helper return value has no token field name leakage keys', () => {
  const headers = buildOpsClientAuthHeaders('?token=ops-test-token');
  assert.equal('token' in headers, false);
  assert.equal('x-ops-token' in headers, false);
});
