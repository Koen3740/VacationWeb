/**
 * P3 Destination Media → Discover teaser resolve tests.
 * Run: node --import tsx  OR via scripts/run-p3-destination-media-test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { loadDestinationMediaPool } from './load-destination-media-pool';
import { listFinalVerifiedUsableAssets } from './list-final-verified-usable';
import { selectDiscoverTeaserAsset } from './select-discover-teaser-asset';
import { resolveDiscoverImageSrc } from './resolve-discover-image-src';
import { ensureVerifiedWebPath } from './ensure-verified-web-path';

const root = process.cwd();

describe('P3 Destination Media Discover resolve', () => {
  it('loads albania pool with FINAL assets', () => {
    const pool = loadDestinationMediaPool('albania', { root });
    assert.ok(pool);
    assert.equal(pool!.destinationId, 'albania');
    const finals = listFinalVerifiedUsableAssets(pool!, { root });
    assert.ok(finals.length >= 1);
    assert.ok(finals.every((a) => a.destinationId === 'albania'));
    assert.ok(finals.every((a) => a.pipelineStatus === 'FINAL_VERIFIED_USABLE'));
  });

  it('never returns cross-destination teaser', () => {
    const crete = selectDiscoverTeaserAsset('crete', { root });
    assert.ok(crete);
    assert.equal(crete!.destinationId, 'crete');
    assert.ok(!crete!.assetId.includes('sardinia'));
    assert.ok(!crete!.assetId.includes('albania'));
  });

  it('prefers documented albania teaser asset', () => {
    const a = selectDiscoverTeaserAsset('albania', { root });
    assert.ok(a);
    assert.equal(
      a!.assetId,
      'vw-story-albania-gjirokaster-cityscape-pudelek-fp',
    );
  });

  it('resolveDiscoverImageSrc returns verified URL for four destinations', () => {
    const ids = ['albania', 'sicily', 'crete', 'sardinia'] as const;
    for (const id of ids) {
      const seed = `/images/wow-ssot/discover-${id}.jpg`;
      const src = resolveDiscoverImageSrc(id, seed, { root });
      assert.ok(
        src.startsWith(`/images/verified/${id}/`),
        `${id} expected verified path, got ${src}`,
      );
      assert.notEqual(src, seed);
      const abs = path.join(root, 'public', ...src.split('/').filter(Boolean));
      assert.ok(existsSync(abs), `missing file for ${src}`);
    }
  });

  it('falls back to seed when destination pool missing', () => {
    const seed = '/images/wow-ssot/discover-albania.jpg';
    const src = resolveDiscoverImageSrc('no-such-destination', seed, { root });
    assert.equal(src, seed);
  });
});
