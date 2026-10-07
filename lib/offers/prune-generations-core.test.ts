/**
 * t364u: generation pruner (dry-run by default). No network: in-memory storage / fake S3 client.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  DEFAULT_MIN_AGE_HOURS,
  DELETE_BATCH_SIZE,
  PruneStopError,
  formatPruneReport,
  groupGenerations,
  parseGenerationId,
  parseGenerationObjectKey,
  planPrune,
  runPrune,
  type PruneObject,
  type PruneStorage,
} from './prune-generations-core';
import { MAX_LIST_PAGES, createR2PruneStorage } from './prune-generations-r2';

const HOUR = 3_600_000;
const NOW = new Date('2026-10-20T12:00:00.000Z');
const ID_A = 'g20260825T212627Z-15461c0bf7ce'; // oldest
const ID_B = 'g20260923T180604Z-194bba487486';
const ID_C = 'g20261001T132455Z-a8b4ff889c90';
const ID_D = 'g20261010T100000Z-0123456789ab'; // newest

function hoursAgo(h: number): Date {
  return new Date(NOW.getTime() - h * HOUR);
}

function pointerJson(id: string, updatedAt: string): string {
  const p = `generations/${id}/`;
  return JSON.stringify({
    schemaVersion: 1,
    generationId: id,
    catalogKey: `${p}catalog.json`,
    detailsPrefix: `${p}details/`,
    filterOptionsKey: `${p}filter-options.json`,
    updatedAt,
    catalogShards: [{ provider: 'Corendon', slug: 'corendon', key: `${p}shards/corendon.json` }],
  });
}

type Entry = { size: number; lastModified: Date; body?: string };

class MockBucket {
  entries = new Map<string, Entry>();
  deleteCalls: string[][] = [];
  getCalls: string[] = [];
  listCalls = 0;
  /** true = like real S3 (only keys under the prefix); false = misbehaving list returning EVERYTHING */
  honorPrefix = true;
  truncated = false;
  onCurrentRead?: (n: number) => string | null;
  currentReads = 0;

  put(key: string, size = 10, lastModified = hoursAgo(1000), body?: string) {
    this.entries.set(key, { size, lastModified, body });
  }

  addGeneration(id: string, opts: { details?: number; complete?: boolean; ageHours?: number; manifest?: boolean } = {}) {
    const age = opts.ageHours ?? 2000;
    const details = opts.details ?? 3;
    const base = `generations/${id}/`;
    this.put(`${base}catalog.json`, 100, hoursAgo(age));
    this.put(`${base}filter-options.json`, 20, hoursAgo(age));
    this.put(`${base}details-index.json`, 30, hoursAgo(age));
    this.put(`${base}shards/corendon.json`, 50, hoursAgo(age));
    for (let i = 0; i < details; i += 1) {
      this.put(`${base}details/corendon/${i.toString(16).padStart(64, '0')}.json`, 5, hoursAgo(age));
    }
    if (opts.manifest !== false) {
      this.put(
        `${base}manifest.json`,
        40,
        hoursAgo(age),
        JSON.stringify({ schemaVersion: 1, generationId: id, status: opts.complete === false ? 'incomplete' : 'complete' }),
      );
    }
  }

  addProtected() {
    this.put('current.json', 300, hoursAgo(1), 'ignored');
    this.put('offers.json', 1000);
    this.put('offers.detail.json', 1000);
    this.put('live-price/v1/abc.json', 10);
    this.put('live-price/v1/lock/abc.json', 1);
    this.put('backups/pre-sub19/20260825T211242Z/offers.json', 1000);
    this.put('backups/cutover/20260923T180604Z/rollback.json', 10);
    this.put('feeds/tradetracker/corendon.xml', 10);
  }

  storage(currentJson: string | null): PruneStorage {
    return {
      listGenerationObjects: async () => {
        this.listCalls += 1;
        const objects: PruneObject[] = [];
        for (const [key, e] of this.entries) {
          if (this.honorPrefix && !key.startsWith('generations/')) continue;
          objects.push({ key, size: e.size, lastModified: e.lastModified });
        }
        return { objects, truncated: this.truncated };
      },
      getText: async (key: string) => {
        this.getCalls.push(key);
        if (key === 'current.json') {
          this.currentReads += 1;
          if (this.onCurrentRead) return this.onCurrentRead(this.currentReads);
          return currentJson;
        }
        return this.entries.get(key)?.body ?? null;
      },
      deleteObjects: async (keys: string[]) => {
        this.deleteCalls.push([...keys]);
        for (const key of keys) this.entries.delete(key);
        return { deleted: keys.length, errors: [] };
      },
    };
  }

  deletedKeys(): string[] {
    return this.deleteCalls.flat();
  }
}

