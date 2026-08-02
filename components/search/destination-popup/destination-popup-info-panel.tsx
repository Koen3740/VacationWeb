import { DestinationPopupInfoPanelView } from '@/components/search/destination-popup/destination-popup-info-panel-view';
import { loadTotalOffersLabel } from '@/lib/offers/load-total-offers-label';

export async function DestinationPopupInfoPanel() {
  const totalOffersLabel = await loadTotalOffersLabel();

  return <DestinationPopupInfoPanelView totalOffersLabel={totalOffersLabel} />;
}
