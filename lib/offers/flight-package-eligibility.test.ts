import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeOffer } from '@/lib/feeds/canonical/normalize-offer';
import { importSunwebXml } from '@/lib/feeds/importers/sunweb';
import { annotateSunwebSource, mergeSunwebOffers } from '@/lib/feeds/importers/sunweb-merge';
import {
  isVacationWebFlightPackage,
  selectVacationWebFlightPackages,
  summarizeFlightPackageEligibility,
} from '@/lib/offers/flight-package-eligibility';
import { parseCorendonUrlFragment } from '@/lib/providers/corendon/offer-context';
import { parseElizaLandingQuery } from '@/lib/providers/eliza/offer-context';
import { parseSunwebLandingQuery } from '@/lib/providers/sunweb/offer-context';
import { filterOffers } from '@/lib/search/filtering';
import { paginateResults } from '@/lib/search/pagination';
import type { TravelOffer } from '@/types/travel';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

function wrapTt(hostPath: string, tt: string, landing: string): string {
  return `${hostPath}?tt=${tt}&r=${encodeURIComponent(landing)}`;
}

function sunwebLanding(options: {
  transport: string;
  airport?: string;
  date?: string;
  duration?: string;
  mealplan?: string;
}): string {
  const airport = options.airport ? `&DepartureAirport[0]=${options.airport}` : '';
  return (
    'https://www.sunweb.be/nl/vakantie/spanje/costa-brava/lloret-de-mar/hotel-alegria-florida' +
    `?Duration[0]=${options.duration ?? '8'}&TransportType[0]=${options.transport}` +
    `&Mealplan[0]=${options.mealplan ?? 'LO'}${airport}` +
    `&DepartureDate[0]=${options.date ?? '2026-08-27'}`
  );
}

function sunwebDeepLink(options: {
  transport: string;
  airport?: string;
  tt?: string;
  date?: string;
}): string {
  return wrapTt(
    'https://www.sunweb.be/nl/vakantie/reizen',
    options.tt ?? '1393_1754875_511747_',
    sunwebLanding(options),
  );
}

function elizaDeepLink(options: { transport: string; airport?: string }): string {
  const airport = options.airport ? `&DepartureAirport[0]=${options.airport}` : '';
  const landing =
    'https://www.elizawashere.be/spanje/ronda/casita' +
    `?Duration[0]=8&TransportType[0]=${options.transport}&Mealplan[0]=LG${airport}` +
    '&DepartureDate[0]=2026-11-19' +
    '&Participants[0][0]=1996-07-30&Participants[0][1]=1996-07-30';
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
    departureDate: '2026-08-27',
    ...overrides,
  };
}

test('1. Sunweb SelfDrive is excluded from VacationWeb', () => {
  const offer = makeOffer({
    id: 'sunweb-87919-2026-08-27-8-none-Logiesontbijt',
    provider: 'Sunweb',
    hotelName: 'Hotel ALEGRIA Florida',
    flightIncluded: 'SelfDrive',
    deepLink: sunwebDeepLink({ transport: 'SelfDrive' }),
  });
  assert.equal(isVacationWebFlightPackage(offer), false);
  assert.equal(filterOffers([offer], { nights: [8] }).length, 0);
});

test('G. SelfDrive + hasCarRental=true stays out of Results', () => {
  const offer = makeOffer({
    id: 'sunweb-selfdrive-car',
    provider: 'Sunweb',
    hotelName: 'Hotel ALEGRIA Florida',
    flightIncluded: 'SelfDrive',
    hasCarRental: true,
    deepLink: sunwebDeepLink({ transport: 'SelfDrive' }),
  });
  assert.equal(isVacationWebFlightPackage(offer), false);
  assert.equal(filterOffers([offer], {}).length, 0);
  assert.equal(filterOffers([offer], { hasCarRental: true }).length, 0);
});

test('2. Sunweb Flight with usable airport is kept', () => {
  const offer = makeOffer({
    id: 'sunweb-38128-2026-08-28-8-BRU-Logies',
    provider: 'Sunweb',
    flightIncluded: 'true',
    departureAirport: 'BRU',
    deepLink: sunwebDeepLink({ transport: 'Flight', airport: 'BRU' }),
  });
  assert.equal(isVacationWebFlightPackage(offer), true);
  assert.equal(filterOffers([offer], { nights: [8] }).length, 1);
});

test('3. Sunweb Flight without usable airport is not presented', () => {
  const offer = makeOffer({
    id: 'sunweb-flight-no-airport',
    provider: 'Sunweb',
    flightIncluded: 'true',
    deepLink: sunwebDeepLink({ transport: 'Flight' }),
  });
  assert.equal(isVacationWebFlightPackage(offer), false);
  assert.equal(filterOffers([offer], {}).length, 0);
});

test('airport=none is not a usable VacationWeb airport', () => {
  const offer = makeOffer({
    id: 'sunweb-none-slot',
    provider: 'Sunweb',
    flightIncluded: 'true',
    departureAirport: 'none',
    deepLink: sunwebDeepLink({ transport: 'Flight' }),
  });
  assert.equal(isVacationWebFlightPackage(offer), false);
});