/** A(oldest) B C(current) D(newer) style fixture */
function fixture(currentId: string, ids: string[], pointerAgeHours = 1000) {
  const bucket = new MockBucket();
  for (const id of ids) bucket.addGeneration(id);
  bucket.addProtected();
  const current = pointerJson(currentId, hoursAgo(pointerAgeHours).toISOString());
  return { bucket, current, storage: bucket.storage(current) };
}

async function stopCode(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    assert.ok(error instanceof PruneStopError, `expected PruneStopError, got ${String(error)}`);
    return error.code;
  }
  assert.fail('expected a STOP');
}

test('constants: default min-age is 48 h (Koen-besluit t366u) and batch size is below the S3 limit', () => {
  assert.equal(DEFAULT_MIN_AGE_HOURS, 48);
  assert.ok(DELETE_BATCH_SIZE > 0 && DELETE_BATCH_SIZE <= 1000);
});

test('generation id parsing: strict pattern, real UTC date, key layout', () => {
  assert.ok(parseGenerationId(ID_A));
  assert.equal(parseGenerationId('g20261301T000000Z-0123456789ab'), null);
  assert.equal(parseGenerationId('g20260101T000000Z-0123456789AB'), null);
  assert.equal(parseGenerationId('current'), null);
  assert.deepEqual(parseGenerationObjectKey(`generations/${ID_A}/catalog.json`), { id: ID_A, rest: 'catalog.json' });
  assert.ok(parseGenerationObjectKey(`generations/${ID_A}/details/sunweb/${'a'.repeat(64)}.json`));
  for (const bad of [
    'current.json',
    'generations/',
    `generations/${ID_A}`,
    `generations/${ID_A}/`,
    `generations/${ID_A}/unknown.bin`,
    'generations/gbad/catalog.json',
    'live-price/v1/x.json',
    `backups/generations/${ID_A}/catalog.json`,
  ]) {
    assert.equal(parseGenerationObjectKey(bad), null, bad);
  }
});

test('dry-run: current and previous kept, older one reported, ZERO delete calls', async () => {
  const { bucket, storage } = fixture(ID_C, [ID_A, ID_B, ID_C]);
  const report = await runPrune(storage, { apply: false, minAgeHours: DEFAULT_MIN_AGE_HOURS, now: NOW });
  assert.equal(report.mode, 'dry-run');
  assert.equal(report.plan.currentId, ID_C);
  assert.equal(report.plan.previousId, ID_B);
  const byId = new Map(report.plan.decisions.map((d) => [d.generation.id, d]));
  assert.equal(byId.get(ID_C)?.action, 'keep');
  assert.equal(byId.get(ID_B)?.action, 'keep');
  assert.equal(byId.get(ID_A)?.action, 'delete');
  assert.equal(bucket.deleteCalls.length, 0);
  assert.equal(report.deletedObjects, 0);
  const text = formatPruneReport(report);
  assert.match(text, /DRY-RUN/);
  assert.match(text, /WOULD DELETE/);
  assert.match(text, new RegExp(ID_A));
  assert.match(text, /objects=\d+/);
  assert.match(text, /lastModified=2026-/);
});

