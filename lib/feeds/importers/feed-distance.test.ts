import assert from 'node:assert/strict';
import test from 'node:test';
import { compactStoredOffer, splitStoredCatalog } from '../../offers/compact-runtime';
import { normalizeOffer } from '../canonical/normalize-offer';
import { importElizaXml } from './eliza';
import { importSunwebXml } from './sunweb';
import { annotateSunwebSource, mergeSunwebOffers } from './sunweb-merge';
import { parseCenterDistanceFromFeedValues } from './feed-distance';

test('centre distance: first number of the feed line, meters and kilometers', () => {
  assert.deepEqual(parseCenterDistanceFromFeedValues(['afstand tot centrum: circa 500 meter']), {
    centerDistanceM: 500,
  });
  assert.deepEqual(parseCenterDistanceFromFeedValues(['Afstand tot centrum: circa 2 kilometer']), {
    centerDistanceM: 2000,
  });
  assert.deepEqual(parseCenterDistanceFromFeedValues(['afstand tot centrum: circa 2,5 kilometer']), {
    centerDistanceM: 2500,
  });
  assert.deepEqual(parseCenterDistanceFromFeedValues(['afstand tot centrum: circa 1.200 meter']), {
    centerDistanceM: 1200,
  });
});

test('centre distance: FIRST number wins, not the minimum; place-prefixed lines use the first number', () => {
  assert.equal(
    parseCenterDistanceFromFeedValues(['afstand tot centrum: circa 800 meter of 200 meter']).centerDistanceM,
    800,
  );
  assert.equal(
    parseCenterDistanceFromFeedValues(['afstand tot centrum: faro ii circa 500 meter']).centerDistanceM,
    500,
  );
});

test('centre distance: comma-joined Eliza value and unrelated distances', () => {
  const eliza =
    'afstand tot strand circa 300 meter, afstand tot centrum circa 700 meter, afstand tot luchthaven circa 20 kilometer';
  assert.deepEqual(parseCenterDistanceFromFeedValues([eliza]), { centerDistanceM: 700 });
  assert.deepEqual(parseCenterDistanceFromFeedValues(['afstand tot strand circa 300 meter']), {});
  assert.deepEqual(parseCenterDistanceFromFeedValues(['afstand tot luchthaven: circa 10 kilometer']), {});
  assert.deepEqual(parseCenterDistanceFromFeedValues([]), {});
});

test('centre distance: literal item "in het centrum" only, never "supermarkt (in het centrum)"', () => {
  assert.deepEqual(parseCenterDistanceFromFeedValues(['in het centrum']), { centerIsIn: true });
  assert.deepEqual(parseCenterDistanceFromFeedValues(['zwembad', 'In het centrum']), { centerIsIn: true });
  assert.deepEqual(
    parseCenterDistanceFromFeedValues(['restaurant, in het centrum, bar']),
    { centerIsIn: true },
  );
  assert.deepEqual(parseCenterDistanceFromFeedValues(['supermarkt (in het centrum)']), {});
  assert.deepEqual(parseCenterDistanceFromFeedValues(['gelegen in het centrum van de stad']), {});
});

const LANDING =
  'https://www.sunweb.be/nl/vakantie/griekenland/lesbos/molivos-eftalou/appartementen-villas-elpiniki' +
  '?Duration[0]=8&TransportType[0]=Flight&Mealplan[0]=LG&DepartureAirport[0]=BRU&DepartureDate[0]=2026-11-19' +
  '&Participants[0][0]=1996-07-30&Participants[0][1]=1996-07-30';

function sunwebProduct(tt: string, extraProperties: string): string {
  return `<product ID="38128">
<campaignID>1393</campaignID>
<name>Appartementen Elpiniki</name>
<price currency="EUR">526.00</price>
<URL>https://www.sunweb.be/nl/vakantie/reizen?tt=${tt}&amp;r=${encodeURIComponent(LANDING)}</URL>
<images><image>https://static.sunweb.be/a.jpg</image></images>
<properties>
<property name="departureDate"><value>11/19/2026</value></property>
<property name="duration"><value>8</value></property>
<property name="transportType"><value>Flight</value></property>
<property name="country"><value>Griekenland</value></property>
<property name="iataDeparture"><value>BRU</value></property>
${extraProperties}
</properties>
</product>`;
}

function feed(products: string): string {
  return `<?xml version="1.0" encoding="utf-8"?><products>${products}</products>`;
}

test('Sunweb importer: distance from `facilities` (Griekenland/Turkije/Egypte)', () => {
  const [offer] = importSunwebXml(
    feed(
      sunwebProduct(
        '1393_2087580_511747_',
        '<property name="facilities"><value>afstand tot centrum: circa 400 meter</value><value>zwembad</value></property>',
      ),
    ),
  );
  assert.equal(offer.centerDistanceM, 400);
  assert.equal(offer.centerIsIn, undefined);
});

