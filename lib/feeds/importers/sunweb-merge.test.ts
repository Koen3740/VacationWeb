import assert from 'node:assert/strict';
import test from 'node:test';
import { unwrapSunwebProductUrl, parseSunwebLandingQuery, extractSunwebAccommodationId } from '../../providers/sunweb/offer-context';
import { normalizeOffer } from '../canonical/normalize-offer';
import { splitStoredCatalog } from '../../offers/compact-runtime';
import { filterOffers } from '../../search/filtering';
import { paginateResults } from '../../search/pagination';
import { rankResultsOffers } from '../../search/rank-results-offers';
import { importSunwebXml } from './sunweb';
import { mergeEnabledProviderCatalog } from './merge-provider-catalog';
import {
  annotateSunwebSource,
  buildSunwebBookableKey,
  mergeSunwebOffers,
  SUNWEB_ABSENT_AIRPORT,
} from './sunweb-merge';

function landingUrl(options: {
  date: string;
  airport?: string;
  duration: string;
  mealplan: string;
  transport?: string;
}): string {
  const airportQuery = options.airport ? `&DepartureAirport[0]=${options.airport}` : '';
  return (
    'https://www.sunweb.be/nl/vakantie/griekenland/lesbos/molivos-eftalou/appartementen-villas-elpiniki' +
    `?Duration[0]=${options.duration}&TransportType[0]=${options.transport ?? 'Flight'}&Mealplan[0]=${options.mealplan}` +
    `${airportQuery}&DepartureDate[0]=${options.date}` +
    '&Participants[0][0]=1996-07-30&Participants[0][1]=1996-07-30'
  );
}

function productUrl(tt: string, landing: string): string {
  return `https://www.sunweb.be/nl/vakantie/reizen?tt=${tt}&amp;r=${encodeURIComponent(landing)}`;
}

function productXml(options: {
  id: string;
  tt: string;
  date: string;
  airport?: string;
  duration: string;
  mealplan: string;
  serviceType?: string;
  iataDeparture?: string;
  isoCodeDeparture?: string;
  airportName?: string;
  price?: string;
  name?: string;
  omitAirport?: boolean;
  transport?: string;
  hasCarRental?: string;
  hasCarRentalName?: 'hasCarRental' | 'HasCarRental';
}): string {
  const landing = landingUrl({
    date: options.date,
    airport: options.omitAirport ? undefined : (options.airport ?? 'BRU'),
    duration: options.duration,
    mealplan: options.mealplan,
    transport: options.transport,
  });
  const iata = options.iataDeparture
    ? `<property name="iataDeparture"><value>${options.iataDeparture}</value></property>`
    : '';
  const iso = options.isoCodeDeparture
    ? `<property name="IsoCodeDeparture"><value>${options.isoCodeDeparture}</value></property>`
    : '';
  const airportName = options.airportName
    ? `<property name="airport"><value>${options.airportName}</value></property>`
    : '';
  const serviceType = options.serviceType
    ? `<property name="serviceType"><value>${options.serviceType}</value></property>`
    : '';
  const hasCarRental = options.hasCarRental
    ? `<property name="${options.hasCarRentalName ?? 'hasCarRental'}"><value>${options.hasCarRental}</value></property>`
    : '';
  const mmddyyyy = (() => {
    const [year, month, day] = options.date.split('-');
    return `${month}/${day}/${year}`;
  })();

  const transportType = options.transport ?? 'Flight';
  return `<product ID="${options.id}">
<campaignID>1393</campaignID>
<name>${options.name ?? "Appartementen Villa&#039;s Elpiniki"}</name>
<price currency="EUR">${options.price ?? '526.00'}</price>
<URL>${productUrl(options.tt, landing)}</URL>
<images><image>https://static.sunweb.be/a.jpg</image></images>
<properties>
<property name="departureDate"><value>${mmddyyyy}</value></property>
<property name="duration"><value>${options.duration}</value></property>
<property name="transportType"><value>${transportType}</value></property>
<property name="country"><value>Griekenland</value></property>
${iata}${iso}${airportName}${serviceType}${hasCarRental}
</properties>
</product>`;
}