test('older generations are deletable (several), newest two are not', async () => {
  const { storage } = fixture(ID_D, [ID_A, ID_B, ID_C, ID_D]);
  const report = await runPrune(storage, { apply: false, minAgeHours: 0, now: NOW });
  assert.deepEqual(
    report.plan.deleteGenerations.map((g) => g.id).sort(),
    [ID_A, ID_B],
  );
  assert.equal(report.plan.previousId, ID_C);
});

test('fewer than 2 valid generations: STOP, nothing deleted, even with --apply', async () => {
  const { bucket, storage } = fixture(ID_A, [ID_A]);
  assert.equal(await stopCode(runPrune(storage, { apply: true, minAgeHours: 0, now: NOW })), 'NO_PREVIOUS');
  assert.equal(bucket.deleteCalls.length, 0);
});

test('current missing / invalid / pointing outside generations: STOP', async () => {
  const bucket = new MockBucket();
  bucket.addGeneration(ID_A);
  bucket.addGeneration(ID_B);
  const opts = { apply: true, minAgeHours: 0, now: NOW };
  assert.equal(await stopCode(runPrune(bucket.storage(null), opts)), 'CURRENT_MISSING');
  assert.equal(await stopCode(runPrune(bucket.storage('not json'), opts)), 'CURRENT_INVALID');
  assert.equal(await stopCode(runPrune(bucket.storage('[]'), opts)), 'CURRENT_INVALID');
  assert.equal(
    await stopCode(runPrune(bucket.storage(JSON.stringify({ schemaVersion: 1, generationId: 'nope' })), opts)),
    'CURRENT_INVALID',
  );
  const foreign = JSON.parse(pointerJson(ID_B, NOW.toISOString()));
  foreign.catalogKey = `generations/${ID_A}/catalog.json`;
  assert.equal(await stopCode(runPrune(bucket.storage(JSON.stringify(foreign)), opts)), 'CURRENT_INVALID');
  const noStamp = JSON.parse(pointerJson(ID_B, NOW.toISOString()));
  delete noStamp.updatedAt;
  assert.equal(await stopCode(runPrune(bucket.storage(JSON.stringify(noStamp)), opts)), 'CURRENT_INVALID');
  assert.equal(bucket.deleteCalls.length, 0);
});

test('current points to a generation that is not in the listing: STOP', async () => {
  const bucket = new MockBucket();
  bucket.addGeneration(ID_A);
  bucket.addGeneration(ID_B);
  const storage = bucket.storage(pointerJson(ID_C, hoursAgo(1000).toISOString()));
  assert.equal(await stopCode(runPrune(storage, { apply: true, minAgeHours: 0, now: NOW })), 'CURRENT_NOT_IN_LISTING');
  assert.equal(bucket.deleteCalls.length, 0);
});

test('unexpected key under the listing (misbehaving list returns everything): STOP, no deletes', async () => {
  const { bucket, storage } = fixture(ID_C, [ID_A, ID_B, ID_C]);
  bucket.honorPrefix = false; // list now also returns live-price/**, backups/**, current.json, offers*.json
  assert.equal(await stopCode(runPrune(storage, { apply: true, minAgeHours: 0, now: NOW })), 'UNEXPECTED_KEY');
  assert.equal(bucket.deleteCalls.length, 0);

  const odd = new MockBucket();
  odd.addGeneration(ID_A);
  odd.addGeneration(ID_B);
  odd.put(`generations/${ID_A}/surprise.bin`);
  assert.equal(
    await stopCode(runPrune(odd.storage(pointerJson(ID_B, hoursAgo(1000).toISOString())), { apply: true, minAgeHours: 0, now: NOW })),
    'UNEXPECTED_KEY',
  );
  const badId = new MockBucket();
  badId.addGeneration(ID_A);
  badId.addGeneration(ID_B);
  badId.put('generations/not-an-id/catalog.json');
  assert.equal(
    await stopCode(runPrune(badId.storage(pointerJson(ID_B, hoursAgo(1000).toISOString())), { apply: true, minAgeHours: 0, now: NOW })),
    'UNEXPECTED_KEY',
  );
  assert.equal(odd.deleteCalls.length + badId.deleteCalls.length, 0);
});