test('4. Eliza valid Flight package is kept', () => {
  const offer = makeOffer({
    id: 'eliza-6270665',
    provider: 'Eliza was here',
    flightIncluded: 'true',
    departureAirport: 'BRU',
    deepLink: elizaDeepLink({ transport: 'Flight', airport: 'BRU' }),
  });
  assert.equal(isVacationWebFlightPackage(offer), true);
  assert.equal(filterOffers([offer], { nights: [8] }).length, 1);
});

test('Eliza SelfDrive is excluded', () => {
  const offer = makeOffer({
    id: 'eliza-selfdrive',
    provider: 'Eliza was here',
    flightIncluded: 'SelfDrive',
    deepLink: elizaDeepLink({ transport: 'SelfDrive' }),
  });
  assert.equal(isVacationWebFlightPackage(offer), false);
});

test('F. Eliza SelfDrive + hypothetical hasCarRental=true stays out of Results', () => {
  const offer = makeOffer({
    id: 'eliza-selfdrive-car',
    provider: 'Eliza was here',
    flightIncluded: 'SelfDrive',
    hasCarRental: true,
    deepLink: elizaDeepLink({ transport: 'SelfDrive' }),
  });
  assert.equal(isVacationWebFlightPackage(offer), false);
  assert.equal(filterOffers([offer], {}).length, 0);
  assert.equal(filterOffers([offer], { hasCarRental: true }).length, 0);
});

test('5. Corendon valid Flight package is kept', () => {
  const offer = makeOffer({
    id: 'corendon-5007',
    provider: 'Corendon',
    flightIncluded: 'true',
    departureAirport: 'BRU',
    deepLink: corendonDeepLink('BRUPMI'),
  });
  assert.equal(isVacationWebFlightPackage(offer), true);
  assert.equal(filterOffers([offer], { nights: [8] }).length, 1);
});

test('Corendon hotel-only empty airportRoute is excluded', () => {
  const offer = makeOffer({
    id: 'corendon-city-hotel',
    provider: 'Corendon',
    flightIncluded: 'false',
    deepLink: corendonDeepLink(''),
  });
  assert.equal(isVacationWebFlightPackage(offer), false);
  assert.equal(filterOffers([offer], {}).length, 0);
});

test('Prijsvrij VL flight package is kept without inventing an airport', () => {
  const offer = makeOffer({
    id: 'prijsvrij-100',
    provider: 'Prijsvrij',
    flightIncluded: 'true',
    deepLink: prijsvrijDeepLink('vl'),
  });
  assert.equal(isVacationWebFlightPackage(offer), true);
});

test('Prijsvrij hotel-only HO is excluded', () => {
  const offer = makeOffer({
    id: 'prijsvrij-ho',
    provider: 'Prijsvrij',
    flightIncluded: 'HO',
    deepLink: prijsvrijDeepLink('ho'),
  });
  assert.equal(isVacationWebFlightPackage(offer), false);
});

test('6. multiple Flight listings stay one TravelOffer with listings kept', () => {
  const xml = (tt: string, iataProp: string) => `<?xml version="1.0" encoding="utf-8"?><products>
<product ID="38128">
<campaignID>1393</campaignID>
<name>Appartementen Villa's Elpiniki</name>
<price currency="EUR">526.00</price>
<URL>${wrapTt(
    'https://www.sunweb.be/nl/vakantie/reizen',
    tt,
    sunwebLanding({ transport: 'Flight', airport: 'BRU', date: '2026-08-28', mealplan: 'LG' }),
  ).replace(/&/g, '&amp;')}</URL>
<properties>
<property name="departureDate"><value>08/28/2026</value></property>
<property name="duration"><value>8</value></property>
<property name="transportType"><value>Flight</value></property>
<property name="country"><value>Griekenland</value></property>
${iataProp}
<property name="serviceType"><value>Logies</value></property>
</properties>
</product>
</products>`;

  const first = annotateSunwebSource(
    importSunwebXml(xml('1393_1754875_511747_', '<property name="IsoCodeDeparture"><value>BRU</value></property>')),
    'sunweb-accomodatie',
  );
  const second = annotateSunwebSource(
    importSunwebXml(xml('1393_2087580_511747_', '<property name="iataDeparture"><value>BRU</value></property>')),
    'sunweb-griekenland',
  );
  const { offers } = mergeSunwebOffers([...first, ...second]);
  assert.equal(offers.length, 1);
  assert.equal(offers[0].providerListings?.length, 2);
  const travel = offers.map(normalizeOffer);
  assert.equal(selectVacationWebFlightPackages(travel).length, 1);
  assert.equal(filterOffers(travel, { nights: [8], departureStart: '2026-08-28', departureEnd: '2026-08-28' }).length, 1);
  assert.equal(travel[0].providerListings?.length, 2);
});