function feedXml(products: string): string {
  return `<?xml version="1.0" encoding="utf-8"?><products>${products}</products>`;
}

const ELPINIKI_DATE = '2026-11-19';

const ACCOMODATIE = {
  id: '38128',
  tt: '1393_1754875_511747_',
  date: ELPINIKI_DATE,
  duration: '8',
  mealplan: 'LG',
  isoCodeDeparture: 'BRU',
  serviceType: 'Logies',
  airportName: 'Brussel Zaventem',
};

const GRIEKENLAND = {
  id: '38128',
  tt: '1393_2087580_511747_',
  date: ELPINIKI_DATE,
  duration: '8',
  mealplan: 'LG',
  iataDeparture: 'BRU',
  airportName: 'Brussel Zaventem',
};

const LASTMINUTE = {
  id: '38128',
  tt: '1393_1761331_511747_',
  date: ELPINIKI_DATE,
  duration: '8',
  mealplan: 'LG',
  serviceType: 'Logies',
  airportName: 'Brussel Zaventem',
};

function importAnnotated(xml: string, feedId: string) {
  return annotateSunwebSource(importSunwebXml(xml), feedId);
}

test('three Elpiniki overlays share one bookable key from landing context', () => {
  const acco = importAnnotated(feedXml(productXml(ACCOMODATIE)), 'sunweb-accomodatie')[0];
  const gr = importAnnotated(feedXml(productXml(GRIEKENLAND)), 'sunweb-griekenland')[0];
  const lm = importAnnotated(feedXml(productXml(LASTMINUTE)), 'sunweb-lastminute')[0];
  assert.equal(buildSunwebBookableKey(acco), `38128|${ELPINIKI_DATE}|bru|8|logies`);
  assert.equal(buildSunwebBookableKey(gr), buildSunwebBookableKey(acco));
  assert.equal(buildSunwebBookableKey(lm), buildSunwebBookableKey(acco));
  const tts = [acco, gr, lm].map((offer) => new URL(offer.deepLink ?? '').searchParams.get('tt'));
  assert.deepEqual(new Set(tts).size, 3);
  assert.equal(lm.departureAirport, 'BRU');
});

test('three Elpiniki overlays merge to one bookable offer and keep all tt listings', () => {
  const acco = importAnnotated(feedXml(productXml(ACCOMODATIE)), 'sunweb-accomodatie');
  const gr = importAnnotated(feedXml(productXml(GRIEKENLAND)), 'sunweb-griekenland');
  const lm = importAnnotated(feedXml(productXml(LASTMINUTE)), 'sunweb-lastminute');
  const { offers, stats } = mergeSunwebOffers([...acco, ...gr, ...lm]);

  assert.equal(stats.input, 3);
  assert.equal(offers.length, 1);
  assert.equal(offers[0].providerListings?.length, 3);
  assert.equal(offers[0].externalId, `sunweb-38128-${ELPINIKI_DATE}-8-BRU-Logies`);
  assert.equal(offers[0].departureAirport, 'BRU');
  assert.equal(offers[0].boardType, 'Logies');

  const tts = (offers[0].providerListings ?? []).map((listing) => {
    const url = new URL(listing.deepLink);
    return url.searchParams.get('tt');
  }).sort();
  assert.deepEqual(tts, [
    '1393_1754875_511747_',
    '1393_1761331_511747_',
    '1393_2087580_511747_',
  ]);
  assert.ok(offers[0].deepLink);
  assert.ok(new URL(offers[0].deepLink ?? '').searchParams.get('tt'));
  const landing = unwrapSunwebProductUrl(offers[0].deepLink ?? '');
  assert.ok(landing.includes('DepartureAirport[0]=BRU'));
  assert.ok(landing.includes('Mealplan[0]=LG'));
  const accoId = extractSunwebAccommodationId(offers[0].externalId);
  assert.equal(accoId, '38128');
  const liveQuery = parseSunwebLandingQuery(offers[0].deepLink ?? '', accoId ?? '');
  assert.ok(liveQuery);
  assert.equal(liveQuery.departureAirport, 'BRU');
  assert.equal(liveQuery.departureDate, ELPINIKI_DATE);
  assert.equal(liveQuery.duration, '8');
});