test('truncated/incomplete listing: STOP', async () => {
  const { bucket, storage } = fixture(ID_C, [ID_A, ID_B, ID_C]);
  bucket.truncated = true;
  assert.equal(await stopCode(runPrune(storage, { apply: true, minAgeHours: 0, now: NOW })), 'LIST_INCOMPLETE');
  assert.equal(bucket.deleteCalls.length, 0);
});

test('current can never be in the deletion set (rollback: current is the OLDEST generation)', async () => {
  // current pointer rolled back to A while B, C exist (newer than current = kept as in-flight/staged)
  const { bucket, storage } = fixture(ID_A, [ID_A, ID_B, ID_C]);
  assert.equal(await stopCode(runPrune(storage, { apply: true, minAgeHours: 0, now: NOW })), 'NO_PREVIOUS');
  assert.equal(bucket.deleteCalls.length, 0);
});

test('invariant check in planPrune: current/previous/newer are never selected, for every pointer position', () => {
  const ids = [ID_A, ID_B, ID_C, ID_D];
  const bucket = new MockBucket();
  for (const id of ids) bucket.addGeneration(id);
  const listing = [...bucket.entries.entries()].map(([key, e]) => ({ key, size: e.size, lastModified: e.lastModified }));
  const generations = groupGenerations(listing);
  for (const currentId of ids) {
    const pointer = {
      generationId: currentId,
      updatedAt: hoursAgo(5000).toISOString(),
      updatedAtMs: hoursAgo(5000).getTime(),
      raw: '',
    };
    let plan;
    try {
      plan = planPrune({ pointer, generations, completeIds: new Set(ids), now: NOW, minAgeHours: 0 });
    } catch (error) {
      assert.ok(error instanceof PruneStopError);
      assert.equal(currentId, ID_A); // only the oldest has no previous
      continue;
    }
    const deleteIds = new Set(plan.deleteGenerations.map((g) => g.id));
    assert.ok(!deleteIds.has(plan.currentId));
    assert.ok(!deleteIds.has(plan.previousId));
    const currentEpoch = parseGenerationId(plan.currentId)!.epochMs;
    for (const id of deleteIds) assert.ok(parseGenerationId(id)!.epochMs < currentEpoch);
    for (const key of plan.deleteKeys) assert.ok(key.startsWith('generations/') && !key.includes('current.json'));
  }
});

test('generations NEWER than current are kept and reported as in-flight; previous is chosen below current only', async () => {
  const { bucket, storage } = fixture(ID_C, [ID_A, ID_B, ID_C, ID_D]);
  const report = await runPrune(storage, { apply: true, minAgeHours: 0, now: NOW });
  const d = report.plan.decisions.find((x) => x.generation.id === ID_D)!;
  assert.equal(d.action, 'keep');
  assert.equal(d.reason, 'newer-than-current (in-flight/staged)');
  assert.equal(report.plan.previousId, ID_B);
  assert.ok(bucket.deletedKeys().every((k) => k.startsWith(`generations/${ID_A}/`)));
  assert.match(formatPruneReport(report), /newer-than-current/);
});

test('incomplete generation just below current is not "previous"; it is kept and reported', async () => {
  const bucket = new MockBucket();
  bucket.addGeneration(ID_A);
  bucket.addGeneration(ID_B);
  bucket.addGeneration(ID_C, { complete: false });
  bucket.addGeneration(ID_D);
  const storage = bucket.storage(pointerJson(ID_D, hoursAgo(1000).toISOString()));
  const report = await runPrune(storage, { apply: false, minAgeHours: 0, now: NOW });
  assert.equal(report.plan.previousId, ID_B);
  const c = report.plan.decisions.find((x) => x.generation.id === ID_C)!;
  assert.equal(c.reason, 'incomplete-between-previous-and-current');
  assert.equal(c.action, 'keep');
  assert.deepEqual(report.plan.deleteGenerations.map((g) => g.id), [ID_A]);
  // without a manifest key at all
  const bucket2 = new MockBucket();
  bucket2.addGeneration(ID_B, { manifest: false });
  bucket2.addGeneration(ID_C);
  const r2 = bucket2.storage(pointerJson(ID_C, hoursAgo(1000).toISOString()));
  assert.equal(await stopCode(runPrune(r2, { apply: false, minAgeHours: 0, now: NOW })), 'NO_PREVIOUS');
});

