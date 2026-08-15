import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveCorendonFeHost } from '../../providers/corendon/offer-context';
import { importCorendonXml } from './corendon';
import {
  assignCorendonCanonicalExternalId,
  buildCorendonBookableKey,
  mergeCorendonOffers,
} from './corendon-merge';

function productXml(options: {
  id: string;
  campaignId: string;
  name: string;
  host: 'www.corendon.be' | 'www.corendon.nl';
  fragment: string;
  accommodation?: string;
  accommodationcode?: string;
  date: string;
  duration: string;
  airport: string;
  serviceType: string;
  extraInfo: string;
  price?: string;
}): string {
  const referralHost = options.host.endsWith('.nl') ? 'referral.corendon.nl' : 'referral.corendon.be';
  const target = `https://${options.host}/vakantie#${options.fragment}`;
  const url = `https://${referralHost}/c?c=${options.campaignId}&amp;u=${encodeURIComponent(target)}`;
  const accoProp = options.accommodationcode
    ? `<property name="accommodationcode"><value>${options.accommodationcode}</value></property>`
    : `<property name="accommodation"><value>${options.accommodation ?? ''}</value></property>`;
  return `<product ID="${options.id}">
<campaignID>${options.campaignId}</campaignID>
<name>${options.name}</name>
<price currency="EUR">${options.price ?? '400.00'}</price>
<URL>${url}</URL>
<properties>
${accoProp}
<property name="departureDate"><value>${options.date}</value></property>
<property name="duration"><value>${options.duration}</value></property>
<property name="iataDeparture"><value>${options.airport}</value></property>
<property name="serviceType"><value>${options.serviceType}</value></property>
<property name="extraInfo"><value>${options.extraInfo}</value></property>
<property name="country"><value>Spanje</value></property>
</properties>
</product>`;
}

function feedXml(products: string): string {
  return `<?xml version="1.0" encoding="utf-8"?><products>${products}</products>`;
}

const BE_ELCID = {
  id: '5007',
  campaignId: '38103',
  name: 'THB El Cid',
  host: 'www.corendon.be' as const,
  fragment: '5007.MLELC.EINPMI.041027.3.DZI-U..',
  accommodation: 'MLELC',
  date: '04/10/2027',
  duration: '4',
  airport: 'EIN',
  serviceType: 'Logies',
  extraInfo: '2-persoonskamer Standaard Zijzeezicht',
};

const NL_ELCID_SAME = {
  ...BE_ELCID,
  campaignId: '38108',
  host: 'www.corendon.nl' as const,
  accommodation: undefined,
  accommodationcode: 'MLELC',
};

test('BE import: campaign, productURL, accommodation, fragment key', () => {
  const [offer] = importCorendonXml(feedXml(productXml(BE_ELCID)));
  assert.equal(offer.provider, 'Corendon');
  assert.equal(offer.externalId, 'corendon-5007');
  assert.equal(offer.affiliateCampaignId, '38103');
  assert.equal(offer.accommodation, 'MLELC');
  assert.ok(offer.deepLink?.includes('www.corendon.be'));
  assert.equal(buildCorendonBookableKey(offer.deepLink), 'mlelc|einpmi|041027|3|dzi-u');
  assert.equal(resolveCorendonFeHost(offer.deepLink ?? ''), 'www.corendon.be');
});

test('NL import: accommodationcode + .nl host', () => {
  const [offer] = importCorendonXml(feedXml(productXml(NL_ELCID_SAME)));
  assert.equal(offer.affiliateCampaignId, '38108');
  assert.equal(offer.accommodation, 'MLELC');
  assert.ok(offer.deepLink?.includes('www.corendon.nl'));
  assert.equal(resolveCorendonFeHost(offer.deepLink ?? ''), 'www.corendon.nl');
  assert.equal(buildCorendonBookableKey(offer.deepLink), buildCorendonBookableKey(
    importCorendonXml(feedXml(productXml(BE_ELCID)))[0].deepLink,
  ));
});

test('true duplicate (same bookable fragment, other host) is deduped once', () => {
  const be = importCorendonXml(feedXml(productXml(BE_ELCID)));
  const nl = importCorendonXml(feedXml(productXml(NL_ELCID_SAME)));
  const { offers, stats } = mergeCorendonOffers([...be, ...nl]);
  assert.equal(stats.input, 2);
  assert.equal(stats.duplicatesDropped, 1);
  assert.equal(offers.length, 1);
  assert.equal(offers[0].affiliateCampaignId, '38103');
  assert.ok(offers[0].deepLink?.includes('www.corendon.be'));
  assert.equal(resolveCorendonFeHost(offers[0].deepLink ?? ''), 'www.corendon.be');
});