test('Sunweb importer: distance and literal item from `accommodation` (Spanje)', () => {
  const [offer] = importSunwebXml(
    feed(
      sunwebProduct(
        '1393_2087580_511747_',
        '<property name="accommodation"><value>in het centrum</value><value>afstand tot centrum: circa 100 meter</value></property>',
      ),
    ),
  );
  assert.equal(offer.centerDistanceM, 100);
  assert.equal(offer.centerIsIn, true);
});

test('Sunweb importer: no distance line -> fields stay absent (unknown)', () => {
  const [offer] = importSunwebXml(
    feed(sunwebProduct('1393_2087580_511747_', '<property name="facilities"><value>zwembad</value></property>')),
  );
  assert.equal('centerDistanceM' in offer, false);
  assert.equal('centerIsIn' in offer, false);
});

test('Sunweb merge: distance survives when the primary overlay record has no distance line', () => {
  const withLine = annotateSunwebSource(
    importSunwebXml(
      feed(
        sunwebProduct(
          '1393_2087580_511747_',
          '<property name="facilities"><value>afstand tot centrum: circa 250 meter</value></property>',
        ),
      ),
    ),
    'sunweb-griekenland',
  );
  const without = annotateSunwebSource(
    importSunwebXml(
      feed(
        sunwebProduct(
          '1393_1754875_511747_',
          '<property name="serviceType"><value>Logies</value></property><property name="airport"><value>Brussel Zaventem</value></property>',
        ),
      ),
    ),
    'sunweb-accomodatie',
  );
  for (const order of [
    [...without, ...withLine],
    [...withLine, ...without],
  ]) {
    const merged = mergeSunwebOffers(order).offers;
    assert.equal(merged.length, 1);
    assert.ok(merged.every((offer) => offer.centerDistanceM === 250));
  }
});

test('Eliza importer: comma-joined accommodation property gives distance', () => {
  const xml = feed(`<product ID="6270665">
<campaignID>1327</campaignID>
<name>Casita</name>
<price currency="EUR">599.00</price>
<URL>https://www.elizawashere.be/reizen?tt=1&amp;r=${encodeURIComponent(
    'https://www.elizawashere.be/spanje/x?Duration[0]=8&TransportType[0]=Flight&Mealplan[0]=LG&DepartureAirport[0]=BRU&DepartureDate[0]=2026-11-19',
  )}</URL>
<images><image>https://static.elizawashere.be/a.jpg</image></images>
<properties>
<property name="country"><value>Spanje</value></property>
<property name="departureDate"><value>11/19/2026</value></property>
<property name="transportType"><value>Flight</value></property>
<property name="duration"><value>8</value></property>
<property name="accommodation"><value>afstand tot strand circa 300 meter, afstand tot centrum circa 700 meter</value></property>
</properties>
</product>`);
  const [offer] = importElizaXml(xml);
  assert.equal(offer.centerDistanceM, 700);
});

test('compact + normalize keep all ligging fields; false/absent flags are not stored', () => {
  const [stored] = importSunwebXml(
    feed(
      sunwebProduct(
        '1393_2087580_511747_',
        '<property name="facilities"><value>afstand tot centrum: circa 400 meter</value></property>',
      ),
    ),
  );
  const full = {
    ...stored,
    centerIsIn: true,
    beachDirect: true,
    beachDistanceM: 120,
    coastDistanceM: 80,
    settingClass: 23,
  };
  const { runtime } = compactStoredOffer(full);
  assert.equal(runtime.centerDistanceM, 400);
  assert.equal(runtime.centerIsIn, true);
  assert.equal(runtime.beachDirect, true);
  assert.equal(runtime.beachDistanceM, 120);
  assert.equal(runtime.coastDistanceM, 80);
  assert.equal(runtime.settingClass, 23);
  const offer = normalizeOffer(runtime);
  assert.deepEqual(
    [offer.centerDistanceM, offer.centerIsIn, offer.beachDirect, offer.beachDistanceM, offer.coastDistanceM, offer.settingClass],
    [400, true, true, 120, 80, 23],
  );

  const bare = compactStoredOffer({ ...stored, centerDistanceM: undefined, centerIsIn: false, beachDirect: false });
  for (const key of ['centerDistanceM', 'centerIsIn', 'beachDirect', 'beachDistanceM', 'coastDistanceM', 'settingClass']) {
    assert.equal(key in bare.runtime, false, key);
  }
  const split = splitStoredCatalog([full]);
  assert.equal((split.runtime[0] as { settingClass?: number }).settingClass, 23);
});