test('current without a complete manifest: STOP', async () => {
  const bucket = new MockBucket();
  bucket.addGeneration(ID_A);
  bucket.addGeneration(ID_B, { complete: false });
  const storage = bucket.storage(pointerJson(ID_B, hoursAgo(1000).toISOString()));
  assert.equal(await stopCode(runPrune(storage, { apply: true, minAgeHours: 0, now: NOW })), 'CURRENT_NOT_COMPLETE');
});

test('two generations with the same UTC timestamp: STOP (ambiguous order)', async () => {
  const bucket = new MockBucket();
  bucket.addGeneration('g20260923T180604Z-aaaaaaaaaaaa');
  bucket.addGeneration('g20260923T180604Z-bbbbbbbbbbbb');
  bucket.addGeneration(ID_C);
  const storage = bucket.storage(pointerJson(ID_C, hoursAgo(1000).toISOString()));
  assert.equal(await stopCode(runPrune(storage, { apply: true, minAgeHours: 0, now: NOW })), 'AMBIGUOUS_ORDER');
  assert.equal(bucket.deleteCalls.length, 0);
});

test('min-age: young candidate is kept ("min-age-not-reached"); young current pointer protects everything', async () => {
  const bucket = new MockBucket();
  bucket.addGeneration(ID_A, { ageHours: 10 }); // uploaded 10 h ago
  bucket.addGeneration(ID_B);
  bucket.addGeneration(ID_C);
  const storage = bucket.storage(pointerJson(ID_C, hoursAgo(1000).toISOString()));
  const young = await runPrune(storage, { apply: true, minAgeHours: DEFAULT_MIN_AGE_HOURS, now: NOW });
  assert.equal(young.plan.decisions.find((x) => x.generation.id === ID_A)?.reason, 'min-age-not-reached');
  assert.equal(bucket.deleteCalls.length, 0);
  assert.match(formatPruneReport(young), /min-age-not-reached/);

  const fresh = fixture(ID_C, [ID_A, ID_B, ID_C], 2); // current.json flipped 2 h ago
  const r = await runPrune(fresh.storage, { apply: true, minAgeHours: DEFAULT_MIN_AGE_HOURS, now: NOW });
  assert.equal(r.plan.deleteKeys.length, 0);
  assert.equal(fresh.bucket.deleteCalls.length, 0);
  assert.equal(r.plan.decisions.find((x) => x.generation.id === ID_A)?.reason, 'min-age-not-reached');

  const ok = fixture(ID_C, [ID_A, ID_B, ID_C], 400);
  const r3 = await runPrune(ok.storage, { apply: false, minAgeHours: DEFAULT_MIN_AGE_HOURS, now: NOW });
  assert.deepEqual(r3.plan.deleteGenerations.map((g) => g.id), [ID_A]);
});

test('default min-age 48 h boundary: 47 h since current flip keeps everything, exactly 48 h makes the old generation eligible', async () => {
  const before = fixture(ID_C, [ID_A, ID_B, ID_C], 47);
  const r47 = await runPrune(before.storage, { apply: false, minAgeHours: DEFAULT_MIN_AGE_HOURS, now: NOW });
  assert.equal(r47.plan.deleteKeys.length, 0);
  assert.equal(r47.plan.decisions.find((x) => x.generation.id === ID_A)?.reason, 'min-age-not-reached');

  const at = fixture(ID_C, [ID_A, ID_B, ID_C], 48);
  const r48 = await runPrune(at.storage, { apply: false, minAgeHours: DEFAULT_MIN_AGE_HOURS, now: NOW });
  assert.deepEqual(r48.plan.deleteGenerations.map((g) => g.id), [ID_A]);
  assert.equal(r48.plan.currentId, ID_C);
  assert.equal(r48.plan.previousId, ID_B);
  assert.equal(at.bucket.deleteCalls.length, 0);

  const young = new MockBucket();
  young.addGeneration(ID_A, { ageHours: 47 });
  young.addGeneration(ID_B);
  young.addGeneration(ID_C);
  const rYoung = await runPrune(young.storage(pointerJson(ID_C, hoursAgo(1000).toISOString())), { apply: false, minAgeHours: DEFAULT_MIN_AGE_HOURS, now: NOW });
  assert.equal(rYoung.plan.decisions.find((x) => x.generation.id === ID_A)?.reason, 'min-age-not-reached');
});

