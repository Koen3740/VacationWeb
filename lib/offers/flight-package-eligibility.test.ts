import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isVacationWebFlightPackage,
  selectVacationWebFlightPackages,
  summarizeFlightPackageEligibility,
} from './flight-package-eligibility';
import { filterOffers } from '../search/filtering';
import type { TravelOffer } from '../../types/travel';

function wrapTt(hostPath: string, tt: string, landing: string): string {
  return `${hostPath}?tt=${tt}&r=${encodeURIComponent(landing)}`;
}

function sunwebLanding(options: { transport: string; airport?: string }): string {
  const airport = options.airport ? `&DepartureAirport[0]=${options.airport}` : '';
  return (
    'https://www.sunweb.be/nl/vakantie/spanje/costa-brava/lloret-de-mar/hotel-alegria-florida' +
    `?Duration[0]=8&TransportType[0]=${options.transport}` +
    `&Mealplan[0]=LO${airport}&DepartureDate[0]=2026-08-27`
  );
}

function sunwebDeepLink(options: { transport: string; airport?: string }): string {
  return wrapTt(
    'https://www.sunweb.be/nl/vakantie/reizen',
    '1393_1754875_511747_',
    sunwebLanding(options),
  );
}

function elizaDeepLink(options: { transport: string; airport?: string }): string {
  const airport = options.airport ? `&DepartureAirport[0]=${options.airport}` : '';
  const landing =
    'https://www.elizawashere.be/spanje/ronda/casita' +
    `?Duration[0]=8&TransportType[0]=${options.transport}&Mealplan[0]=LG${airport}` +
    '&DepartureDate[0]=2026-11-19';
  return wrapTt('https://www.elizawashere.be/reizen', '1327_2084000_511747_', landing);
}

function corendonDeepLink(airportRoute: string): string {
  return `https://www.corendon.be/vakantie#5007.MLELC.${airportRoute}.270826.8.DZI-U`;
}

function prijsvrijDeepLink(transport: string): string {
  return (
    'https://www.prijsvrij.be/vakantie/?r=' +
    encodeURIComponent(`https://www.prijsvrij.be/vakanties/spanje?transport=${transport}`)
  );
}

function makeOffer(overrides: Partial<TravelOffer> & Pick<TravelOffer, 'id' | 'provider'>): TravelOffer {
  return {
    hotelName: 'Test Hotel',
    destinationCountry: 'Spanje',
    nights: 8,
    price: 800,
    pricePerDay: 100,
    imageUrl: 'https://example.com/a.jpg',
    deepLink: 'https://example.com',
    ...overrides,
  };
}

test('A. Sunweb Flight + airport is eligible', () => {
  const offer = makeOffer({
    id: 'sunweb-flight',
    provider: 'Sunweb',
    flightIncluded: 'true',
    departureAirport: 'BRU',
    deepLink: sunwebDeepLink({ transport: 'Flight', airport: 'BRU' }),
  });
  assert.equal(isVacationWebFlightPackage(offer), true);
  assert.equal(filterOffers([offer], {}).length, 1);
});

test('B. Sunweb SelfDrive is not eligible', () => {
  const offer = makeOffer({
    id: 'sunweb-selfdrive',
    provider: 'Sunweb',
    flightIncluded: 'SelfDrive',
    departureAirport: 'BRU',
    deepLink: sunwebDeepLink({ transport: 'SelfDrive' }),
  });
  assert.equal(isVacationWebFlightPackage(offer), false);
  assert.equal(filterOffers([offer], {}).length, 0);
});

test('C. Eliza Flight + airport is eligible', () => {
  const offer = makeOffer({
    id: 'eliza-flight',
    provider: 'Eliza was here',
    flightIncluded: 'true',
    departureAirport: 'BRU',
    deepLink: elizaDeepLink({ transport: 'Flight', airport: 'BRU' }),
  });
  assert.equal(isVacationWebFlightPackage(offer), true);
  assert.equal(filterOffers([offer], {}).length, 1);
});

test('D. Eliza SelfDrive is not eligible', () => {
  const offer = makeOffer({
    id: 'eliza-selfdrive',
    provider: 'Eliza was here',
    flightIncluded: 'SelfDrive',
    deepLink: elizaDeepLink({ transport: 'SelfDrive' }),
  });
  assert.equal(isVacationWebFlightPackage(offer), false);
  assert.equal(filterOffers([offer], {}).length, 0);
});

test('E. Corendon Flight-package is eligible', () => {
  const offer = makeOffer({
    id: 'corendon-flight',
    provider: 'Corendon',
    flightIncluded: 'true',
    departureAirport: 'BRU',
    deepLink: corendonDeepLink('BRUPMI'),
  });
  assert.equal(isVacationWebFlightPackage(offer), true);
  assert.equal(filterOffers([offer], {}).length, 1);
});

