import fs from 'node:fs';
import path from 'node:path';
import { normalizeOffer } from '../feeds/canonical/normalize-offer';
import { mergeEnabledProviderCatalog } from '../feeds/importers/merge-provider-catalog';
import { FEED_PATHS } from '../feeds/feed-paths';
import type { StoredOffer } from '../feeds/types/stored-offer';
import { splitStoredCatalog } from './compact-runtime';
import { deriveFilterOptions } from './derive-filter-options';
import {
  selectVacationWebFlightPackages,
  summarizeFlightPackageEligibility,
  type FlightPackageEligibilityStats,
} from './flight-package-eligibility';

export function writeJsonAtomic(filePath: string, value: unknown, pretty = false): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tempPath = path.join(
    dir,
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`,
  );
  fs.writeFileSync(tempPath, pretty ? JSON.stringify(value, null, 2) : JSON.stringify(value));
  fs.renameSync(tempPath, filePath);
}

export type PublishedRuntimeCatalog = {
  offerCount: number;
  runtimeBytes: number;
  detailCount: number;
  detailBytes: number;
  filterOptionsBytes: number;
  eligibility: FlightPackageEligibilityStats;
};

/**
 * Writes the compact Results runtime catalog, offer-detail sidecar, and
 * import-time filter metadata. Pretty-print is used only for filter-options
 * (small, human-readable). Runtime/detail files are minified.
 *
 * Provider merge runs here so compact rebuild cannot reintroduce overlay
 * duplicates that already share a bookable context.
 */
export function publishLocalRuntimeCatalog(offers: StoredOffer[]): PublishedRuntimeCatalog {
  if (offers.length === 0) {
    throw new Error('Refusing to publish an empty runtime catalog');
  }

  const merged = mergeEnabledProviderCatalog(offers);
  const eligibility = summarizeFlightPackageEligibility(merged);
  const catalogOffers = selectVacationWebFlightPackages(merged);
  if (catalogOffers.length === 0) {
    throw new Error('Refusing to publish a runtime catalog without VacationWeb flight packages');
  }

  const filterOptions = deriveFilterOptions(catalogOffers.map(normalizeOffer));
  const { runtime, details } = splitStoredCatalog(catalogOffers);

  writeJsonAtomic(FEED_PATHS.offers, runtime, false);
  writeJsonAtomic(FEED_PATHS.offerDetails, details, false);
  writeJsonAtomic(FEED_PATHS.filterOptions, filterOptions, true);

  return {
    offerCount: runtime.length,
    runtimeBytes: fs.statSync(FEED_PATHS.offers).size,
    detailCount: Object.keys(details).length,
    detailBytes: fs.statSync(FEED_PATHS.offerDetails).size,
    filterOptionsBytes: fs.statSync(FEED_PATHS.filterOptions).size,
    eligibility,
  };
}