test('--apply deletes exactly the keys of the old generation (and nothing else)', async () => {
  const { bucket, storage } = fixture(ID_C, [ID_A, ID_B, ID_C]);
  const expected = [...bucket.entries.keys()].filter((k) => k.startsWith(`generations/${ID_A}/`)).sort();
  const before = new Set(bucket.entries.keys());
  const report = await runPrune(storage, { apply: true, minAgeHours: 0, now: NOW });
  assert.equal(report.mode, 'apply');
  assert.deepEqual(bucket.deletedKeys().sort(), expected);
  assert.equal(report.deletedObjects, expected.length);
  const after = new Set(bucket.entries.keys());
  for (const key of before) {
    if (!expected.includes(key)) assert.ok(after.has(key), `${key} must survive`);
  }
});

test('protected keys never reach deleteObjects, with and without --apply, with a well-behaved list', async () => {
  const { bucket, storage } = fixture(ID_D, [ID_A, ID_B, ID_C, ID_D]);
  await runPrune(storage, { apply: false, minAgeHours: 0, now: NOW });
  await runPrune(storage, { apply: true, minAgeHours: 0, now: NOW });
  assert.ok(bucket.deleteCalls.length > 0);
  const forbidden = [/^current\.json$/, /^offers\.json$/, /^offers\.detail\.json$/, /^live-price\//, /^backups\//, /^feeds\//];
  for (const key of bucket.deletedKeys()) {
    assert.ok(key.startsWith('generations/'), key);
    for (const f of forbidden) assert.ok(!f.test(key), key);
  }
  for (const key of ['current.json', 'offers.json', 'offers.detail.json', 'live-price/v1/abc.json', 'live-price/v1/lock/abc.json', 'backups/pre-sub19/20260825T211242Z/offers.json', 'backups/cutover/20260923T180604Z/rollback.json']) {
    assert.ok(bucket.entries.has(key), `${key} must still exist`);
  }
  assert.ok(!bucket.getCalls.some((k) => k.startsWith('live-price/') || k.startsWith('backups/') || k === 'offers.json'));
});

test('TOCTOU: current.json changed before the delete -> STOP, nothing deleted', async () => {
  const { bucket } = fixture(ID_C, [ID_A, ID_B, ID_C]);
  const original = pointerJson(ID_C, hoursAgo(1000).toISOString());
  bucket.onCurrentRead = (n) => (n === 1 ? original : pointerJson(ID_D, hoursAgo(1).toISOString()));
  const storage = bucket.storage(original);
  assert.equal(await stopCode(runPrune(storage, { apply: true, minAgeHours: 0, now: NOW })), 'CURRENT_CHANGED');
  assert.equal(bucket.deleteCalls.length, 0);
  // same generation but re-written pointer (updatedAt differs) also stops
  const b2 = fixture(ID_C, [ID_A, ID_B, ID_C]).bucket;
  b2.onCurrentRead = (n) => pointerJson(ID_C, n === 1 ? hoursAgo(1000).toISOString() : hoursAgo(900).toISOString());
  assert.equal(await stopCode(runPrune(b2.storage(null), { apply: true, minAgeHours: 0, now: NOW })), 'CURRENT_CHANGED');
  assert.equal(b2.deleteCalls.length, 0);
});

test('batches: large generation is deleted in batches, current re-read before every batch', async () => {
  const bucket = new MockBucket();
  bucket.addGeneration(ID_A, { details: DELETE_BATCH_SIZE * 2 + 7 });
  bucket.addGeneration(ID_B);
  bucket.addGeneration(ID_C);
  const storage = bucket.storage(pointerJson(ID_C, hoursAgo(1000).toISOString()));
  const report = await runPrune(storage, { apply: true, minAgeHours: 0, now: NOW });
  assert.equal(report.deleteBatches, 3);
  assert.ok(bucket.deleteCalls.every((b) => b.length <= DELETE_BATCH_SIZE));
  assert.equal(bucket.currentReads, 1 + 3); // initial read + one per batch
});

test('partial delete errors from the store STOP the run', async () => {
  const { bucket, storage } = fixture(ID_C, [ID_A, ID_B, ID_C]);
  const failing: PruneStorage = {
    ...storage,
    deleteObjects: async (keys) => ({ deleted: keys.length - 1, errors: [`${keys[0]}: AccessDenied`] }),
  };
  assert.equal(await stopCode(runPrune(failing, { apply: true, minAgeHours: 0, now: NOW })), 'DELETE_FAILED');
  assert.equal(bucket.deleteCalls.length, 0);
});

test('invalid min-age option STOPs', () => {
  const generations = groupGenerations([]);
  assert.throws(
    () =>
      planPrune({
        pointer: { generationId: ID_A, updatedAt: '', updatedAtMs: 0, raw: '' },
        generations,
        completeIds: new Set(),
        now: NOW,
        minAgeHours: -1,
      }),
    PruneStopError,
  );
});

// ---------------------------------------------------------------- R2 adapter (fake S3 client)

type SentCommand = { name: string; input: Record<string, unknown> };

function fakeClient(pages: Array<{ keys: string[]; next?: string; truncated?: boolean }>, bodies: Record<string, string> = {}) {
  const sent: SentCommand[] = [];
  const client = {
    send: async (command: { constructor: { name: string }; input: Record<string, unknown> }) => {
      const name = command.constructor.name;
      sent.push({ name, input: command.input });
      if (name === 'ListObjectsV2Command') {
        const index = command.input.ContinuationToken ? Number(command.input.ContinuationToken) : 0;
        const page = pages[index];
        return {
          Contents: page.keys.map((Key) => ({ Key, Size: 1, LastModified: hoursAgo(2000) })),
          IsTruncated: page.truncated ?? index < pages.length - 1,
          NextContinuationToken: page.next ?? (index < pages.length - 1 ? String(index + 1) : undefined),
        };
      }
      if (name === 'GetObjectCommand') {
        const key = String(command.input.Key);
        if (!(key in bodies)) {
          const error = new Error('missing') as Error & { $metadata: { httpStatusCode: number } };
          error.name = 'NoSuchKey';
          error.$metadata = { httpStatusCode: 404 };
          throw error;
        }
        return { Body: { transformToString: async () => bodies[key] } };
      }
      if (name === 'DeleteObjectsCommand') {
        const objects = (command.input.Delete as { Objects: Array<{ Key: string }> }).Objects;
        return { Deleted: objects.map((o) => ({ Key: o.Key })), Errors: [] };
      }
      throw new Error(`unexpected command ${name}`);
    },
  };
  return { client: client as never, sent };
}

test('R2 adapter: lists ONLY Prefix generations/ (all pages) and never any other prefix', async () => {
  const k = (id: string) => `generations/${id}/catalog.json`;
  const { client, sent } = fakeClient([{ keys: [k(ID_A)] }, { keys: [k(ID_B)] }, { keys: [k(ID_C)] }]);
  const storage = createR2PruneStorage({ client, bucket: 'bucket-name', allowDelete: false });
  const result = await storage.listGenerationObjects();
  assert.equal(result.truncated, false);
  assert.equal(result.objects.length, 3);
  assert.equal(sent.length, 3);
  for (const c of sent) {
    assert.equal(c.name, 'ListObjectsV2Command');
    assert.equal(c.input.Prefix, 'generations/');
    assert.equal(c.input.Bucket, 'bucket-name');
  }
});

test('R2 adapter: truncated without continuation token / page cap => truncated (core then STOPs)', async () => {
  const a = fakeClient([{ keys: [`generations/${ID_A}/catalog.json`], truncated: true, next: undefined }]);
  const s = createR2PruneStorage({ client: a.client, bucket: 'b', allowDelete: false });
  assert.equal((await s.listGenerationObjects()).truncated, true);
  assert.ok(MAX_LIST_PAGES >= 1);
});

test('R2 adapter: GET only current.json and generation manifests', async () => {
  const { client, sent } = fakeClient([{ keys: [] }], { 'current.json': '{}', [`generations/${ID_A}/manifest.json`]: '{}' });
  const storage = createR2PruneStorage({ client, bucket: 'b', allowDelete: false });
  assert.equal(await storage.getText('current.json'), '{}');
  assert.equal(await storage.getText(`generations/${ID_A}/manifest.json`), '{}');
  assert.equal(await storage.getText(`generations/${ID_B}/manifest.json`), null); // 404 => null
  for (const key of ['offers.json', 'live-price/v1/abc.json', 'backups/x/rollback.json', `generations/${ID_A}/catalog.json`, 'generations/gbad/manifest.json']) {
    await assert.rejects(() => storage.getText(key), /refuses to read/);
  }
  assert.ok(sent.every((c) => c.name === 'GetObjectCommand'));
  assert.equal(sent.length, 3);
});

test('R2 adapter: delete disabled unless allowDelete; only generations/<id>/<layout> keys can be deleted', async () => {
  const off = fakeClient([{ keys: [] }]);
  const dry = createR2PruneStorage({ client: off.client, bucket: 'b', allowDelete: false });
  await assert.rejects(() => dry.deleteObjects([`generations/${ID_A}/catalog.json`]), /delete is disabled/);
  assert.equal(off.sent.length, 0);

  const on = fakeClient([{ keys: [] }]);
  const live = createR2PruneStorage({ client: on.client, bucket: 'b', allowDelete: true });
  for (const key of ['current.json', 'offers.json', 'offers.detail.json', 'live-price/v1/abc.json', 'live-price/v1/lock/abc.json', 'backups/pre-sub19/x/offers.json', `generations/${ID_A}/unknown.bin`, 'generations/gbad/catalog.json']) {
    await assert.rejects(() => live.deleteObjects([`generations/${ID_A}/catalog.json`, key]), /refuses to delete/);
  }
  assert.equal(on.sent.length, 0); // nothing reached the client
  const ok = await live.deleteObjects([`generations/${ID_A}/catalog.json`, `generations/${ID_A}/manifest.json`]);
  assert.equal(ok.deleted, 2);
  assert.equal(on.sent.length, 1);
  assert.equal(on.sent[0].name, 'DeleteObjectsCommand');
});

test('source guard: prune modules have no PutObject path, never name live-price/backups prefixes as targets', () => {
  const root = process.cwd();
  const adapter = readFileSync(join(root, 'lib/offers/prune-generations-r2.ts'), 'utf8');
  const core = readFileSync(join(root, 'lib/offers/prune-generations-core.ts'), 'utf8');
  const script = readFileSync(join(root, 'scripts/prune-generations.ts'), 'utf8');
  for (const [name, src] of [['adapter', adapter], ['core', core], ['script', script]] as const) {
    assert.ok(!/PutObject|putStorage|CopyObject|writeFile/.test(src.replace(/\/\*[\s\S]*?\*\//g, '')), `${name} must not write`);
    assert.ok(!/['"`]live-price\//.test(src.replace(/\/\*[\s\S]*?\*\//g, '')), `${name} must not reference live-price/ in code`);
    assert.ok(!/['"`]backups\//.test(src.replace(/\/\*[\s\S]*?\*\//g, '')), `${name} must not reference backups/ in code`);
  }
  assert.match(adapter, /Prefix: GENERATIONS_PREFIX/);
  assert.match(script, /DEFAULT_MIN_AGE_HOURS/);
});