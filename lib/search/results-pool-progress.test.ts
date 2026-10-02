/**
 * t334u: results count progress (replaces the t333u fixed 8 s heading wait loop).
 * Deterministic fake clock: no real timers.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createPoolProgressTracker,
  POOL_PROGRESS_IDLE_MS,
  POOL_PROGRESS_MAX_MS,
  POOL_PROGRESS_MIN_STEP_MS,
  type PoolProgressReading,
  type PoolProgressStep,
} from '@/lib/search/results-pool-progress';

function harness(script: (t: number) => PoolProgressReading) {
  let clock = 0;
  const tracker = createPoolProgressTracker({
    read: () => script(clock),
    now: () => clock,
    sleep: async (ms) => {
      clock += ms;
    },
  });
  return { tracker, time: () => clock };
}

async function drain(tracker: { next(): Promise<PoolProgressStep> }, limit = 500) {
  const steps: PoolProgressStep[] = [];
  for (let i = 0; i < limit; i += 1) {
    const step = await tracker.next();
    steps.push(step);
    if (step.final) break;
  }
  return steps;
}

describe('t334u results pool progress', () => {
  it('first step is immediate, even with 0 proven B (never a permanent loading state)', async () => {
    const { tracker, time } = harness(() => ({ count: 0, pending: 50, complete: false }));
    const first = await tracker.next();
    assert.equal(time(), 0);
    assert.equal(first.count, 0);
    assert.equal(first.final, false);
    assert.equal(first.changed, true);
  });

  it('count grows step by step and ends definitively when nothing is pending', async () => {
    // 0 -> 7 -> 40 -> 311 (complete at t=20 s)
    const { tracker } = harness((t) => {
      if (t < 2000) return { count: 7, pending: 300, complete: false };
      if (t < 8000) return { count: 40, pending: 200, complete: false };
      if (t < 20000) return { count: 100 + Math.floor(t / 100), pending: 50, complete: false };
      return { count: 311, pending: 0, complete: true };
    });
    const steps = await drain(tracker);
    const last = steps[steps.length - 1]!;
    assert.equal(last.final, true);
    assert.equal(last.complete, true);
    assert.equal(last.count, 311);
    assert.equal(last.checking, false);
    // counts never go down, every emitted step is a real change
    for (let i = 1; i < steps.length; i += 1) {
      assert.ok(steps[i]!.count >= steps[i - 1]!.count);
    }
  });

  it('steps are at least MIN_STEP apart (no flicker)', async () => {
    let clockAtStep: number[] = [];
    let clock = 0;
    const tracker = createPoolProgressTracker({
      read: () => ({ count: Math.floor(clock / 100), pending: 10, complete: clock >= 5000 }),
      now: () => clock,
      sleep: async (ms) => {
        clock += ms;
      },
    });
    for (;;) {
      const step = await tracker.next();
      clockAtStep.push(clock);
      if (step.final) break;
    }
    for (let i = 1; i < clockAtStep.length - 1; i += 1) {
      assert.ok(clockAtStep[i]! - clockAtStep[i - 1]! >= POOL_PROGRESS_MIN_STEP_MS);
    }
  });

  it('checking is true only while provable (pending > 0 and recent progress)', async () => {
    const { tracker } = harness((t) => ({ count: Math.floor(t / 1000), pending: 100 - Math.floor(t / 1000), complete: false }));
    const first = await tracker.next();
    assert.equal(first.checking, true);
    const second = await tracker.next();
    assert.equal(second.checking, true);
  });

  it('stalled pricing ends the stream after IDLE and drops the "checking" claim', async () => {
    const { tracker, time } = harness(() => ({ count: 12, pending: 400, complete: false }));
    const steps = await drain(tracker);
    const last = steps[steps.length - 1]!;
    assert.equal(last.final, true);
    assert.equal(last.complete, false);
    assert.equal(last.checking, false);
    assert.ok(time() >= POOL_PROGRESS_IDLE_MS && time() < POOL_PROGRESS_IDLE_MS + 1500);
    assert.equal(last.count, 12);
  });

  it('a slow-but-moving run is capped at MAX and never stays open forever', async () => {
    const { tracker, time } = harness((t) => ({ count: Math.floor(t / 3000), pending: 9999, complete: false }));
    const steps = await drain(tracker, 5000);
    const last = steps[steps.length - 1]!;
    assert.equal(last.final, true);
    assert.ok(time() >= POOL_PROGRESS_MAX_MS && time() < POOL_PROGRESS_MAX_MS + 1500);
    // still moving at the cap -> the claim is still true at that moment
    assert.equal(last.checking, true);
  });

  it('complete with 0 B is definitive (all offers settled, none proven)', async () => {
    const { tracker } = harness(() => ({ count: 0, pending: 0, complete: true }));
    const step = await tracker.next();
    assert.equal(step.final, true);
    assert.equal(step.complete, true);
    assert.equal(step.count, 0);
    assert.equal(step.checking, false);
  });

  it('pending unknown (null): progress is judged by count changes only', async () => {
    const { tracker } = harness((t) => ({ count: Math.min(150, Math.floor(t / 500)), pending: null, complete: t >= 75000 }));
    const steps = await drain(tracker, 2000);
    const last = steps[steps.length - 1]!;
    assert.equal(last.final, true);
    assert.equal(last.count, 150);
    assert.equal(last.complete, true);
  });
});