test('different departure date is not merged', () => {
  const first = importAnnotated(feedXml(productXml(ACCOMODATIE)), 'sunweb-accomodatie');
  const second = importAnnotated(
    feedXml(productXml({ ...ACCOMODATIE, tt: '1393_otherdate_511747_', date: '2026-09-04' })),
    'sunweb-accomodatie',
  );
  const { offers } = mergeSunwebOffers([...first, ...second]);
  assert.equal(offers.length, 2);
});

test('different departure airport is not merged', () => {
  const bru = importAnnotated(feedXml(productXml(ACCOMODATIE)), 'sunweb-accomodatie');
  const ams = importAnnotated(
    feedXml(
      productXml({
        ...ACCOMODATIE,
        tt: '1393_ams_511747_',
        airport: 'AMS',
        isoCodeDeparture: 'AMS',
      }),
    ),
    'sunweb-accomodatie',
  );
  const { offers } = mergeSunwebOffers([...bru, ...ams]);
  assert.equal(offers.length, 2);
  assert.deepEqual(
    offers.map((offer) => offer.departureAirport).sort(),
    ['AMS', 'BRU'],
  );
});

test('different duration is not merged', () => {
  const eight = importAnnotated(feedXml(productXml(ACCOMODATIE)), 'sunweb-accomodatie');
  const eleven = importAnnotated(
    feedXml(productXml({ ...ACCOMODATIE, tt: '1393_11n_511747_', duration: '11' })),
    'sunweb-accomodatie',
  );
  const { offers } = mergeSunwebOffers([...eight, ...eleven]);
  assert.equal(offers.length, 2);
});

test('different board/meal is not merged', () => {
  const logies = importAnnotated(feedXml(productXml(ACCOMODATIE)), 'sunweb-accomodatie');
  const ai = importAnnotated(
    feedXml(
      productXml({
        ...ACCOMODATIE,
        tt: '1393_ai_511747_',
        mealplan: 'AI',
        serviceType: 'All Inclusive',
      }),
    ),
    'sunweb-accomodatie',
  );
  const { offers } = mergeSunwebOffers([...logies, ...ai]);
  assert.equal(offers.length, 2);
});

test('different product identity is not merged even with the same hotel name', () => {
  const elpiniki = importAnnotated(feedXml(productXml(ACCOMODATIE)), 'sunweb-accomodatie');
  const other = importAnnotated(
    feedXml(productXml({ ...ACCOMODATIE, id: '99999', tt: '1393_otherhotel_511747_' })),
    'sunweb-accomodatie',
  );
  const { offers } = mergeSunwebOffers([...elpiniki, ...other]);
  assert.equal(offers.length, 2);
});

test('merge does not first-wins drop a second Sunweb listing', () => {
  const first = importAnnotated(feedXml(productXml(ACCOMODATIE)), 'sunweb-accomodatie');
  const second = importAnnotated(feedXml(productXml(GRIEKENLAND)), 'sunweb-griekenland');
  const { offers } = mergeSunwebOffers([...first, ...second]);
  assert.equal(offers.length, 1);
  assert.equal(offers[0].providerListings?.length, 2);
  const feeds = (offers[0].providerListings ?? []).map((listing) => listing.feedId).sort();
  assert.deepEqual(feeds, ['sunweb-accomodatie', 'sunweb-griekenland']);
});

function selfdriveFlorida(options: { tt: string; feedId: string; serviceType?: string }) {
  return annotateSunwebSource(
    importSunwebXml(
      feedXml(
        productXml({
          id: '87919',
          tt: options.tt,
          date: '2026-08-27',
          duration: '8',
          mealplan: 'LO',
          omitAirport: true,
          transport: 'SelfDrive',
          serviceType: options.serviceType ?? 'Logies ontbijt',
          name: 'Hotel ALEGRIA Florida',
          price: '520.00',
        }),
      ),
    ),
    options.feedId,
  );
}

