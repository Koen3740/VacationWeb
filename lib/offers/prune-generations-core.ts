/**
 * t364u (SUB25-A): pure core for pruning old catalogue GENERATIONS in object storage.
 *
 * Goal: after a new publication keep (1) the current generation (`current.json`) and (2) the
 * immediately previous COMPLETE generation; older generations may be deleted.
 *
 * Hard boundaries (enforced here AND in the R2 adapter, see prune-generations-r2.ts):
 *  - only the prefix `generations/` is ever listed; only keys `generations/<id>/<known layout>`
 *    are ever deletable; `current.json`, `offers.json`, `offers.detail.json`, `backups/**`,
 *    `live-price/v1/**` (incl. lock/) and TradeTracker feeds are never listed and never deleted;
 *  - this module has no PUT path and never writes `current.json`;
 *  - dry-run (default) never calls `deleteObjects`.
 *
 * Fail-closed: any surprise (missing/invalid pointer, truncated listing, unexpected key,
 * ambiguous ordering, no complete previous generation, current changed before delete) throws a
 * PruneStopError and nothing is deleted.
 */
import {
  CURRENT_POINTER_KEY,
  type GenerationManifest,
} from './generation-types';

export const GENERATIONS_PREFIX = 'generations/';

/** g{UTC compact}-{12 hex}: see generation-id.ts (buildGenerationId). */
export const GENERATION_ID_PATTERN = /^g(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z-([0-9a-f]{12})$/;

/** Objects a generation may contain (generation-paths.ts / build-generation-artifacts.ts). */
const GENERATION_REST_PATTERNS: readonly RegExp[] = [
  /^catalog\.json$/,
  /^manifest\.json$/,
  /^filter-options\.json$/,
  /^details-index\.json$/,
  /^shards\/[a-z0-9][a-z0-9_-]*\.json$/,
  /^details\/[a-z0-9][a-z0-9_-]*\/[0-9a-f]{64}\.json$/,
];

/**
 * Default minimum age = 48 h (Koen-besluit t366u, 04-10-2026).
 * Why an age at all: the code has NO cache TTL. `loadRuntimeDataset` keeps the dataset (and thus the
 * generation id used for `details/` reads) in process memory until the process ends
 * (lib/offers/load-runtime-dataset.ts: `cachedDataset`), so a warm instance can still read `details/`
 * of the generation that was current when it started.
 * Why 48 h: t365u found ~24 h to be the plausible minimum (AWS Lambda recycles execution environments
 * "every few hours", Worker lease max 14 h; Vercel runs on Lambda; a Vercel-published maximum is NOT
 * PROVEN). 48 h is a deliberate extra safety margin and still frees enough R2 space.
 * The "14 days" in the Vercel scale-to-one blog is a pre-warm condition (Pro/Enterprise), NOT a maximum
 * instance lifetime, so 336 h is not required. Lowering below the default is an explicit operator choice.
 */
export const DEFAULT_MIN_AGE_HOURS = 48;

/** S3/R2 DeleteObjects accepts at most 1000 keys; stay below it. */
export const DELETE_BATCH_SIZE = 500;

export type PruneStopCode =
  | 'CURRENT_MISSING'
  | 'CURRENT_INVALID'
  | 'LIST_INCOMPLETE'
  | 'UNEXPECTED_KEY'
  | 'AMBIGUOUS_ORDER'
  | 'CURRENT_NOT_IN_LISTING'
  | 'CURRENT_NOT_COMPLETE'
  | 'NO_PREVIOUS'
  | 'INVARIANT'
  | 'CURRENT_CHANGED'
  | 'DELETE_FAILED'
  | 'INVALID_OPTION';

export class PruneStopError extends Error {
  readonly code: PruneStopCode;
  constructor(code: PruneStopCode, message: string) {
    super(message);
    this.name = 'PruneStopError';
    this.code = code;
  }
}

export type PruneObject = { key: string; size: number; lastModified: Date };

/** Injectable storage (R2 adapter in production, in-memory mock in tests). */
export interface PruneStorage {
  /** Lists ONLY prefix `generations/` (all pages). `truncated` = listing not provably complete. */
  listGenerationObjects(): Promise<{ objects: PruneObject[]; truncated: boolean }>;
  /** GET of `current.json` or `generations/<id>/manifest.json` only. null = not found. */
  getText(key: string): Promise<string | null>;
  /** Deletes exactly these keys (all under `generations/<id>/`). Only called with --apply. */
  deleteObjects(keys: string[]): Promise<{ deleted: number; errors: string[] }>;
}

export type ParsedGenerationId = { id: string; epochMs: number; stamp: string };

export function parseGenerationId(id: string): ParsedGenerationId | null {
  const m = GENERATION_ID_PATTERN.exec(id);
  if (!m) {
    return null;
  }
  const [, y, mo, d, h, mi, s] = m;
  const epochMs = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
  const check = new Date(epochMs);
  if (
    check.getUTCFullYear() !== Number(y) ||
    check.getUTCMonth() !== Number(mo) - 1 ||
    check.getUTCDate() !== Number(d) ||
    check.getUTCHours() !== Number(h) ||
    check.getUTCMinutes() !== Number(mi) ||
    check.getUTCSeconds() !== Number(s)
  ) {
    return null;
  }
  return { id, epochMs, stamp: `${y}${mo}${d}T${h}${mi}${s}Z` };
}

/** `generations/<valid id>/<known layout>` -> id, else null. */
export function parseGenerationObjectKey(key: string): { id: string; rest: string } | null {
  if (!key.startsWith(GENERATIONS_PREFIX)) {
    return null;
  }
  const afterPrefix = key.slice(GENERATIONS_PREFIX.length);
  const slash = afterPrefix.indexOf('/');
  if (slash <= 0) {
    return null;
  }
  const id = afterPrefix.slice(0, slash);
  const rest = afterPrefix.slice(slash + 1);
  if (!parseGenerationId(id) || rest.length === 0) {
    return null;
  }
  if (!GENERATION_REST_PATTERNS.some((pattern) => pattern.test(rest))) {
    return null;
  }
  return { id, rest };
}

export type ValidatedPointer = {
  generationId: string;
  updatedAt: string;
  updatedAtMs: number;
  raw: string;
};

export function parseCurrentPointerStrict(raw: string | null): ValidatedPointer {
  if (raw === null) {
    throw new PruneStopError('CURRENT_MISSING', `${CURRENT_POINTER_KEY} not found: refusing to prune`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new PruneStopError('CURRENT_INVALID', `${CURRENT_POINTER_KEY} is not valid JSON`);
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new PruneStopError('CURRENT_INVALID', `${CURRENT_POINTER_KEY} is not a JSON object`);
  }
  const record = parsed as Record<string, unknown>;
  if (record.schemaVersion !== 1) {
    throw new PruneStopError('CURRENT_INVALID', `${CURRENT_POINTER_KEY} schemaVersion must be 1`);
  }
  const generationId = record.generationId;
  if (typeof generationId !== 'string' || !parseGenerationId(generationId)) {
    throw new PruneStopError('CURRENT_INVALID', `${CURRENT_POINTER_KEY} generationId is not a valid generation id`);
  }
  const ownPrefix = `${GENERATIONS_PREFIX}${generationId}/`;
  for (const field of ['catalogKey', 'detailsPrefix', 'filterOptionsKey'] as const) {
    const value = record[field];
    if (typeof value !== 'string' || !value.startsWith(ownPrefix)) {
      throw new PruneStopError('CURRENT_INVALID', `${CURRENT_POINTER_KEY} ${field} is not inside ${ownPrefix}`);
    }
  }
  if (Array.isArray(record.catalogShards)) {
    for (const shard of record.catalogShards) {
      const key = (shard as { key?: unknown } | null)?.key;
      if (typeof key !== 'string' || !key.startsWith(ownPrefix)) {
        throw new PruneStopError('CURRENT_INVALID', `${CURRENT_POINTER_KEY} catalogShards key is not inside ${ownPrefix}`);
      }
    }
  }
  const updatedAt = record.updatedAt;
  const updatedAtMs = typeof updatedAt === 'string' ? Date.parse(updatedAt) : Number.NaN;
  if (typeof updatedAt !== 'string' || !Number.isFinite(updatedAtMs)) {
    throw new PruneStopError('CURRENT_INVALID', `${CURRENT_POINTER_KEY} updatedAt missing/invalid (needed for min-age)`);
  }
  return { generationId, updatedAt, updatedAtMs, raw };
}

export type GenerationSummary = {
  id: string;
  epochMs: number;
  objectCount: number;
  totalBytes: number;
  newestModified: Date;
  hasManifestKey: boolean;
  keys: string[];
};

export function groupGenerations(objects: readonly PruneObject[]): GenerationSummary[] {
  const byId = new Map<string, GenerationSummary>();
  const seen = new Set<string>();
  for (const object of objects) {
    const parsed = parseGenerationObjectKey(object.key);
    if (!parsed) {
      throw new PruneStopError(
        'UNEXPECTED_KEY',
        `unexpected key in listing of ${GENERATIONS_PREFIX}: ${JSON.stringify(object.key)} (not generations/<valid-id>/<known layout>)`,
      );
    }
    if (seen.has(object.key)) {
      throw new PruneStopError('UNEXPECTED_KEY', `duplicate key in listing: ${JSON.stringify(object.key)}`);
    }
    seen.add(object.key);
    if (!Number.isFinite(object.size) || object.size < 0 || !(object.lastModified instanceof Date) || Number.isNaN(object.lastModified.getTime())) {
      throw new PruneStopError('UNEXPECTED_KEY', `listing entry without usable size/LastModified: ${JSON.stringify(object.key)}`);
    }
    let summary = byId.get(parsed.id);
    if (!summary) {
      summary = {
        id: parsed.id,
        epochMs: parseGenerationId(parsed.id)!.epochMs,
        objectCount: 0,
        totalBytes: 0,
        newestModified: object.lastModified,
        hasManifestKey: false,
        keys: [],
      };
      byId.set(parsed.id, summary);
    }
    summary.objectCount += 1;
    summary.totalBytes += object.size;
    summary.keys.push(object.key);
    if (object.lastModified.getTime() > summary.newestModified.getTime()) {
      summary.newestModified = object.lastModified;
    }
    if (parsed.rest === 'manifest.json') {
      summary.hasManifestKey = true;
    }
  }
  const all = [...byId.values()].sort((a, b) => a.epochMs - b.epochMs || (a.id < b.id ? -1 : 1));
  for (let i = 1; i < all.length; i += 1) {
    if (all[i].epochMs === all[i - 1].epochMs) {
      throw new PruneStopError(
        'AMBIGUOUS_ORDER',
        `two generations share the same UTC timestamp (${all[i - 1].id}, ${all[i].id}): order is ambiguous`,
      );
    }
  }
  return all;
}

/** A manifest counts as complete only if status=complete AND it names its own generation. */
export function isCompleteManifestText(raw: string | null, generationId: string): boolean {
  if (raw === null) {
    return false;
  }
  try {
    const manifest = JSON.parse(raw) as Partial<GenerationManifest>;
    return manifest.status === 'complete' && manifest.generationId === generationId;
  } catch {
    return false;
  }
}

export type DecisionReason =
  | 'current'
  | 'previous'
  | 'newer-than-current (in-flight/staged)'
  | 'incomplete-between-previous-and-current'
  | 'min-age-not-reached'
  | 'older-than-previous';

export type Decision = {
  generation: GenerationSummary;
  action: 'keep' | 'delete';
  reason: DecisionReason;
  /** hours since newest object (informational) */
  ageHours: number;
};

export type PrunePlan = {
  currentId: string;
  previousId: string;
  minAgeHours: number;
  currentPointerAgeHours: number;
  decisions: Decision[];
  deleteKeys: string[];
  deleteGenerations: GenerationSummary[];
  keepGenerations: Decision[];
};

export function planPrune(input: {
  pointer: ValidatedPointer;
  generations: readonly GenerationSummary[]; // sorted ascending by timestamp
  /** ids whose manifest.json was fetched and verified complete */
  completeIds: ReadonlySet<string>;
  now: Date;
  minAgeHours: number;
}): PrunePlan {
  const { pointer, generations, completeIds, now, minAgeHours } = input;
  if (!Number.isFinite(minAgeHours) || minAgeHours < 0) {
    throw new PruneStopError('INVALID_OPTION', 'min-age-hours must be a number >= 0');
  }
  const currentIndex = generations.findIndex((g) => g.id === pointer.generationId);
  if (currentIndex < 0) {
    throw new PruneStopError(
      'CURRENT_NOT_IN_LISTING',
      `current generation ${pointer.generationId} has no objects under ${GENERATIONS_PREFIX}: refusing to prune`,
    );
  }
  const current = generations[currentIndex];
  if (!completeIds.has(current.id)) {
    throw new PruneStopError('CURRENT_NOT_COMPLETE', `current generation ${current.id} has no complete manifest.json`);
  }

  // previous = newest generation strictly OLDER than current whose manifest is verified complete
  let previousIndex = -1;
  for (let i = currentIndex - 1; i >= 0; i -= 1) {
    if (completeIds.has(generations[i].id)) {
      previousIndex = i;
      break;
    }
  }
  if (previousIndex < 0) {
    throw new PruneStopError(
      'NO_PREVIOUS',
      'fewer than 2 valid generations (current + complete previous): nothing is deleted',
    );
  }
  const previous = generations[previousIndex];

  const nowMs = now.getTime();
  const hours = (ms: number) => ms / 3_600_000;
  const minAgeMs = minAgeHours * 3_600_000;
  // The only valid LOWER bound for "time since a superseded generation stopped being current" is the
  // age of the present pointer (updatedAt): older generations stopped being current no later than that.
  const pointerAgeMs = nowMs - pointer.updatedAtMs;

  const decisions: Decision[] = generations.map((generation, index) => {
    const ageMs = nowMs - generation.newestModified.getTime();
    const ageHours = hours(ageMs);
    const base = { generation, ageHours };
    if (index === currentIndex) return { ...base, action: 'keep', reason: 'current' };
    if (index > currentIndex) return { ...base, action: 'keep', reason: 'newer-than-current (in-flight/staged)' };
    if (index === previousIndex) return { ...base, action: 'keep', reason: 'previous' };
    if (index > previousIndex) return { ...base, action: 'keep', reason: 'incomplete-between-previous-and-current' };
    // index < previousIndex: candidate for deletion
    if (!(ageMs >= minAgeMs) || !(pointerAgeMs >= minAgeMs)) {
      return { ...base, action: 'keep', reason: 'min-age-not-reached' };
    }
    return { ...base, action: 'delete', reason: 'older-than-previous' };
  });

  const deleteGenerations = decisions.filter((d) => d.action === 'delete').map((d) => d.generation);
  const deleteKeys = deleteGenerations.flatMap((g) => g.keys);

  // Invariants (defence in depth): never delete current/previous/newer, only generations/<id>/ keys.
  const deleteIds = new Set(deleteGenerations.map((g) => g.id));
  if (deleteIds.has(current.id) || deleteIds.has(previous.id)) {
    throw new PruneStopError('INVARIANT', 'current/previous ended up in the deletion set');
  }
  for (const g of deleteGenerations) {
    if (g.epochMs >= previous.epochMs) {
      throw new PruneStopError('INVARIANT', `generation ${g.id} is not older than previous`);
    }
  }
  for (const key of deleteKeys) {
    const parsed = parseGenerationObjectKey(key);
    if (!parsed || !deleteIds.has(parsed.id)) {
      throw new PruneStopError('INVARIANT', `delete key outside deletable generations: ${key}`);
    }
  }

  return {
    currentId: current.id,
    previousId: previous.id,
    minAgeHours,
    currentPointerAgeHours: hours(pointerAgeMs),
    decisions,
    deleteKeys,
    deleteGenerations,
    keepGenerations: decisions.filter((d) => d.action === 'keep'),
  };
}

export type PruneReport = {
  mode: 'dry-run' | 'apply';
  plan: PrunePlan;
  deletedObjects: number;
  deleteBatches: number;
};

export async function runPrune(
  storage: PruneStorage,
  options: { apply: boolean; minAgeHours: number; now?: Date },
): Promise<PruneReport> {
  const now = options.now ?? new Date();

  const pointer = parseCurrentPointerStrict(await storage.getText(CURRENT_POINTER_KEY));

  const listing = await storage.listGenerationObjects();
  if (listing.truncated) {
    throw new PruneStopError('LIST_INCOMPLETE', `listing of ${GENERATIONS_PREFIX} is truncated/incomplete: refusing to prune`);
  }
  const generations = groupGenerations(listing.objects);

  // verify manifests: current, then older generations (newest first) until one complete previous is found
  const completeIds = new Set<string>();
  const currentIndex = generations.findIndex((g) => g.id === pointer.generationId);
  if (currentIndex >= 0) {
    const current = generations[currentIndex];
    if (
      current.hasManifestKey &&
      isCompleteManifestText(await storage.getText(`${GENERATIONS_PREFIX}${current.id}/manifest.json`), current.id)
    ) {
      completeIds.add(current.id);
    }
    for (let i = currentIndex - 1; i >= 0; i -= 1) {
      const candidate = generations[i];
      if (!candidate.hasManifestKey) continue;
      const text = await storage.getText(`${GENERATIONS_PREFIX}${candidate.id}/manifest.json`);
      if (isCompleteManifestText(text, candidate.id)) {
        completeIds.add(candidate.id);
        break;
      }
    }
  }

  const plan = planPrune({ pointer, generations, completeIds, now, minAgeHours: options.minAgeHours });

  if (!options.apply || plan.deleteKeys.length === 0) {
    return { mode: options.apply ? 'apply' : 'dry-run', plan, deletedObjects: 0, deleteBatches: 0 };
  }

  let deletedObjects = 0;
  let deleteBatches = 0;
  for (let offset = 0; offset < plan.deleteKeys.length; offset += DELETE_BATCH_SIZE) {
    // TOCTOU: current.json must be unchanged right before every delete batch
    const again = parseCurrentPointerStrict(await storage.getText(CURRENT_POINTER_KEY));
    if (again.generationId !== pointer.generationId || again.updatedAt !== pointer.updatedAt) {
      throw new PruneStopError(
        'CURRENT_CHANGED',
        `${CURRENT_POINTER_KEY} changed during the run (${pointer.generationId} -> ${again.generationId}); stopped after ${deletedObjects} deleted object(s)`,
      );
    }
    const batch = plan.deleteKeys.slice(offset, offset + DELETE_BATCH_SIZE);
    const result = await storage.deleteObjects(batch);
    deleteBatches += 1;
    deletedObjects += result.deleted;
    if (result.errors.length > 0) {
      throw new PruneStopError(
        'DELETE_FAILED',
        `delete batch reported ${result.errors.length} error(s), first: ${result.errors[0]}; stopped after ${deletedObjects} deleted object(s)`,
      );
    }
  }
  return { mode: 'apply', plan, deletedObjects, deleteBatches };
}

function mb(bytes: number): string {
  return `${(bytes / 1_048_576).toFixed(2)} MiB`;
}

function line(d: Decision): string {
  const g = d.generation;
  return `  ${g.id}  objects=${g.objectCount}  bytes=${g.totalBytes} (${mb(g.totalBytes)})  lastModified=${g.newestModified.toISOString()}  ageH=${d.ageHours.toFixed(1)}  [${d.reason}]`;
}

export function formatPruneReport(report: PruneReport): string {
  const { plan } = report;
  const out: string[] = [];
  out.push(`MODE: ${report.mode === 'dry-run' ? 'DRY-RUN (no DELETE calls)' : 'APPLY'}`);
  out.push(`prefix listed: ${GENERATIONS_PREFIX} (only)`);
  out.push(`current:  ${plan.currentId}`);
  out.push(`previous: ${plan.previousId}`);
  out.push(
    `min-age-hours: ${plan.minAgeHours} (current.json age ${plan.currentPointerAgeHours.toFixed(1)} h; candidates also need own age >= min-age)`,
  );
  out.push('KEEP:');
  for (const d of plan.keepGenerations) out.push(line(d));
  const del = plan.decisions.filter((d) => d.action === 'delete');
  out.push(report.mode === 'dry-run' ? 'WOULD DELETE:' : 'DELETE:');
  if (del.length === 0) out.push('  (none)');
  for (const d of del) out.push(line(d));
  const totalBytes = del.reduce((s, d) => s + d.generation.totalBytes, 0);
  out.push(
    `TOTAL ${report.mode === 'dry-run' ? 'would delete' : 'selected'}: generations=${del.length} objects=${plan.deleteKeys.length} bytes=${totalBytes} (${mb(totalBytes)})`,
  );
  if (report.mode === 'apply') {
    out.push(`DELETED: objects=${report.deletedObjects} batches=${report.deleteBatches}`);
  }
  return out.join('\n');
}