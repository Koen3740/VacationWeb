import { loadRuntimeDataset, resetRuntimeDatasetCacheForTests } from '@/lib/offers/load-runtime-dataset';
import { TravelOffer } from '@/types/travel';

export function resetLoadOffersCacheForTests(): void {
  resetRuntimeDatasetCacheForTests();
}

export async function loadOffers(): Promise<TravelOffer[]> {
  return (await loadRuntimeDataset()).offers;
}
