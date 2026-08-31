import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGenerationId, utcCompactTimestamp } from './generation-id';
import { buildGenerationArtifacts } from './build-generation-artifacts';
import { validateGenerationArtifacts } from './validate-generation';
import { buildCurrentPointer } from './generation-paths';
import type { StoredOffer } from '../feeds/types/stored-offer';

function offer(overrides: Partial<StoredOffer> = {}): StoredOffer {
  return {
    externalId: 'eliza-6270665',
    provider: 'Eliza was here',
    hotelName: 'Test Eliza',
    country: 'Griekenland',
    nights: 7,
    price: 300,
    deepLink: 'https://www.elizawashere.be/x',
    imageUrl: 'https://example.com/a.jpg',
    searchText: 'test eliza hotel griekenland',
    ...overrides,
  };
}

test('generation id is g{UTC}-{12 hex of catalog sha256}', () => {
  const date = new Date('2026-08-21T14:21:58.000Z');
  assert.equal(utcCompactTimestamp(date), '20260821T142158Z');
  const id = buildGenerationId('{"ok":true}', date);
  assert.match(id, /^g20260821T142158Z-[0-9a-f]{12}$/);
});

test('generation artifacts are 1:1 and write empty details as {}', () => {
  const artifacts = buildGenerationArtifacts(
    [offer(), offer({ externalId: 'eliza-111', hotelName: 'Other' })],
    {
      'eliza-6270665': { descriptionLong: 'Lang' },
    },
    new Date('2026-08-21T14:21:58.000Z'),
  );
  assert.equal(artifacts.catalog.length, 2);
  assert.equal(artifacts.details.length, 2);
  const empty = artifacts.details.find((item) => item.externalId === 'eliza-111');
  assert.equal(empty?.body, '{}');
  const issues = validateGenerationArtifacts(artifacts);
  assert.deepEqual(issues, []);
  assert.equal(artifacts.detailsIndex.generationId, artifacts.generationId);
});

test('current.json pointer stays small and generation-scoped', () => {
  const pointer = buildCurrentPointer('g20260821T142158Z-aaaaaaaaaaaa');
  assert.equal(pointer.schemaVersion, 1);
  assert.equal(pointer.catalogKey, 'generations/g20260821T142158Z-aaaaaaaaaaaa/catalog.json');
  assert.ok(JSON.stringify(pointer).length < 1000);
});

test('validation detects duplicate canonical identities', () => {
  const artifacts = buildGenerationArtifacts(
    [offer()],
    {},
    new Date('2026-08-21T14:21:58.000Z'),
  );
  artifacts.catalog.push({ ...artifacts.catalog[0], externalId: 'eliza-999' });
  artifacts.detailsIndex.byExternalId['eliza-999'] = artifacts.detailsIndex.byExternalId['eliza-6270665'];
  const issues = validateGenerationArtifacts(artifacts);
  assert.ok(issues.some((item) => item.code === 'duplicate_canonicalOfferIdentity'));
});
