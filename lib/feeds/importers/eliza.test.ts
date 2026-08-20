import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeOffer } from '../canonical/normalize-offer';
import { importXmlByProfile } from '../importer-router';
import { compactStoredOffer } from '../../offers/compact-runtime';
import { isVacationWebFlightPackage } from '../../offers/flight-package-eligibility';
import { buildElizaLiveContext, extractElizaAccommodationId } from '../../providers/eliza/offer-context';
import { importElizaXml } from './eliza';

const PRODUCT_URL =
  'https://www.elizawashere.be/reizen?tt=1327_2084000_511747_&r=' +
    encodeURIComponent(
    'https://www.elizawashere.be/spanje/andalusie/ronda/casita-paradise-island' +
      '?Duration[0]=8&TransportType[0]=Flight&Mealplan[0]=LG' +
      '&DepartureAirport[0]=BRU&DepartureDate[0]=2026-11-19' +
      '&Participants[0][0]=1996-07-30&Participants[0][1]=1996-07-30',
  );

const SELFDRIVE_URL =
  'https://www.elizawashere.be/reizen?tt=1327_2084000_511747_&r=' +
    encodeURIComponent(
    'https://www.elizawashere.be/spanje/andalusie/ronda/casita-paradise-island' +
      '?Duration[0]=8&TransportType[0]=SelfDrive&Mealplan[0]=LG' +
      '&DepartureDate[0]=2026-11-19' +
      '&Participants[0][0]=1996-07-30&Participants[0][1]=1996-07-30',
  );

function productXml(
  overrides: {
    id?: string;
    url?: string;
    airport?: string;
    transportType?: string;
    name?: string;
    usps?: string;
    description?: string;
  } = {},
): string {
  const id = overrides.id ?? '6270665';
  const transportType = overrides.transportType ?? 'Flight';
  const url =
    overrides.url ??
    (transportType.toLowerCase() === 'selfdrive' ? SELFDRIVE_URL : PRODUCT_URL).replace(/&/g, '&amp;');
  const airport = overrides.airport ?? (transportType.toLowerCase() === 'selfdrive' ? '' : 'BRU');
  const name = overrides.name ?? 'Casita Paradise Island';
  const usps = overrides.usps ?? 'Terras met bergview;Privé sauna';
  const description = overrides.description
    ? `<property name="descriptionLong"><value>${overrides.description}</value></property>`
    : '';
  const airportProperty = airport
    ? `<property name="airport"><value>${airport}</value></property>`
    : '';
  return `<product ID="${id}">
<campaignID>1327</campaignID>
<name>${name}</name>
<price currency="EUR">599.00</price>
<URL>${url}</URL>
<images>
<image>https://static.elizawashere.be/a.jpg</image>
<image>https://static.elizawashere.be/b.jpg</image>
</images>
<properties>
<property name="country"><value>Spanje</value></property>
<property name="region"><value>Andalusië</value></property>
<property name="city"><value>Ronda</value></property>
<property name="stars"><value>4</value></property>
<property name="departureDate"><value>11/19/2026</value></property>
<property name="transportType"><value>${transportType}</value></property>
<property name="duration"><value>8</value></property>
<property name="serviceType"><value>LG</value></property>
${airportProperty}
<property name="usps"><value>${usps}</value></property>
${description}
</properties>
</product>`;
}

function feedXml(products: string): string {
  return `<?xml version="1.0" encoding="utf-8"?><products>${products}</products>`;
}

test('Eliza import: eliza-{accoId}, provider name, productURL deepLink', () => {
  const [offer] = importElizaXml(feedXml(productXml()));
  assert.equal(offer.provider, 'Eliza was here');
  assert.equal(offer.externalId, 'eliza-6270665');
  assert.equal(extractElizaAccommodationId(offer.externalId), '6270665');
  assert.equal(offer.affiliateCampaignId, '1327');
  assert.ok(offer.deepLink);
  assert.ok(offer.deepLink.includes('elizawashere.be/reizen'));
  assert.ok(offer.deepLink.includes('r='));
  assert.ok(offer.deepLink.includes('DepartureAirport'));
  assert.equal(offer.hotelName, 'Casita Paradise Island');
  assert.equal(offer.price, 599);
});

test('Eliza import: canonical trip fields come from productURL, not stale property airport', () => {
  const [offer] = importElizaXml(feedXml(productXml({ airport: 'CRL' })));
  assert.equal(offer.departureAirport, 'BRU');
  assert.equal(offer.departureAirportCode, 'BRU');
  assert.equal(offer.airport, 'CRL');
  assert.equal(offer.departureDate, '2026-11-19');
  assert.equal(offer.nights, 8);
  assert.equal(offer.flightIncluded, 'true');
  assert.equal(offer.boardType, 'Logies');
});

test('Eliza import: router profile eliza and unique IDs', () => {
  const offers = importXmlByProfile(
    'eliza',
    feedXml(productXml() + productXml({ id: '6216517' })),
  );
  assert.equal(offers.length, 2);
  assert.deepEqual(
    offers.map((offer) => offer.externalId).sort(),
    ['eliza-6216517', 'eliza-6270665'],
  );
});

test('Eliza import: normalized TravelOffer keeps id and deepLink for live adapter', () => {
  const [stored] = importElizaXml(feedXml(productXml()));
  const offer = normalizeOffer(stored);
  assert.equal(offer.id, 'eliza-6270665');
  assert.equal(offer.provider, 'Eliza was here');
  assert.equal(offer.deepLink, stored.deepLink);
  const ctx = buildElizaLiveContext(offer, { adults: 2 });
  assert.ok(ctx);
  assert.equal(ctx.accoId, '6270665');
  assert.equal(ctx.query.departureAirport, 'BRU');
  assert.equal(ctx.query.departureDate, '2026-11-19');
  assert.equal(ctx.query.duration, '8');
  assert.equal(ctx.query.mealplan, 'LG');
});

test('A. Eliza Flight fixture sets hasCarRental true', () => {
  const [offer] = importElizaXml(feedXml(productXml()));
  assert.equal(offer.flightIncluded, 'true');
  assert.equal(offer.hasCarRental, true);
  assert.equal(normalizeOffer(offer).hasCarRental, true);
});

test('B. Eliza Flight without the word huurauto still sets hasCarRental true', () => {
  const [offer] = importElizaXml(
    feedXml(
      productXml({
        name: 'Casita Paradise Island',
        usps: 'Terras met bergview;Privé sauna',
        description: 'Villa met terras en privé sauna in Ronda.',
      }),
    ),
  );
  const haystack = [
    offer.hotelName,
    offer.descriptionShort,
    offer.extraInfo,
    offer.descriptionLong,
    offer.feedDescription,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  assert.equal(haystack.includes('huurauto'), false);
  assert.equal(offer.hasCarRental, true);
});

test('C. Eliza SelfDrive does not set hasCarRental and is not a flight package', () => {
  const [offer] = importElizaXml(feedXml(productXml({ transportType: 'SelfDrive', id: 'self-1' })));
  assert.equal(offer.flightIncluded, 'SelfDrive');
  assert.equal(offer.hasCarRental, undefined);
  assert.equal(isVacationWebFlightPackage(normalizeOffer(offer)), false);
});

test('G. compact/normalize keeps Eliza Flight hasCarRental true', () => {
  const [stored] = importElizaXml(feedXml(productXml()));
  const compacted = compactStoredOffer(stored);
  assert.equal(compacted.runtime.hasCarRental, true);
  assert.equal(normalizeOffer(compacted.runtime).hasCarRental, true);
});
