import assert from 'node:assert/strict';
import test from 'node:test';
import { importCorendonXml } from './corendon';
import { importSunwebXml } from './sunweb';

function sunwebProduct(options: {
  id: string;
  transportType: string;
  hasCarRental?: string;
  hasCarRentalName?: 'hasCarRental' | 'HasCarRental';
}): string {
  const car = options.hasCarRental
    ? `<property name="${options.hasCarRentalName ?? 'hasCarRental'}"><value>${options.hasCarRental}</value></property>`
    : '';
  return `<product ID="${options.id}">
<campaignID>1393</campaignID>
<name>Test Hotel</name>
<price currency="EUR">526.00</price>
<URL>https://www.sunweb.be/nl/vakantie/x</URL>
<properties>
<property name="transportType"><value>${options.transportType}</value></property>
<property name="country"><value>Spanje</value></property>
${car}
</properties>
</product>`;
}

function corendonProduct(options: {
  id: string;
  subcategories?: string;
  flightIncluded?: string;
}): string {
  const sub = options.subcategories
    ? `<property name="subcategories"><value>${options.subcategories}</value></property>`
    : '';
  const flight =
    options.flightIncluded != null
      ? `<property name="flightIncluded"><value>${options.flightIncluded}</value></property>`
      : '';
  return `<product ID="${options.id}">
<campaignID>38103</campaignID>
<name>Test Hotel</name>
<price currency="EUR">400.00</price>
<URL>https://referral.corendon.be/c?c=38103&amp;u=${encodeURIComponent('https://www.corendon.be/vakantie#5007.MLELC.EINPMI.041027.3.DZI-U')}</URL>
<properties>
<property name="country"><value>Spanje</value></property>
${sub}
${flight}
</properties>
</product>`;
}

function feedXml(product: string): string {
  return `<?xml version="1.0" encoding="utf-8"?><products>${product}</products>`;
}

test('Sunweb import: Flight + hasCarRental true maps the flag; SelfDrive does not', () => {
  const [flight] = importSunwebXml(
    feedXml(sunwebProduct({ id: '1', transportType: 'Flight', hasCarRental: 'true' })),
  );
  assert.equal(flight.hasCarRental, true);

  const [cased] = importSunwebXml(
    feedXml(
      sunwebProduct({
        id: '2',
        transportType: 'Flight',
        hasCarRental: 'true',
        hasCarRentalName: 'HasCarRental',
      }),
    ),
  );
  assert.equal(cased.hasCarRental, true);

  const [selfDrive] = importSunwebXml(
    feedXml(sunwebProduct({ id: '3', transportType: 'SelfDrive', hasCarRental: 'true' })),
  );
  assert.equal(selfDrive.hasCarRental, undefined);

  const [plain] = importSunwebXml(feedXml(sunwebProduct({ id: '4', transportType: 'Flight' })));
  assert.equal(plain.hasCarRental, undefined);
});

test('Corendon import: exact Fly-Drive token + flightIncluded true maps the flag', () => {
  const [flyDrive] = importCorendonXml(
    feedXml(
      corendonProduct({
        id: '5007',
        flightIncluded: 'true',
        subcategories: 'Fly-Drive vakantie,Zonvakantie',
      }),
    ),
  );
  assert.equal(flyDrive.hasCarRental, true);

  const [zon] = importCorendonXml(
    feedXml(
      corendonProduct({
        id: '5008',
        flightIncluded: 'true',
        subcategories: 'Zonvakantie',
      }),
    ),
  );
  assert.equal(zon.hasCarRental, undefined);

  const [noFlight] = importCorendonXml(
    feedXml(
      corendonProduct({
        id: '5009',
        flightIncluded: 'false',
        subcategories: 'Fly-Drive vakantie',
      }),
    ),
  );
  assert.equal(noFlight.hasCarRental, undefined);
});