test('same hotel other airport is not deduped', () => {
  const bru = importCorendonXml(
    feedXml(
      productXml({
        ...BE_ELCID,
        fragment: '5007.MLELC.BRUPMI.041027.3.DZI-U..',
        airport: 'BRU',
      }),
    ),
  );
  const ein = importCorendonXml(feedXml(productXml(NL_ELCID_SAME)));
  const { offers, stats } = mergeCorendonOffers([...bru, ...ein]);
  assert.equal(stats.duplicatesDropped, 0);
  assert.equal(offers.length, 2);
  assert.notEqual(
    buildCorendonBookableKey(offers[0].deepLink),
    buildCorendonBookableKey(offers[1].deepLink),
  );
});

test('same hotel other date is not deduped', () => {
  const a = importCorendonXml(feedXml(productXml(BE_ELCID)));
  const b = importCorendonXml(
    feedXml(
      productXml({
        ...NL_ELCID_SAME,
        fragment: '5007.MLELC.EINPMI.051027.3.DZI-U..',
        date: '05/10/2027',
      }),
    ),
  );
  const { offers, stats } = mergeCorendonOffers([...a, ...b]);
  assert.equal(stats.duplicatesDropped, 0);
  assert.equal(offers.length, 2);
});

test('same hotel other duration is not deduped', () => {
  const a = importCorendonXml(feedXml(productXml(BE_ELCID)));
  const b = importCorendonXml(
    feedXml(
      productXml({
        ...NL_ELCID_SAME,
        fragment: '5007.MLELC.EINPMI.041027.7.DZI-U..',
        duration: '8',
      }),
    ),
  );
  const { offers, stats } = mergeCorendonOffers([...a, ...b]);
  assert.equal(stats.duplicatesDropped, 0);
  assert.equal(offers.length, 2);
});

test('BE-only and NL-only are both kept; productURL and hosts preserved', () => {
  const beOnly = importCorendonXml(
    feedXml(
      productXml({
        ...BE_ELCID,
        id: '11721',
        name: 'Alaaddin Beach',
        fragment: '11721.ALABEF.BRUAYT.171126.7.DZ-H..',
        accommodation: 'ALABEF',
        date: '17/11/2026',
        duration: '8',
        airport: 'BRU',
        extraInfo: 'Standaardkamer',
      }),
    ),
  );
  const nlOnly = importCorendonXml(
    feedXml(
      productXml({
        ...NL_ELCID_SAME,
        id: '8658',
        name: 'Fergus Bermudas',
        fragment: '8658.MLFBE.RTMPMI.040427.3.DZ-F..',
        accommodationcode: 'MLFBE',
        date: '04/04/2027',
        airport: 'RTM',
      }),
    ),
  );
  const { offers } = mergeCorendonOffers([...beOnly, ...nlOnly]);
  assert.equal(offers.length, 2);
  assert.equal(resolveCorendonFeHost(offers[0].deepLink ?? ''), 'www.corendon.be');
  assert.equal(resolveCorendonFeHost(offers[1].deepLink ?? ''), 'www.corendon.nl');
  assert.ok(offers[0].deepLink?.includes('11721.ALABEF.BRUAYT.171126.7.DZ-H'));
  assert.ok(offers[1].deepLink?.includes('8658.MLFBE.RTMPMI.040427.3.DZ-F'));
});

test('canonical offer identity is unique and keeps numeric hotel id', () => {
  const be = importCorendonXml(feedXml(productXml(BE_ELCID)));
  const nlOtherAirport = importCorendonXml(
    feedXml(
      productXml({
        ...NL_ELCID_SAME,
        fragment: '5007.MLELC.AMSPMI.041027.3.DZI-U..',
        airport: 'AMS',
      }),
    ),
  );
  const { offers } = mergeCorendonOffers([...be, ...nlOtherAirport]);
  assert.equal(new Set(offers.map((offer) => offer.externalId)).size, 2);
  assert.ok(offers.every((offer) => offer.externalId.startsWith('corendon-5007-')));
  assert.notEqual(offers[0].externalId, offers[1].externalId);
  assert.ok(assignCorendonCanonicalExternalId(be[0]).includes('EINPMI'));
  assert.ok(assignCorendonCanonicalExternalId(nlOtherAirport[0]).includes('AMSPMI'));
});
