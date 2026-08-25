import assert from 'node:assert/strict';
import test from 'node:test';
import { presentActiveFilterOptions } from './present-active-filter-options';
import { formatTotalOffersLabel } from './load-total-offers-label';
import {
  CORENDON_PROVIDER_NAME,
  ELIZA_PROVIDER_NAME,
  PRIJSVRIJ_PROVIDER_NAME,
  SUNWEB_PROVIDER_NAME,
} from '@/lib/search/presentable-price';
import type { TravelOffer } from '@/types/travel';

function makeOffer(overrides: Partial<TravelOffer> & Pick<TravelOffer, 'id' | 'provider'>): TravelOffer {
  return {
    hotelName: 'Test Hotel',
    destinationCountry: 'Spanje',
    destinationRegion: 'Mallorca',
    nights: 8,
    price: 800,
    pricePerDay: 100,
    imageUrl: 'https://example.com/a.jpg',
    deepLink: 'https://www.corendon.be/x',
    flightIncluded: 'true',
    departureAirport: 'BRU',
    ...overrides,
  };
}

test('presented vacation count excludes parked Prijsvrij and keeps active providers', () => {
  const options = presentActiveFilterOptions([
    makeOffer({ id: 'c1', provider: CORENDON_PROVIDER_NAME }),
    makeOffer({ id: 's1', provider: SUNWEB_PROVIDER_NAME }),
    makeOffer({ id: 'e1', provider: ELIZA_PROVIDER_NAME }),
    makeOffer({ id: 'p1', provider: PRIJSVRIJ_PROVIDER_NAME, destinationCountry: 'Saint Martin - French Part' }),
    makeOffer({ id: 'p2', provider: PRIJSVRIJ_PROVIDER_NAME }),
  ]);

  assert.equal(options.totalOffers, 3);
  assert.equal(options.countryCounts?.Spanje, 3);
  assert.equal(options.countries.includes('Saint Martin - French Part'), false);
  assert.equal(formatTotalOffersLabel(8963), '8.000+ vakanties');
});