test('same accommodation + date + duration + board without airport merges to one offer', () => {
  const acco = selfdriveFlorida({ tt: '1393_1754875_511747_', feedId: 'sunweb-accomodatie' });
  const spanje = selfdriveFlorida({ tt: '1393_2086955_511747_', feedId: 'sunweb-spanje' });
  const lastminute = selfdriveFlorida({
    tt: '1393_1761331_511747_',
    feedId: 'sunweb-lastminute',
    serviceType: 'Halfpension',
  });
  assert.equal(buildSunwebBookableKey(acco[0]), `87919|2026-08-27|${SUNWEB_ABSENT_AIRPORT}|8|logies & ontbijt`);
  assert.equal(buildSunwebBookableKey(spanje[0]), buildSunwebBookableKey(acco[0]));
  assert.equal(buildSunwebBookableKey(lastminute[0]), buildSunwebBookableKey(acco[0]));

  const { offers } = mergeSunwebOffers([...acco, ...spanje, ...lastminute]);
  assert.equal(offers.length, 1);
  assert.equal(offers[0].providerListings?.length, 3);
  assert.equal(offers[0].boardType, 'Logies & ontbijt');
  assert.equal(offers[0].price, 520);
  assert.ok(offers[0].deepLink);
  assert.ok(new URL(offers[0].deepLink ?? '').searchParams.get('tt'));
  const landing = unwrapSunwebProductUrl(offers[0].deepLink ?? '');
  assert.ok(landing.includes('Mealplan[0]=LO'));
  assert.ok(landing.includes('DepartureDate[0]=2026-08-27'));
  const tts = (offers[0].providerListings ?? []).map((listing) => new URL(listing.deepLink).searchParams.get('tt')).sort();
  assert.deepEqual(tts, [
    '1393_1754875_511747_',
    '1393_1761331_511747_',
    '1393_2086955_511747_',
  ]);
});

test('same accommodation + other date stays two offers', () => {
  const first = selfdriveFlorida({ tt: '1393_a_511747_', feedId: 'sunweb-accomodatie' });
  const second = annotateSunwebSource(
    importSunwebXml(
      feedXml(
        productXml({
          id: '87919',
          tt: '1393_b_511747_',
          date: '2026-09-03',
          duration: '8',
          mealplan: 'LO',
          omitAirport: true,
          transport: 'SelfDrive',
          name: 'Hotel ALEGRIA Florida',
          price: '520.00',
        }),
      ),
    ),
    'sunweb-accomodatie',
  );
  const { offers } = mergeSunwebOffers([...first, ...second]);
  assert.equal(offers.length, 2);
});

test('same accommodation + other airport stays two offers', () => {
  const bru = importAnnotated(feedXml(productXml(ACCOMODATIE)), 'sunweb-accomodatie');
  const ams = importAnnotated(
    feedXml(
      productXml({
        ...ACCOMODATIE,
        tt: '1393_ams_511747_',
        airport: 'AMS',
        isoCodeDeparture: 'AMS',
      }),
    ),
    'sunweb-accomodatie',
  );
  const { offers } = mergeSunwebOffers([...bru, ...ams]);
  assert.equal(offers.length, 2);
});

test('same accommodation + other duration stays two offers', () => {
  const eight = selfdriveFlorida({ tt: '1393_8_511747_', feedId: 'sunweb-accomodatie' });
  const eleven = annotateSunwebSource(
    importSunwebXml(
      feedXml(
        productXml({
          id: '87919',
          tt: '1393_11_511747_',
          date: '2026-08-27',
          duration: '11',
          mealplan: 'LO',
          omitAirport: true,
          transport: 'SelfDrive',
          name: 'Hotel ALEGRIA Florida',
          price: '520.00',
        }),
      ),
    ),
    'sunweb-accomodatie',
  );
  const { offers } = mergeSunwebOffers([...eight, ...eleven]);
  assert.equal(offers.length, 2);
});

