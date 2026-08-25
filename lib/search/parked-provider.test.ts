import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import type { TravelOffer } from '@/types/travel';
import { filterOffers } from './filtering';
import {
  CORENDON_PROVIDER_NAME,
  ELIZA_PROVIDER_NAME,
  excludeParkedResultsProviders,
  isParkedResultsProvider,
  PRIJSVRIJ_PROVIDER_NAME,
  SUNWEB_PROVIDER_NAME,
} from './presentable-price';

function flightDeepLink(provider: string): string {
  if (provider === SUNWEB_PROVIDER_NAME) {
    return (
      'https://www.sunweb.be/nl/vakantie/reizen?tt=1&r=' +
      encodeURIComponent(
        'https://www.sunweb.be/nl/vakantie/x?Duration[0]=8&TransportType[0]=Flight&Mealplan[0]=LO&DepartureAirport[0]=BRU&DepartureDate[0]=2026-08-20',
      )
    );
  }
  if (provider === ELIZA_PROVIDER_NAME) {
    return (
      'https://www.elizawashere.be/reizen?tt=1&r=' +
      encodeURIComponent(
        'https://www.elizawashere.be/x?Duration[0]=8&TransportType[0]=Flight&Mealplan[0]=LG&DepartureAirport[0]=BRU&DepartureDate[0]=2026-08-27',
      )
    );
  }
  if (provider === PRIJSVRIJ_PROVIDER_NAME) {
    return (
      'https://www.prijsvrij.be/vakantie/?r=' +
      encodeURIComponent('https://www.prijsvrij.be/vakanties/spanje?transport=vl')
    );
  }
  return 'https://www.corendon.be/vakantie#5007.MLELC.BRUPMI.200826.8.DZI-U';
}

function makeOffer(overrides: Partial<TravelOffer> & Pick<TravelOffer, 'id' | 'provider'>): TravelOffer {
  return {
    hotelName: 'Test Hotel',
    destinationCountry: 'Spanje',
    nights: 8,
    price: 800,
    pricePerDay: 100,
    imageUrl: 'https://example.com/a.jpg',
    flightIncluded: 'true',
    departureAirport: 'BRU',
    deepLink: flightDeepLink(overrides.provider),
    ...overrides,
  };
}

test('Prijsvrij is PARKED and never a visible Results offer', () => {
  assert.equal(isParkedResultsProvider(PRIJSVRIJ_PROVIDER_NAME), true);
  assert.equal(isParkedResultsProvider(CORENDON_PROVIDER_NAME), false);
  assert.equal(isParkedResultsProvider(SUNWEB_PROVIDER_NAME), false);
  assert.equal(isParkedResultsProvider(ELIZA_PROVIDER_NAME), false);

  const parked = makeOffer({
    id: 'prijsvrij-parked-results',
    provider: PRIJSVRIJ_PROVIDER_NAME,
    livePriceStatus: 'proven',
    livePriceSource: 'receipt',
    price: 412,
  });
  assert.deepEqual(
    excludeParkedResultsProviders([parked]).map((offer) => offer.id),
    [],
  );
});

test('excluding parked Prijsvrij keeps Corendon, Sunweb and Eliza', () => {
  const offers = [
    makeOffer({ id: 'corendon-1', provider: CORENDON_PROVIDER_NAME }),
    makeOffer({ id: 'sunweb-1', provider: SUNWEB_PROVIDER_NAME }),
    makeOffer({ id: 'eliza-1', provider: ELIZA_PROVIDER_NAME }),
    makeOffer({ id: 'prijsvrij-1', provider: PRIJSVRIJ_PROVIDER_NAME }),
  ];
  assert.deepEqual(
    excludeParkedResultsProviders(offers).map((offer) => offer.id),
    ['corendon-1', 'sunweb-1', 'eliza-1'],
  );
  assert.deepEqual(
    filterOffers(excludeParkedResultsProviders(offers), {}).map((offer) => offer.id),
    ['corendon-1', 'sunweb-1', 'eliza-1'],
  );
});

test('Results page drops parked Prijsvrij before ranking', () => {
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../app/results/page.tsx'), 'utf8');
  assert.match(src, /excludeParkedResultsProviders\(await loadOffers\(\)\)/);
});

test('parked Prijsvrij detail is not-found, not a half-working page', () => {
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../app/offers/[id]/page.tsx'), 'utf8');
  assert.match(src, /isParkedResultsProvider\(catalogOffer\.provider\)/);
});
