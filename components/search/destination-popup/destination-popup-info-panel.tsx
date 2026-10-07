import { DestinationPopupInfoPanelView } from '@/components/search/destination-popup/destination-popup-info-panel-view';
import { loadTotalOffersLabel } from '@/lib/offers/load-total-offers-label';
import type { SiteMarket } from '@/lib/search/site-market';

export async function DestinationPopupInfoPanel({ siteMarket }: { siteMarket?: SiteMarket } = {}) {
  const totalOffersLabel = await loadTotalOffersLabel(siteMarket);

  return <DestinationPopupInfoPanelView totalOffersLabel={totalOffersLabel} />;
}
