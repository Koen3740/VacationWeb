import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { buildResultsHref } from '../components/search/shared-search-state';
import { createDefaultTravelersState } from '../components/search/travelers-popup/travelers-popup-utils';
import { loadOfferById } from '../lib/offers/load-offer-by-id';
import { loadOffers } from '../lib/offers/load-offers';
import { evaluateWp7RuntimeFlow } from '../lib/search/wp7-runtime-flow';
import { FEED_PATHS } from '../lib/feeds/feed-paths';
import { headStorageObject } from '../lib/storage/object-storage-client';

async function main(): Promise<void> {
  if (process.env.VACATIONWEB_OFFERS_FILE) {
    delete process.env.VACATIONWEB_OFFERS_FILE;
  }
  if (process.env.VACATIONWEB_OFFER_DETAILS_FILE) {
    delete process.env.VACATIONWEB_OFFER_DETAILS_FILE;
  }

  const offersHead = await headStorageObject(FEED_PATHS.offersObjectKey);
  const detailsHead = await headStorageObject(FEED_PATHS.offerDetailsObjectKey);
  const offers = await loadOffers();

  const searchHref = buildResultsHref({
    selectedCountries: ['Spanje'],
    departureStart: '2026-09-01',
    departureEnd: '2026-09-30',
    flexibilityDays: 0,
    selectedDurations: [7, 8],
    selectedDepartureAirports: [],
    travelers: createDefaultTravelersState(),
  });

  const flow = evaluateWp7RuntimeFlow(offers, searchHref);

  const detailChecks: Array<{
    id: string;
    loaded: boolean;
    hotelName?: string;
    hasLongCopy?: boolean;
    deepLinkUnchanged?: boolean;
  }> = [];

  for (const sample of flow.samples.slice(0, 3)) {
    const loaded = await loadOfferById(sample.id);
    detailChecks.push({
      id: sample.id,
      loaded: Boolean(loaded),
      hotelName: loaded?.hotelName,
      hasLongCopy: Boolean(
        loaded?.descriptionLong?.trim()
        || loaded?.feedDescription?.trim()
        || loaded?.descriptionShort?.trim(),
      ),
      deepLinkUnchanged: loaded ? loaded.deepLink === sample.deepLink : false,
    });
    if (!loaded) {
      flow.failures.push(`loadOfferById missed ${sample.id}`);
    } else if (loaded.deepLink !== sample.deepLink) {
      flow.failures.push(`loadOfferById changed deepLink for ${sample.id}`);
    }
  }

  const hasCorendonSample = flow.samples.some((sample) => sample.provider === 'Corendon');
  if (!hasCorendonSample) {
    const corendon = offers.find((offer) => offer.provider === 'Corendon' && offer.deepLink?.trim());
    if (corendon) {
      const loaded = await loadOfferById(corendon.id);
      detailChecks.push({
        id: corendon.id,
        loaded: Boolean(loaded),
        hotelName: loaded?.hotelName,
        hasLongCopy: Boolean(
          loaded?.descriptionLong?.trim()
          || loaded?.feedDescription?.trim()
          || loaded?.descriptionShort?.trim(),
        ),
        deepLinkUnchanged: loaded ? loaded.deepLink === corendon.deepLink : false,
      });
      if (!loaded) {
        flow.failures.push(`loadOfferById missed Corendon ${corendon.id}`);
      }
    } else {
      flow.failures.push('no Corendon offer with deepLink in R2 catalog');
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    r2: {
      offersKey: FEED_PATHS.offersObjectKey,
      offersBytes: offersHead?.contentLength ?? null,
      detailsKey: FEED_PATHS.offerDetailsObjectKey,
      detailsBytes: detailsHead?.contentLength ?? null,
    },
    flow,
    detailChecks,
    ok: flow.failures.length === 0,
  };

  const outPath = path.join(process.cwd(), 'data', '_wp7-runtime-validate.json');
  writeFileSync(outPath, JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ ok: report.ok, outPath, failures: flow.failures, catalogCount: flow.catalogCount, byProvider: flow.byProvider, matchCount: flow.matchCount, matchByProvider: flow.matchByProvider, page1Count: flow.page1Count, page1CandidateByProvider: flow.page1CandidateByProvider, page1PresentableByProvider: flow.page1PresentableByProvider, samples: flow.samples.map((s) => ({ id: s.id, provider: s.provider, presentable: s.catalogPresentable })), r2: report.r2, detailChecks }, null, 2));

  if (!report.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
