import { paginateResults, RESULTS_PAGE_SIZE_DEFAULT } from '@/lib/search/pagination';
import { filterToResultsListableOffers } from '@/lib/search/presentable-price';
import type { TravelOffer } from '@/types/travel';

export type RankedCatalogResultsPage = {
  offers: TravelOffer[];
  page1Ids: string[];
  paginationTotal: number;
};

/**
 * Ranked catalog slice for a Results page.
 * Live-price status does not remove an offer from the page.
 */
export function sliceRankedCatalogResultsPage(
  ranked: readonly TravelOffer[],
  page: number,
  pageSize: number = RESULTS_PAGE_SIZE_DEFAULT,
): RankedCatalogResultsPage {
  const listable = filterToResultsListableOffers(ranked as TravelOffer[]);
  const safePage = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
  const offers = paginateResults(listable, safePage, pageSize);
  return {
    offers,
    page1Ids: paginateResults(listable, 1, pageSize).map((offer) => offer.id),
    paginationTotal: listable.length,
  };
}