test('same accommodation + other landing board stays two offers', () => {
  const lo = selfdriveFlorida({ tt: '1393_lo_511747_', feedId: 'sunweb-accomodatie' });
  const hp = annotateSunwebSource(
    importSunwebXml(
      feedXml(
        productXml({
          id: '87919',
          tt: '1393_hp_511747_',
          date: '2026-08-27',
          duration: '8',
          mealplan: 'HP',
          omitAirport: true,
          transport: 'SelfDrive',
          serviceType: 'Halfpension',
          name: 'Hotel ALEGRIA Florida',
          price: '520.00',
        }),
      ),
    ),
    'sunweb-accomodatie',
  );
  const { offers } = mergeSunwebOffers([...lo, ...hp]);
  assert.equal(offers.length, 2);
});

test('re-merge keeps all providerListings on an already merged offer', () => {
  const first = mergeSunwebOffers([
    ...selfdriveFlorida({ tt: '1393_1754875_511747_', feedId: 'sunweb-accomodatie' }),
    ...selfdriveFlorida({ tt: '1393_2086955_511747_', feedId: 'sunweb-spanje' }),
    ...selfdriveFlorida({ tt: '1393_1761331_511747_', feedId: 'sunweb-lastminute' }),
  ]).offers;
  assert.equal(first[0].providerListings?.length, 3);
  const second = mergeSunwebOffers(first).offers;
  assert.equal(second.length, 1);
  assert.equal(second[0].providerListings?.length, 3);
});

test('H. compact runtime reconstruct + re-merge does not reintroduce Elpiniki duplicates', () => {
  const merged = mergeSunwebOffers([
    ...importAnnotated(feedXml(productXml(ACCOMODATIE)), 'sunweb-accomodatie'),
    ...importAnnotated(feedXml(productXml(GRIEKENLAND)), 'sunweb-griekenland'),
    ...importAnnotated(feedXml(productXml(LASTMINUTE)), 'sunweb-lastminute'),
  ]).offers;
  assert.equal(merged.length, 1);
  assert.equal(merged[0].providerListings?.length, 3);

  const { runtime, details } = splitStoredCatalog(merged);
  assert.equal(runtime.length, 1);
  assert.equal(runtime[0].providerListings?.length, 3);
  const reconstructed = runtime.map((offer) => ({
    ...offer,
    ...(details[offer.externalId] ?? {}),
  }));
  const again = mergeSunwebOffers(reconstructed).offers;
  assert.equal(again.length, 1);
  assert.equal(again[0].providerListings?.length, 3);
  assert.equal(again[0].externalId, `sunweb-38128-${ELPINIKI_DATE}-8-BRU-Logies`);
});

test('H. unmerged compact overlays re-merge after runtime reconstruct', () => {
  const unmerged = [
    ...importAnnotated(feedXml(productXml(ACCOMODATIE)), 'sunweb-accomodatie'),
    ...importAnnotated(feedXml(productXml(GRIEKENLAND)), 'sunweb-griekenland'),
    ...importAnnotated(feedXml(productXml(LASTMINUTE)), 'sunweb-lastminute'),
  ];
  assert.equal(unmerged.length, 3);
  assert.ok(
    new Set(unmerged.map((offer) => offer.externalId)).size >= 2,
    'importer externalIds must not be a stable bookable identity across overlays',
  );

  const { runtime, details } = splitStoredCatalog(unmerged);
  assert.equal(runtime.length, 3);
  const reconstructed = runtime.map((offer) => ({
    ...offer,
    ...(details[offer.externalId] ?? {}),
  }));
  const merged = mergeEnabledProviderCatalog(reconstructed).filter(
    (offer) => offer.provider === 'Sunweb',
  );
  assert.equal(merged.length, 1);
  assert.equal(merged[0].providerListings?.length, 3);
});

