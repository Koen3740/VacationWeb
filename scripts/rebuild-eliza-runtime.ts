import fs from 'node:fs';
import path from 'node:path';
import { FEED_PATHS } from '../lib/feeds/feed-paths';
import { getEnabledFeeds } from '../lib/feeds/feed-registry';
import { importElizaXml } from '../lib/feeds/importers/eliza';
import type { StoredOffer } from '../lib/feeds/types/stored-offer';
import { normalizeOffer } from '../lib/feeds/canonical/normalize-offer';
import {
  isCompactStoredOffer,
  splitStoredCatalog,
  type OfferDetailRecord,
} from '../lib/offers/compact-runtime';
import { deriveFilterOptions } from '../lib/offers/derive-filter-options';
import {
  isVacationWebFlightPackage,
  selectVacationWebFlightPackages,
} from '../lib/offers/flight-package-eligibility';
import { writeJsonAtomic } from '../lib/offers/write-runtime-catalog';
import { ELIZA_PROVIDER_NAME } from '../lib/providers/eliza/constants';

function reconstructFromSidecar(runtime: StoredOffer[]): StoredOffer[] {
  if (!fs.existsSync(FEED_PATHS.offerDetails)) {
    throw new Error(
      'offers.json is already compact and offers.detail.json is missing — cannot rebuild',
    );
  }

  const parsed = JSON.parse(fs.readFileSync(FEED_PATHS.offerDetails, 'utf8')) as Record<
    string,
    OfferDetailRecord
  >;

  return runtime.map((offer) => ({
    ...offer,
    ...(parsed[offer.externalId] ?? {}),
  }));
}

function loadRuntimeOffers(): StoredOffer[] {
  if (!fs.existsSync(FEED_PATHS.offers)) {
    throw new Error(`Local catalog not found: ${FEED_PATHS.offers}`);
  }
  const parsed = JSON.parse(fs.readFileSync(FEED_PATHS.offers, 'utf8')) as unknown;
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('offers.json must be a non-empty JSON array');
  }
  return parsed as StoredOffer[];
}

function loadDetails(): Record<string, OfferDetailRecord> {
  if (!fs.existsSync(FEED_PATHS.offerDetails)) {
    return {};
  }
  return JSON.parse(fs.readFileSync(FEED_PATHS.offerDetails, 'utf8')) as Record<
    string,
    OfferDetailRecord
  >;
}

function snapshot(offers: StoredOffer[]) {
  const of = (provider: string) => offers.filter((offer) => offer.provider === provider);
  const car = (provider?: string) =>
    offers.filter(
      (offer) =>
        offer.hasCarRental === true && (provider == null || offer.provider === provider),
    );
  const selfDrive = (provider?: string) =>
    offers.filter((offer) => {
      if (provider && offer.provider !== provider) {
        return false;
      }
      const flight = String(offer.flightIncluded ?? '').toLowerCase();
      return flight === 'selfdrive';
    });

  return {
    total: offers.length,
    eliza: of(ELIZA_PROVIDER_NAME).length,
    elizaCar: car(ELIZA_PROVIDER_NAME).length,
    elizaSelfDrive: selfDrive(ELIZA_PROVIDER_NAME).length,
    sunweb: of('Sunweb').length,
    sunwebCar: car('Sunweb').length,
    corendon: of('Corendon').length,
    corendonCar: car('Corendon').length,
    prijsvrij: of('Prijsvrij').length,
    carTotal: car().length,
  };
}

function resolveElizaFeedPath(): string {
  const feed = getEnabledFeeds().find((entry) => entry.profile === 'eliza');
  if (!feed?.source.path) {
    throw new Error('No enabled Eliza feed in config/feed-manifest.json');
  }
  return path.isAbsolute(feed.source.path)
    ? feed.source.path
    : path.join(process.cwd(), feed.source.path);
}

function main(): void {
  const startedAt = Date.now();
  const beforeRuntime = loadRuntimeOffers();
  const before = snapshot(beforeRuntime);
  const compactCount = beforeRuntime.filter(isCompactStoredOffer).length;
  if (compactCount !== beforeRuntime.length) {
    throw new Error('Refusing Eliza splice: existing offers.json is not fully compact');
  }

  const feedPath = resolveElizaFeedPath();
  if (!fs.existsSync(feedPath)) {
    throw new Error(`Eliza feed not found: ${feedPath}`);
  }

  const imported = importElizaXml(fs.readFileSync(feedPath, 'utf8'));
  const importedFlight = imported.filter((offer) => offer.flightIncluded === 'true');
  const importedSelfDrive = imported.filter(
    (offer) => String(offer.flightIncluded ?? '').toLowerCase() === 'selfdrive',
  );
  const importedCar = imported.filter((offer) => offer.hasCarRental === true);
  const importedSelfDriveWithCar = importedSelfDrive.filter((offer) => offer.hasCarRental === true);
  const importedEligible = selectVacationWebFlightPackages(imported);
  const importedSelfDriveEligible = importedSelfDrive.filter((offer) =>
    isVacationWebFlightPackage(offer),
  );

  const keptEliza = importedEligible;
  const { runtime: elizaRuntime, details: elizaDetails } = splitStoredCatalog(keptEliza);

  const existingDetails = loadDetails();
  const remainingRuntime = beforeRuntime.filter((offer) => offer.provider !== ELIZA_PROVIDER_NAME);
  const remainingDetails: Record<string, OfferDetailRecord> = {};
  for (const [id, detail] of Object.entries(existingDetails)) {
    if (!id.startsWith('eliza-')) {
      remainingDetails[id] = detail;
    }
  }

  const nextRuntime = [...remainingRuntime, ...elizaRuntime];
  const nextDetails = { ...remainingDetails, ...elizaDetails };
  const filterOptions = deriveFilterOptions(nextRuntime.map(normalizeOffer));

  writeJsonAtomic(FEED_PATHS.offers, nextRuntime, false);
  writeJsonAtomic(FEED_PATHS.offerDetails, nextDetails, false);
  writeJsonAtomic(FEED_PATHS.filterOptions, filterOptions, true);

  const after = snapshot(nextRuntime);
  const durationMs = Date.now() - startedAt;

  console.log('✔ Eliza-only runtime splice (other providers untouched)');
  console.log(`  - feed: ${feedPath}`);
  console.log(`  - imported Eliza: ${imported.length}`);
  console.log(`  - imported Flight (flightIncluded=true): ${importedFlight.length}`);
  console.log(`  - imported SelfDrive: ${importedSelfDrive.length}`);
  console.log(`  - imported hasCarRental=true: ${importedCar.length}`);
  console.log(`  - imported SelfDrive with hasCarRental: ${importedSelfDriveWithCar.length}`);
  console.log(`  - imported eligible flight packages: ${importedEligible.length}`);
  console.log(`  - imported SelfDrive still eligible: ${importedSelfDriveEligible.length}`);
  console.log(`  - catalog before: ${JSON.stringify(before)}`);
  console.log(`  - catalog after: ${JSON.stringify(after)}`);
  console.log(`  - reconstructed compact input: ${compactCount === beforeRuntime.length}`);
  console.log(`  - duration: ${durationMs} ms`);
}

main();
