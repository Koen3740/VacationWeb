import { waitUntil } from '@vercel/functions';

const pendingMatchsetWork = new Set<Promise<unknown>>();

/**
 * Keep full-matchset live pricing alive after the Results RSC has started.
 *
 * On Vercel Node serverless, {@link waitUntil} extends the isolate past the
 * response. Locally `waitUntil` may be a no-op; the process stays up and the
 * pending set keeps the promise referenced.
 *
 * Does not await the work. Must not be used as a substitute for awaiting
 * page-1 `presented()`.
 */
export function scheduleResultsMatchsetLivePricing(work: Promise<unknown>): void {
  const tracked = work.finally(() => {
    pendingMatchsetWork.delete(tracked);
  });
  pendingMatchsetWork.add(tracked);
  waitUntil(tracked);
}
