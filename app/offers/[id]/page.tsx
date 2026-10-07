import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import { OfferDetailContent } from '@/components/offers/offer-detail-content';
import {
  catalogSectionsForDisplay,
  resolveOfferRoomTypes,
  selectCatalogRoom,
  selectedRoomAllowsProvenLivePrice,
} from '@/lib/offers/catalog-content';
import {
  buildGalleryImages,
  collectThemeLabels,
  isLastMinuteOffer,
} from '@/lib/offers/offer-detail-view';
import { loadOfferById } from '@/lib/offers/load-offer-by-id';
import { buildResultsPageHref } from '@/lib/search/pagination';
import { parseSearchParams } from '@/lib/search/parse-search-params';
import { attachSiteMarket } from '@/lib/search/site-market';
import { offerForSiteMarket } from '@/lib/search/market-inventory';
import { hasValidPresentablePrice } from '@/lib/search/presentable-price';
import { priceOfferForDetail } from '@/lib/search/price-offer-for-detail';

export const dynamic = 'force-dynamic';

// Privacy (t361u): offer detail URLs can carry the search party (adults/childAges). Never index or follow.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function OfferDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const offerId = decodeURIComponent(params.id);
  const catalogOffer = await loadOfferById(offerId);

  if (!catalogOffer) {
    notFound();
  }

  const resultsParams = attachSiteMarket(
    parseSearchParams(searchParams),
    headers().get('x-forwarded-host') ?? headers().get('host'),
  );
  // SUB 33D: an offer outside this host's market universe is not eligible (same 404 as unknown id).
  const marketOffer = offerForSiteMarket(catalogOffer, resultsParams.siteMarket);
  if (!marketOffer) {
    notFound();
  }
  const offer = await priceOfferForDetail(marketOffer, resultsParams);
  const rooms = resolveOfferRoomTypes(offer);
  const selectedRoom = selectCatalogRoom(rooms, resultsParams.selectedRoom);
  const presentable =
    hasValidPresentablePrice(offer) && selectedRoomAllowsProvenLivePrice(selectedRoom);
  const resultsHref = buildResultsPageHref(resultsParams, resultsParams.page ?? 1);
  const copy = catalogSectionsForDisplay(offer.descriptionLong || offer.feedDescription);

  return (
    <OfferDetailContent
      offer={offer}
      params={resultsParams}
      resultsHref={resultsHref}
      galleryImages={buildGalleryImages(offer)}
      rooms={rooms}
      selectedRoom={selectedRoom}
      sections={copy.sections}
      intro={copy.intro}
      presentable={presentable}
      themes={collectThemeLabels(offer)}
      isLastMinute={isLastMinuteOffer(offer)}
    />
  );
}
