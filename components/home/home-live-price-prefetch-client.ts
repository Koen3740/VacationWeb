/**
 * Client-side AN-077 bridge trigger (fire-and-forget).
 * No UI; failures are swallowed so homepage navigation never waits.
 */

import type { SharedSearchState } from '@/components/search/shared-search-state';
import {
  homeSearchContextKey,
  isDefinitiveHomeSearchContext,
} from '@/lib/search/home-live-price-prefetch-context';

export {
  homeSearchContextKey,
  isDefinitiveHomeSearchContext,
} from '@/lib/search/home-live-price-prefetch-context';

type PrefetchController = {
  lastContextKey: string | null;
  generation: number;
};

const controller: PrefetchController = {
  lastContextKey: null,
  generation: 0,
};

/** Test helper. */
export function resetHomeLivePricePrefetchClientForTests(): void {
  controller.lastContextKey = null;
  controller.generation = 0;
}

export function getHomeLivePricePrefetchClientGenerationForTests(): number {
  return controller.generation;
}

export type RequestHomeLivePricePrefetchOptions = {
  enabled: boolean;
  /** When true, any search popup is open — treat as preliminary. */
  popupsOpen: boolean;
  /** Optional fetch for tests. */
  fetchImpl?: typeof fetch;
};

/**
 * Best-effort POST. Never throws. Skips duplicate context keys (dedupe L).
 * Bumps generation so older in-flight work can be ignored server-side.
 */
export function requestHomeLivePricePrefetch(
  state: SharedSearchState,
  options: RequestHomeLivePricePrefetchOptions,
): { fired: boolean; reason?: string; generation?: number; contextKey?: string } {
  if (!options.enabled) {
    return { fired: false, reason: 'flag_off' };
  }
  if (options.popupsOpen) {
    return { fired: false, reason: 'popup_open' };
  }
  if (!isDefinitiveHomeSearchContext(state)) {
    return { fired: false, reason: 'not_definitive' };
  }

  const contextKey = homeSearchContextKey(state);
  if (contextKey === controller.lastContextKey) {
    return { fired: false, reason: 'duplicate_context', contextKey };
  }

  controller.lastContextKey = contextKey;
  controller.generation += 1;
  const generation = controller.generation;

  const fetchFn = options.fetchImpl ?? fetch;
  try {
    void fetchFn('/api/live-price-prefetch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ href: contextKey, generation }),
      keepalive: true,
    }).catch(() => {
      // Prefetch failure must not affect homepage.
    });
  } catch {
    return { fired: false, reason: 'fetch_error', generation, contextKey };
  }

  return { fired: true, generation, contextKey };
}
