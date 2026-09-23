/**
 * Pure homepage search-context helpers for AN-077 (safe for client + server).
 * No provider / cache / waitUntil imports.
 */

import {
  buildResultsHref,
  type SharedSearchState,
} from '@/components/search/shared-search-state';
import { normalizeTravelersState } from '@/components/search/travelers-popup/travelers-popup-utils';
import type { SearchParams } from '@/types/travel';

let enabledOverride: boolean | null = null;

export function isHomeLivePricePrefetchEnabled(): boolean {
  if (enabledOverride != null) {
    return enabledOverride;
  }
  const raw = process.env.HOME_LIVE_PRICE_PREFETCH_ENABLED?.trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

export function setHomeLivePricePrefetchEnabledForTests(enabled: boolean | null): void {
  enabledOverride = enabled;
}

/**
 * Definitive homepage context (AN-075 / AN-072 FINAL parity):
 * destination + departure dates set; travelers required via normalize.
 * Duration / airport may be empty (same as Results URL).
 */
export function isDefinitiveHomeSearchContext(state: SharedSearchState): boolean {
  if (state.selectedCountries.length === 0) {
    return false;
  }
  if (!state.departureStart) {
    return false;
  }
  const travelers = normalizeTravelersState(state.travelers);
  if (travelers.travellers.length === 0) {
    return false;
  }
  return true;
}

/** Canonical Results identity — same string Results navigation uses. */
export function homeSearchContextKey(state: SharedSearchState): string {
  return buildResultsHref(state);
}

export function isDefinitiveSearchParams(params: SearchParams): boolean {
  const hasCountry =
    Boolean(params.country) || Boolean(params.countries && params.countries.length > 0);
  return hasCountry && Boolean(params.departureStart);
}