test('F. Corendon hotel-only is not eligible', () => {
  const offer = makeOffer({
    id: 'corendon-hotel',
    provider: 'Corendon',
    flightIncluded: 'false',
    deepLink: corendonDeepLink(''),
  });
  assert.equal(isVacationWebFlightPackage(offer), false);
  assert.equal(filterOffers([offer], {}).length, 0);
});

test('G. hasCarRental=true does not make SelfDrive eligible', () => {
  const sunweb = makeOffer({
    id: 'sunweb-selfdrive-car',
    provider: 'Sunweb',
    flightIncluded: 'SelfDrive',
    hasCarRental: true,
    deepLink: sunwebDeepLink({ transport: 'SelfDrive' }),
  });
  const eliza = makeOffer({
    id: 'eliza-selfdrive-car',
    provider: 'Eliza was here',
    flightIncluded: 'SelfDrive',
    hasCarRental: true,
    deepLink: elizaDeepLink({ transport: 'SelfDrive' }),
  });
  assert.equal(isVacationWebFlightPackage(sunweb), false);
  assert.equal(isVacationWebFlightPackage(eliza), false);
  assert.equal(filterOffers([sunweb, eliza], {}).length, 0);
  assert.equal(filterOffers([sunweb, eliza], { hasCarRental: true }).length, 0);
});

test('H. Flight without usable airport is not eligible', () => {
  const missing = makeOffer({
    id: 'sunweb-no-airport',
    provider: 'Sunweb',
    flightIncluded: 'true',
    deepLink: sunwebDeepLink({ transport: 'Flight' }),
  });
  const sentinel = makeOffer({
    id: 'sunweb-none-slot',
    provider: 'Sunweb',
    flightIncluded: 'true',
    departureAirport: 'none',
    deepLink: sunwebDeepLink({ transport: 'Flight' }),
  });
  assert.equal(isVacationWebFlightPackage(missing), false);
  assert.equal(isVacationWebFlightPackage(sentinel), false);
  assert.equal(filterOffers([missing, sentinel], {}).length, 0);
});

test('I. ordinary Flight-package fixtures stay eligible; hotel name is not used', () => {
  const named = makeOffer({
    id: 'sunweb-named',
    provider: 'Sunweb',
    hotelName: 'Olée Cala Agulla inclusief huurauto SelfDrive',
    flightIncluded: 'true',
    departureAirport: 'BRU',
    deepLink: sunwebDeepLink({ transport: 'Flight', airport: 'BRU' }),
  });
  assert.equal(isVacationWebFlightPackage(named), true);

  const prijsvrij = makeOffer({
    id: 'prijsvrij-vl',
    provider: 'Prijsvrij',
    flightIncluded: 'true',
    deepLink: prijsvrijDeepLink('vl'),
  });
  assert.equal(isVacationWebFlightPackage(prijsvrij), true);

  const prijsvrijHotel = makeOffer({
    id: 'prijsvrij-ho',
    provider: 'Prijsvrij',
    flightIncluded: 'HO',
    deepLink: prijsvrijDeepLink('ho'),
  });
  assert.equal(isVacationWebFlightPackage(prijsvrijHotel), false);

  const kept = selectVacationWebFlightPackages([named, prijsvrij, prijsvrijHotel]);
  assert.deepEqual(kept.map((offer) => offer.id), ['sunweb-named', 'prijsvrij-vl']);
  const stats = summarizeFlightPackageEligibility([named, prijsvrij, prijsvrijHotel]);
  assert.equal(stats.kept, 2);
  assert.equal(stats.excluded, 1);
});

test('filtering uses flight-package eligibility as the first gate', () => {
  const selfDrive = makeOffer({
    id: 'sunweb-selfdrive',
    provider: 'Sunweb',
    flightIncluded: 'SelfDrive',
    destinationCountry: 'Spanje',
    hasCarRental: true,
    deepLink: sunwebDeepLink({ transport: 'SelfDrive' }),
  });
  const flight = makeOffer({
    id: 'sunweb-flight',
    provider: 'Sunweb',
    flightIncluded: 'true',
    departureAirport: 'BRU',
    destinationCountry: 'Spanje',
    deepLink: sunwebDeepLink({ transport: 'Flight', airport: 'BRU' }),
  });
  assert.deepEqual(
    filterOffers([selfDrive, flight], { country: 'Spanje' }).map((offer) => offer.id),
    ['sunweb-flight'],
  );
});
