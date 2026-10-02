import {
  type PoolProgressStep,
  type PoolProgressTracker,
} from '@/lib/search/results-pool-progress';
import { Suspense, type ReactNode } from 'react';

/**
 * t334u: server-streamed progressive steps (no client JS, no polling endpoint).
 *
 * Each step is its own Suspense boundary that resolves when the proven value changed
 * (see createPoolProgressTracker). Every step renders its own element; only the LAST
 * one stays visible (CSS `:not(:last-of-type)` hides the previous steps), so the
 * visible text moves from "7 vakanties" to ... "311 vakanties gevonden" while the
 * request stays open, using the same L1 state the cards fill. The deeper boundaries
 * are new boundaries (fallback null), so they never block a router transition.
 */
export type PoolProgressTag = 'span' | 'div';

// Static strings so Tailwind keeps the arbitrary variants.
const HIDE_PREVIOUS_STEPS: Record<PoolProgressTag, string> = {
  span: '[&>span[data-pool-step]:not(:last-of-type)]:hidden',
  div: '[&>div[data-pool-step]:not(:last-of-type)]:hidden',
};

type StepsProps = {
  tracker: PoolProgressTracker;
  render: (step: PoolProgressStep) => ReactNode;
  as: PoolProgressTag;
  index: number;
};

async function PoolProgressSteps({ tracker, render, as, index }: StepsProps) {
  const step = await tracker.next();
  const Tag = as;
  return (
    <>
      {step.changed ? (
        <Tag data-pool-step={index} data-pool-final={step.final ? 'true' : undefined}>
          {render(step)}
        </Tag>
      ) : null}
      {step.final ? null : (
        <Suspense fallback={null}>
          <PoolProgressSteps tracker={tracker} render={render} as={as} index={index + 1} />
        </Suspense>
      )}
    </>
  );
}

export function PoolProgressStream({
  tracker,
  render,
  as = 'span',
}: {
  tracker: PoolProgressTracker;
  render: (step: PoolProgressStep) => ReactNode;
  as?: PoolProgressTag;
}) {
  const Tag = as;
  return (
    <Tag className={HIDE_PREVIOUS_STEPS[as]} data-pool-progress>
      <PoolProgressSteps tracker={tracker} render={render} as={as} index={0} />
    </Tag>
  );
}