test('7-8. SelfDrive merge cannot enter Results count or pagination', () => {
  const xml = (tt: string) => `<?xml version="1.0" encoding="utf-8"?><products>
<product ID="87919">
<campaignID>1393</campaignID>
<name>Hotel ALEGRIA Florida</name>
<price currency="EUR">520.00</price>
<URL>${wrapTt(
    'https://www.sunweb.be/nl/vakantie/reizen',
    tt,
    sunwebLanding({ transport: 'SelfDrive' }),
  ).replace(/&/g, '&amp;')}</URL>
<properties>
<property name="departureDate"><value>08/27/2026</value></property>
<property name="duration"><value>8</value></property>
<property name="transportType"><value>SelfDrive</value></property>
<property name="country"><value>Spanje</value></property>
<property name="serviceType"><value>Logies ontbijt</value></property>
</properties>
</product>
</products>`;

  const { offers } = mergeSunwebOffers([
    ...annotateSunwebSource(importSunwebXml(xml('1393_1754875_511747_')), 'sunweb-accomodatie'),
    ...annotateSunwebSource(importSunwebXml(xml('1393_2086955_511747_')), 'sunweb-spanje'),
    ...annotateSunwebSource(importSunwebXml(xml('1393_1761331_511747_')), 'sunweb-lastminute'),
  ]);
  assert.equal(offers.length, 1, 'merge may still union SelfDrive overlays for audit');
  const travel = offers.map(normalizeOffer);
  const filtered = filterOffers(travel, {
    nights: [8],
    departureStart: '2026-08-27',
    departureEnd: '2026-08-27',
  });
  assert.equal(filtered.length, 0);
  assert.equal(paginateResults(filtered, 1, 10).length, 0);
  const stats = summarizeFlightPackageEligibility(travel);
  assert.equal(stats.kept, 0);
  assert.equal(stats.excluded, 1);
});

test('9. existing airport filter still works on Flight packages', () => {
  const bru = makeOffer({
    id: 'sunweb-bru',
    provider: 'Sunweb',
    flightIncluded: 'true',
    departureAirport: 'BRU',
    deepLink: sunwebDeepLink({ transport: 'Flight', airport: 'BRU' }),
  });
  const ein = makeOffer({
    id: 'sunweb-ein',
    provider: 'Sunweb',
    flightIncluded: 'true',
    departureAirport: 'EIN',
    deepLink: sunwebDeepLink({ transport: 'Flight', airport: 'EIN', tt: '1393_ein_511747_' }),
  });
  const filtered = filterOffers([bru, ein], { departureAirport: 'BRU' });
  assert.deepEqual(filtered.map((offer) => offer.id), ['sunweb-bru']);
});

test('10. existing departure-date filter still works on Flight packages', () => {
  const august = makeOffer({
    id: 'sunweb-aug',
    provider: 'Sunweb',
    flightIncluded: 'true',
    departureAirport: 'BRU',
    departureDate: '2026-08-27',
    deepLink: sunwebDeepLink({ transport: 'Flight', airport: 'BRU', date: '2026-08-27' }),
  });
  const september = makeOffer({
    id: 'sunweb-sep',
    provider: 'Sunweb',
    flightIncluded: 'true',
    departureAirport: 'BRU',
    departureDate: '2026-09-03',
    deepLink: sunwebDeepLink({ transport: 'Flight', airport: 'BRU' }),
  });
  const filtered = filterOffers([august, september], {
    departureStart: '2026-08-27',
    departureEnd: '2026-08-27',
  });
  assert.deepEqual(filtered.map((offer) => offer.id), ['sunweb-aug']);
});

test('11. live-price parsers still require a proven flight hop', () => {
  const flightLanding = sunwebDeepLink({ transport: 'Flight', airport: 'BRU' });
  const selfdriveLanding = sunwebDeepLink({ transport: 'SelfDrive' });
  assert.ok(parseSunwebLandingQuery(flightLanding, '87919'));
  assert.equal(parseSunwebLandingQuery(selfdriveLanding, '87919'), null);

  const elizaFlight = elizaDeepLink({ transport: 'Flight', airport: 'BRU' });
  assert.ok(parseElizaLandingQuery(elizaFlight, '6270665'));
  assert.equal(parseElizaLandingQuery(elizaDeepLink({ transport: 'SelfDrive' }), '6270665'), null);

  assert.ok(parseCorendonUrlFragment(corendonDeepLink('BRUPMI')));
  assert.equal(parseCorendonUrlFragment(corendonDeepLink('')), null);

  const sunwebLive = readFileSync(join(ROOT, 'lib/providers/sunweb/offer-context.ts'), 'utf8');
  const corendonLive = readFileSync(join(ROOT, 'lib/providers/corendon/offer-context.ts'), 'utf8');
  const elizaLive = readFileSync(join(ROOT, 'lib/providers/eliza/offer-context.ts'), 'utf8');
  assert.match(sunwebLive, /transportType !== 'Flight'/);
  assert.match(corendonLive, /!airportRoute/);
  assert.match(elizaLive, /transportType !== 'Flight'/);
});
