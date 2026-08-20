import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCorendonUrlFragment, resolveCorendonFeHost } from '../../providers/corendon/offer-context';
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
  host: 'www.corendon.be' | 'www.corendon.nl' | 'fr.corendon.be';
  fragment: string;
  accommodation?: string;
  accommodationcode?: string;
  date: string;
  duration: string;
  airport: string;
  serviceType: string;
  extraInfo: string;
  price?: string;
  images?: string[];
  productImages?: string[];
  imageLarge?: string;
  descriptionLong?: string;
  subcategories?: string;
  flightIncluded?: string;
}): string {
  const referralHost = options.host.includes('.nl') ? 'referral.corendon.nl' : 'referral.corendon.be';
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
${(options.productImages ?? []).map((url, index) => `<property name="productimage_${index + 1}"><value>${url}</value></property>`).join('\n')}
${options.imageLarge ? `<property name="imageURL_large"><value>${options.imageLarge}</value></property>` : ''}
${options.descriptionLong ? `<property name="descriptionLong"><value>${options.descriptionLong}</value></property>` : ''}
${options.subcategories ? `<property name="subcategories"><value>${options.subcategories}</value></property>` : ''}
${options.flightIncluded != null ? `<property name="flightIncluded"><value>${options.flightIncluded}</value></property>` : ''}
</properties>
${options.images?.length ? `<images>${options.images.map((url) => `<image>${url}</image>`).join('')}</images>` : ''}
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

test('same concrete offer keeps all listings; does not first-wins drop', () => {
  const be = importCorendonXml(feedXml(productXml(BE_ELCID)));
  const nl = importCorendonXml(feedXml(productXml(NL_ELCID_SAME)));
  const { offers, stats } = mergeCorendonOffers([...be, ...nl]);
  assert.equal(stats.input, 2);
  assert.equal(offers.length, 1);
  assert.equal(offers[0].providerListings?.length, 2);
  const hosts = (offers[0].providerListings ?? []).map((listing) => listing.host).sort();
  assert.deepEqual(hosts, ['www.corendon.be', 'www.corendon.nl']);
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

const FR_ELCID = {
  ...BE_ELCID,
  campaignId: '38103',
  host: 'fr.corendon.be' as const,
  name: 'THB El Cid FR',
};

test('BE-NL + BE-FR + NL are all ingested as listings', () => {
  const benl = importCorendonXml(feedXml(productXml(BE_ELCID)), 'corendon-primary');
  const befr = importCorendonXml(feedXml(productXml(FR_ELCID)), 'corendon-befr');
  const nl = importCorendonXml(feedXml(productXml(NL_ELCID_SAME)), 'corendon-nl');
  const { offers, stats } = mergeCorendonOffers([...benl, ...befr, ...nl]);
  assert.equal(stats.input, 3);
  assert.equal(offers.length, 1);
  assert.equal(offers[0].providerListings?.length, 3);
  assert.equal(stats.beNlListings, 1);
  assert.equal(stats.beFrListings, 1);
  assert.equal(stats.nlListings, 1);
});

test('unique BE-FR offer is retained', () => {
  const uniqueFr = importCorendonXml(
    feedXml(
      productXml({
        ...FR_ELCID,
        id: '99901',
        fragment: '99901.FRONLY.BRUAYT.171126.7.DZ-H..',
        accommodation: 'FRONLY',
        date: '17/11/2026',
        duration: '8',
        airport: 'BRU',
      }),
    ),
    'corendon-befr',
  );
  const be = importCorendonXml(feedXml(productXml(BE_ELCID)));
  const { offers } = mergeCorendonOffers([...be, ...uniqueFr]);
  assert.equal(offers.length, 2);
  assert.ok(offers.some((offer) => offer.deepLink?.includes('fr.corendon.be')));
  assert.ok(offers.some((offer) => offer.feedSourceId === 'corendon-befr'));
});

test('unique NL offer is retained', () => {
  const be = importCorendonXml(feedXml(productXml(BE_ELCID)));
  const nlOnly = importCorendonXml(
    feedXml(
      productXml({
        ...NL_ELCID_SAME,
        id: '8658',
        fragment: '8658.MLFBE.RTMPMI.040427.3.DZ-F..',
        accommodationcode: 'MLFBE',
        date: '04/04/2027',
        airport: 'RTM',
      }),
    ),
  );
  const { offers } = mergeCorendonOffers([...be, ...nlOnly]);
  assert.equal(offers.length, 2);
  assert.ok(offers.some((offer) => offer.listingHost === 'www.corendon.nl'));
});

test('unique BE-NL offer is retained', () => {
  const beOnly = importCorendonXml(
    feedXml(
      productXml({
        ...BE_ELCID,
        id: '11721',
        fragment: '11721.ALABEF.BRUAYT.171126.7.DZ-H..',
        accommodation: 'ALABEF',
        date: '17/11/2026',
        duration: '8',
        airport: 'BRU',
      }),
    ),
  );
  const nl = importCorendonXml(feedXml(productXml(NL_ELCID_SAME)));
  const { offers } = mergeCorendonOffers([...beOnly, ...nl]);
  assert.equal(offers.length, 2);
  assert.ok(offers.some((offer) => offer.listingHost === 'www.corendon.be'));
});

test('same hotel is not a duplicate by itself', () => {
  const a = importCorendonXml(feedXml(productXml(BE_ELCID)));
  const b = importCorendonXml(
    feedXml(
      productXml({
        ...NL_ELCID_SAME,
        fragment: '5007.MLELC.AMSPMI.051027.7.DZ-F..',
        date: '05/10/2027',
        duration: '8',
        airport: 'AMS',
      }),
    ),
  );
  const { offers, stats } = mergeCorendonOffers([...a, ...b]);
  assert.equal(stats.duplicatesDropped, 0);
  assert.equal(offers.length, 2);
  assert.equal(buildCorendonBookableKey(a[0].deepLink), 'mlelc|einpmi|041027|3|dzi-u');
});

test('different room/board is not a duplicate', () => {
  const a = importCorendonXml(feedXml(productXml(BE_ELCID)));
  const b = importCorendonXml(
    feedXml(
      productXml({
        ...NL_ELCID_SAME,
        fragment: '5007.MLELC.EINPMI.041027.3.AI-X..',
        extraInfo: 'All inclusive',
      }),
    ),
  );
  const { offers } = mergeCorendonOffers([...a, ...b]);
  assert.equal(offers.length, 2);
});

test('feed/catalog price does not choose a listing', () => {
  const cheapNl = importCorendonXml(
    feedXml(productXml({ ...NL_ELCID_SAME, price: '1.00', images: ['https://img.example/nl-1.jpg'] })),
  );
  const expensiveBe = importCorendonXml(
    feedXml(
      productXml({
        ...BE_ELCID,
        price: '9999.00',
        images: ['https://img.example/be-1.jpg', 'https://img.example/be-2.jpg'],
      }),
    ),
  );
  const { offers } = mergeCorendonOffers([...cheapNl, ...expensiveBe]);
  assert.equal(offers.length, 1);
  assert.equal(offers[0].providerListings?.length, 2);
  assert.ok(offers[0].deepLink?.includes('www.corendon.be'));
  assert.notEqual(offers[0].price, 1);
});

test('rich gallery is not lost to poor first-wins', () => {
  const poorBe = importCorendonXml(
    feedXml(productXml({ ...BE_ELCID, images: ['https://img.example/poor.jpg'] })),
  );
  const richNl = importCorendonXml(
    feedXml(
      productXml({
        ...NL_ELCID_SAME,
        images: Array.from({ length: 5 }, (_, i) => `https://img.example/rich-${i}.jpg`),
        productImages: ['https://img.example/product-1.jpg'],
        descriptionLong: 'Long NL hotel description with rooms',
      }),
    ),
  );
  const { offers } = mergeCorendonOffers([...poorBe, ...richNl]);
  assert.equal(offers.length, 1);
  assert.ok((offers[0].images?.length ?? 0) >= 6);
  assert.ok(offers[0].images?.includes('https://img.example/rich-0.jpg'));
  assert.ok(offers[0].images?.includes('https://img.example/product-1.jpg'));
  assert.ok(offers[0].descriptionLong?.includes('Long NL hotel description'));
});

test('hotel content merge copies rich images onto other bookable offers of the same hotel', () => {
  const poorOtherTrip = importCorendonXml(
    feedXml(
      productXml({
        ...BE_ELCID,
        fragment: '5007.MLELC.BRUPMI.041027.3.DZI-U..',
        airport: 'BRU',
        images: ['https://img.example/one.jpg'],
      }),
    ),
  );
  const rich = importCorendonXml(
    feedXml(
      productXml({
        ...NL_ELCID_SAME,
        images: ['https://img.example/a.jpg', 'https://img.example/b.jpg', 'https://img.example/c.jpg'],
      }),
    ),
  );
  const { offers } = mergeCorendonOffers([...poorOtherTrip, ...rich]);
  assert.equal(offers.length, 2);
  assert.ok(offers.every((offer) => (offer.images?.length ?? 0) >= 3));
});

test('Prijsvrij rows are ignored by Corendon union', () => {
  const be = importCorendonXml(feedXml(productXml(BE_ELCID)));
  const prijsvrij: typeof be = [
    {
      ...be[0],
      provider: 'Prijsvrij',
      externalId: 'prijsvrij-1',
      deepLink: 'https://www.prijsvrij.be/x',
    },
  ];
  const { offers, stats } = mergeCorendonOffers([...be, ...prijsvrij]);
  assert.equal(stats.input, 1);
  assert.equal(offers.length, 1);
  assert.equal(offers[0].provider, 'Corendon');
  assert.ok(offers.every((offer) => offer.provider !== 'Prijsvrij'));
});

test('productimage properties are imported into images', () => {
  const [offer] = importCorendonXml(
    feedXml(
      productXml({
        ...NL_ELCID_SAME,
        images: ['https://img.example/gallery.jpg'],
        productImages: ['https://img.example/p1.jpg', 'https://img.example/p2.jpg'],
      }),
    ),
  );
  assert.ok(offer.images?.includes('https://img.example/gallery.jpg'));
  assert.ok(offer.images?.includes('https://img.example/p1.jpg'));
  assert.ok(offer.images?.includes('https://img.example/p2.jpg'));
});

test('imageURL_large is the hero, tagged gallery thumbnail stays in the gallery', () => {
  const a1 = 'https://images.corendonresources.com/L1E5007A1W1600H1066.jpg?v=1';
  const a2 = 'https://images.corendonresources.com/L1E5007A2W0H0.jpg?v=1';
  const [offer] = importCorendonXml(
    feedXml(
      productXml({
        ...BE_ELCID,
        images: [a2],
        imageLarge: a1,
      }),
    ),
  );
  assert.equal(offer.imageUrl, a1);
  assert.equal(offer.imageLarge, a1);
  assert.equal(offer.images?.[0], a1);
  assert.ok(offer.images?.includes(a2));
});

test('comma-joined imageURL_large is split; first URL is hero; rest remain in gallery', () => {
  const a1 = 'https://images.corendonresources.com/L1E11721A1W1600H1066.jpg?v=1';
  const a2 = 'https://images.corendonresources.com/L1E11721A2W1600H1066.jpg?v=2';
  const thumb = 'https://images.corendonresources.com/L1E11721A2W0H0.jpg?v=2';
  const [offer] = importCorendonXml(
    feedXml(
      productXml({
        ...BE_ELCID,
        images: [thumb],
        imageLarge: `${a1},${a2}`,
      }),
    ),
  );
  assert.equal(offer.imageUrl, a1);
  assert.equal(offer.imageLarge, a1);
  assert.ok(offer.images?.includes(a2));
  assert.ok(offer.images?.includes(thumb));
  assert.equal(offer.images?.some((url) => url.includes(',http')), false);
});

test('empty airport route is a bookable merge key but not a live-price fragment', () => {
  const be = importCorendonXml(
    feedXml(
      productXml({
        id: '9953',
        campaignId: '38103',
        name: 'Corendon Amsterdam Schiphol Airport',
        host: 'www.corendon.be',
        fragment: '9953.NLVIL..011226.1.DZ2-F..',
        accommodation: 'NLVIL',
        date: '01/12/2026',
        duration: '2',
        airport: '',
        serviceType: 'Logies en ontbijt',
        extraInfo: '2-persoonskamer',
      }),
    ),
  );
  assert.equal(parseCorendonUrlFragment(be[0].deepLink ?? ''), null);
  assert.equal(buildCorendonBookableKey(be[0].deepLink), 'nlvil||011226|1|dz2-f');
});

test('same city-hotel bookable context from three feeds is one offer with all listings', () => {
  const be = importCorendonXml(
    feedXml(
      productXml({
        id: '9953',
        campaignId: '38103',
        name: 'Corendon Amsterdam Schiphol Airport',
        host: 'www.corendon.be',
        fragment: '9953.NLVIL..011226.1.DZ2-F..',
        accommodation: 'NLVIL',
        date: '01/12/2026',
        duration: '2',
        airport: '',
        serviceType: 'Logies en ontbijt',
        extraInfo: '2-persoonskamer',
      }),
    ),
  );
  const nl = importCorendonXml(
    feedXml(
      productXml({
        id: '9953',
        campaignId: '38108',
        name: 'Corendon Amsterdam Schiphol Airport',
        host: 'www.corendon.nl',
        fragment: '9953.NLVIL..011226.1.DZ2-F..',
        accommodationcode: 'NLVIL',
        date: '01/12/2026',
        duration: '2',
        airport: '',
        serviceType: 'Logies en ontbijt',
        extraInfo: '2-persoonskamer',
      }),
    ),
  );
  const fr = importCorendonXml(
    feedXml(
      productXml({
        id: '9953',
        campaignId: '38103',
        name: 'Corendon Amsterdam Schiphol Airport',
        host: 'fr.corendon.be',
        fragment: '9953.NLVIL..011226.1.DZ2-F..',
        accommodation: 'NLVIL',
        date: '01/12/2026',
        duration: '2',
        airport: '',
        serviceType: 'Chambre et petit déjeuner',
        extraInfo: 'Chambre double',
      }),
    ),
  );
  const { offers } = mergeCorendonOffers([...be, ...nl, ...fr]);
  assert.equal(offers.length, 1);
  assert.equal(offers[0].providerListings?.length, 3);
  const hosts = (offers[0].providerListings ?? []).map((listing) => listing.host).sort();
  assert.deepEqual(hosts, ['fr.corendon.be', 'www.corendon.be', 'www.corendon.nl']);
  assert.ok(offers[0].deepLink?.includes('www.corendon.be'));
});

test('empty-airport city hotel other room/board stays separate', () => {
  const double = importCorendonXml(
    feedXml(
      productXml({
        id: '9953',
        campaignId: '38103',
        name: 'Corendon Amsterdam Schiphol Airport',
        host: 'www.corendon.be',
        fragment: '9953.NLVIL..011226.1.DZ2-F..',
        accommodation: 'NLVIL',
        date: '01/12/2026',
        duration: '2',
        airport: '',
        serviceType: 'Logies en ontbijt',
        extraInfo: '2-persoonskamer',
      }),
    ),
  );
  const single = importCorendonXml(
    feedXml(
      productXml({
        id: '9953',
        campaignId: '38103',
        name: 'Corendon Amsterdam Schiphol Airport',
        host: 'www.corendon.nl',
        fragment: '9953.NLVIL..011226.1.DZ-F..',
        accommodationcode: 'NLVIL',
        date: '01/12/2026',
        duration: '2',
        airport: '',
        serviceType: 'Logies en ontbijt',
        extraInfo: '1-persoonskamer',
      }),
    ),
  );
  const { offers } = mergeCorendonOffers([...double, ...single]);
  assert.equal(offers.length, 2);
});

test('re-merge does not drop Corendon providerListings', () => {
  const be = importCorendonXml(feedXml(productXml(BE_ELCID)));
  const nl = importCorendonXml(feedXml(productXml(NL_ELCID_SAME)));
  const first = mergeCorendonOffers([...be, ...nl]).offers;
  assert.equal(first[0].providerListings?.length, 2);
  const second = mergeCorendonOffers(first).offers;
  assert.equal(second.length, 1);
  assert.equal(second[0].providerListings?.length, 2);
  const hosts = (second[0].providerListings ?? []).map((listing) => listing.host).sort();
  assert.deepEqual(hosts, ['www.corendon.be', 'www.corendon.nl']);
});

test('Corendon Fly-Drive + flightIncluded maps hasCarRental; Zonvakantie does not', () => {
  const flyDrive = importCorendonXml(
    feedXml(
      productXml({
        ...BE_ELCID,
        flightIncluded: 'true',
        subcategories: 'Fly-Drive vakantie,Zonvakantie',
      }),
    ),
  );
  assert.equal(flyDrive[0]?.hasCarRental, true);

  const zon = importCorendonXml(
    feedXml(
      productXml({
        ...BE_ELCID,
        flightIncluded: 'true',
        subcategories: 'Zonvakantie',
      }),
    ),
  );
  assert.equal(zon[0]?.hasCarRental, undefined);

  const flyDriveNoFlight = importCorendonXml(
    feedXml(
      productXml({
        ...BE_ELCID,
        flightIncluded: 'false',
        subcategories: 'Fly-Drive vakantie',
      }),
    ),
  );
  assert.equal(flyDriveNoFlight[0]?.hasCarRental, undefined);
});

test('Corendon merge OR-union: NL Fly-Drive survives BE primary without the flag', () => {
  const be = importCorendonXml(
    feedXml(
      productXml({
        ...BE_ELCID,
        flightIncluded: 'true',
        subcategories: 'Zonvakantie',
      }),
    ),
  );
  const nl = importCorendonXml(
    feedXml(
      productXml({
        ...NL_ELCID_SAME,
        flightIncluded: 'true',
        subcategories: 'Fly-Drive vakantie,Zonvakantie',
      }),
    ),
  );
  assert.equal(be[0]?.hasCarRental, undefined);
  assert.equal(nl[0]?.hasCarRental, true);
  const { offers } = mergeCorendonOffers([...be, ...nl]);
  assert.equal(offers.length, 1);
  assert.equal(offers[0].hasCarRental, true);
  assert.equal(offers[0].providerListings?.length, 2);
});