test('I. Elpiniki is one Results card after merge; listings are not extra holidays', () => {
  const { offers } = mergeSunwebOffers([
    ...importAnnotated(feedXml(productXml(ACCOMODATIE)), 'sunweb-accomodatie'),
    ...importAnnotated(feedXml(productXml(GRIEKENLAND)), 'sunweb-griekenland'),
    ...importAnnotated(feedXml(productXml(LASTMINUTE)), 'sunweb-lastminute'),
  ]);
  assert.equal(offers.length, 1);
  assert.equal(offers[0].providerListings?.length, 3);
  assert.equal(offers[0].externalId, `sunweb-38128-${ELPINIKI_DATE}-8-BRU-Logies`);

  const travel = offers.map(normalizeOffer);
  const ranked = rankResultsOffers(travel, {
    nights: [8],
    departureStart: ELPINIKI_DATE,
    departureEnd: ELPINIKI_DATE,
    departureAirport: 'BRU',
  });
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].id, `sunweb-38128-${ELPINIKI_DATE}-8-BRU-Logies`);
  assert.equal(ranked[0].providerListings?.length, 3);
});

test('SelfDrive overlays stay out of Results count and pagination after merge', () => {
  const { offers } = mergeSunwebOffers([
    ...selfdriveFlorida({ tt: '1393_1754875_511747_', feedId: 'sunweb-accomodatie' }),
    ...selfdriveFlorida({ tt: '1393_2086955_511747_', feedId: 'sunweb-spanje' }),
    ...selfdriveFlorida({
      tt: '1393_1761331_511747_',
      feedId: 'sunweb-lastminute',
      serviceType: 'Halfpension',
    }),
  ]);
  assert.equal(offers.length, 1);
  const travel = offers.map(normalizeOffer);
  const filtered = filterOffers(travel, {
    nights: [8],
    departureStart: '2026-08-27',
    departureEnd: '2026-08-27',
  });
  assert.equal(filtered.length, 0);
  assert.equal(paginateResults(filtered, 1, 10).length, 0);
});

test('H. Sunweb merge: missing + true keeps hasCarRental and all listings', () => {
  const acco = importAnnotated(feedXml(productXml(ACCOMODATIE)), 'sunweb-accomodatie');
  const gr = importAnnotated(
    feedXml(productXml({ ...GRIEKENLAND, hasCarRental: 'true' })),
    'sunweb-griekenland',
  );
  const lm = importAnnotated(
    feedXml(productXml({ ...LASTMINUTE, hasCarRental: 'false' })),
    'sunweb-lastminute',
  );
  assert.equal(acco[0]?.hasCarRental, undefined);
  assert.equal(gr[0]?.hasCarRental, true);
  assert.equal(lm[0]?.hasCarRental, undefined);

  const { offers } = mergeSunwebOffers([...acco, ...gr, ...lm]);
  assert.equal(offers.length, 1);
  assert.equal(offers[0].hasCarRental, true);
  assert.equal(offers[0].providerListings?.length, 3);
  assert.equal(normalizeOffer(offers[0]).hasCarRental, true);
});

test('Sunweb HasCarRental + Flight maps true; SelfDrive does not', () => {
  const flight = importSunwebXml(
    feedXml(productXml({ ...GRIEKENLAND, hasCarRental: 'true', hasCarRentalName: 'HasCarRental' })),
  );
  assert.equal(flight[0]?.hasCarRental, true);

  const selfDrive = importSunwebXml(
    feedXml(
      productXml({
        id: '87919',
        tt: '1393_1754875_511747_',
        date: '2026-08-27',
        duration: '8',
        mealplan: 'LO',
        omitAirport: true,
        transport: 'SelfDrive',
        serviceType: 'Logies ontbijt',
        hasCarRental: 'true',
      }),
    ),
  );
  assert.equal(selfDrive[0]?.hasCarRental, undefined);
  assert.equal(filterOffers(selfDrive.map(normalizeOffer), { nights: [8] }).length, 0);
});
