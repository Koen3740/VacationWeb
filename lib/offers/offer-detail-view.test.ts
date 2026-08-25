import assert from 'node:assert/strict';
import test from 'node:test';
import type { TravelOffer } from '../feeds/canonical/travel-offer';
import { unwrapElizaProductUrl } from '../providers/eliza/offer-context';
import { ELIZA_LANDING, ELIZA_PRODUCT_URL } from '../providers/eliza/offer-context.test';
import { unwrapSunwebProductUrl } from '../providers/sunweb/offer-context';
import { SUNWEB_LANDING, SUNWEB_PRODUCT_URL } from '../providers/sunweb/offer-context.test';
import {
  affiliateHref,
  bookingCtaLabel,
  bookingVacationCtaLabel,
  buildBasisFacts,
  formatDepartureAirport,
  formatListingHostLabel,
  formatNightsLabel,
  formatDurationType,
  formatOccupancySummary,
  formatOfferReturnDateLabel,
  formatReturnDateLabel,
  parseVariationRoomNames,
  selectedProviderListing,
  stripSimpleHtml,
} from './offer-detail-view';
import { formatDeparturePresentation } from '../search/departure-presentation';

const FOUR_PAX_TWO_ROOMS = {
  adults: 2,
  children: 2,
  rooms: 2,
  party: [
    { dateOfBirth: '1990-01-15', roomIndex: 0 },
    { dateOfBirth: '1988-03-03', roomIndex: 0 },
    { dateOfBirth: '2014-06-14', roomIndex: 1 },
    { dateOfBirth: '2018-01-22', roomIndex: 1 },
  ],
};

function makeOffer(overrides: Partial<TravelOffer> = {}): TravelOffer {
  return {
    id: 'sunweb-1',
    provider: 'Sunweb',
    hotelName: 'Hotel Test',
    destinationCountry: 'Spanje',
    nights: 7,
    price: 499,
    pricePerDay: 71,
    imageUrl: 'https://example.com/a.jpg',
    deepLink: 'https://www.sunweb.nl/hotel-don-pancho',
    ...overrides,
  };
}

test('affiliate href is the stored deepLink without rewriting', () => {
  const offer = makeOffer({
    deepLink: 'https://www.sunweb.nl/hotel-don-pancho?existing=1',
  });
  assert.equal(affiliateHref(offer), 'https://www.sunweb.nl/hotel-don-pancho?existing=1');
});

test('affiliate href keeps stored Sunweb feed deepLink for 2A/1R', () => {
  const offer = makeOffer({
    id: 'sunweb-84012-2026-09-26-8-BRU-Logies-427',
    deepLink: SUNWEB_PRODUCT_URL,
  });
  assert.equal(affiliateHref(offer), SUNWEB_PRODUCT_URL);
  assert.equal(affiliateHref(offer, { adults: 2, rooms: 1 }), SUNWEB_PRODUCT_URL);
  assert.ok(affiliateHref(offer, { adults: 2, rooms: 1 })?.includes('1996-07-30'));
});

test('affiliate href rewrites Sunweb 4p/2r click-out inside TT wrap', () => {
  const offer = makeOffer({
    id: 'sunweb-84012-2026-09-26-8-BRU-Logies-427',
    deepLink: SUNWEB_PRODUCT_URL,
  });
  const href = affiliateHref(offer, FOUR_PAX_TWO_ROOMS);
  assert.ok(href);
  const outer = new URL(href);
  assert.equal(outer.searchParams.get('tt'), '1393_1754875_511747_');
  const landing = new URL(unwrapSunwebProductUrl(href));
  assert.equal(landing.searchParams.get('Participants[0][0]'), '1990-01-15');
  assert.equal(landing.searchParams.get('Participants[0][1]'), '1988-03-03');
  assert.equal(landing.searchParams.get('Participants[1][0]'), '2014-06-14');
  assert.equal(landing.searchParams.get('Participants[1][1]'), '2018-01-22');
  assert.equal(landing.searchParams.get('Duration[0]'), '8');
  assert.equal(landing.searchParams.get('DepartureAirport[0]'), 'BRU');
  assert.equal(landing.searchParams.get('DepartureDate[0]'), '2026-09-26');
  assert.equal(landing.searchParams.get('Mealplan[0]'), 'LG');
  assert.ok(!href.includes('1996-07-30'));
});

test('affiliate href fail-closes Sunweb 4p/2r when occupancy landing is unusable', () => {
  assert.equal(
    affiliateHref(
      makeOffer({
        id: 'sunweb-84012-2026-09-26-8-BRU-Logies-427',
        deepLink: 'https://www.sunweb.be/x',
      }),
      FOUR_PAX_TWO_ROOMS,
    ),
    undefined,
  );
  assert.equal(
    affiliateHref(
      makeOffer({
        id: 'sunweb-84012-2026-09-26-8-BRU-Logies-427',
        deepLink: SUNWEB_LANDING,
      }),
      { adults: 2, children: 2, rooms: 2 },
    ),
    undefined,
  );
});

test('affiliate href keeps stored Eliza feed deepLink for 2A/1R', () => {
  const offer = makeOffer({
    id: 'eliza-6270665',
    provider: 'Eliza was here',
    deepLink: ELIZA_PRODUCT_URL,
  });
  assert.equal(affiliateHref(offer), ELIZA_PRODUCT_URL);
  assert.equal(affiliateHref(offer, { adults: 2, rooms: 1 }), ELIZA_PRODUCT_URL);
  assert.ok(affiliateHref(offer, { adults: 2, rooms: 1 })?.includes('1996-07-30'));
});

test('affiliate href rewrites Eliza 4p/2r click-out inside TT wrap', () => {
  const offer = makeOffer({
    id: 'eliza-6270665',
    provider: 'Eliza was here',
    deepLink: ELIZA_PRODUCT_URL,
  });
  const href = affiliateHref(offer, FOUR_PAX_TWO_ROOMS);
  assert.ok(href);
  const outer = new URL(href);
  assert.equal(outer.searchParams.get('tt'), '1327_2084000_511747_');
  const landing = new URL(unwrapElizaProductUrl(href));
  assert.equal(landing.searchParams.get('Participants[0][0]'), '1990-01-15');
  assert.equal(landing.searchParams.get('Participants[0][1]'), '1988-03-03');
  assert.equal(landing.searchParams.get('Participants[1][0]'), '2014-06-14');
  assert.equal(landing.searchParams.get('Participants[1][1]'), '2018-01-22');
  assert.equal(landing.searchParams.get('Duration[0]'), '8');
  assert.equal(landing.searchParams.get('DepartureAirport[0]'), 'BRU');
  assert.equal(landing.searchParams.get('DepartureDate[0]'), '2026-11-19');
  assert.equal(landing.searchParams.get('Mealplan[0]'), 'LG');
  assert.ok(!href.includes('1996-07-30'));
});

test('affiliate href fail-closes Eliza 4p/2r when occupancy landing is unusable', () => {
  assert.equal(
    affiliateHref(
      makeOffer({
        id: 'eliza-6270665',
        provider: 'Eliza was here',
        deepLink: 'https://www.elizawashere.be/x',
      }),
      FOUR_PAX_TWO_ROOMS,
    ),
    undefined,
  );
  assert.equal(
    affiliateHref(
      makeOffer({
        id: 'eliza-6270665',
        provider: 'Eliza was here',
        deepLink: ELIZA_LANDING,
      }),
      { adults: 2, children: 2, rooms: 2 },
    ),
    undefined,
  );
});

test('affiliate href uses the selected Corendon listing deepLink', () => {
  const offer = makeOffer({
    provider: 'Corendon',
    deepLink: 'https://www.corendon.be/vakantie#x',
    listingHost: 'www.corendon.nl',
    providerListings: [
      {
        provider: 'Corendon',
        feedId: 'corendon-benl',
        host: 'www.corendon.be',
        deepLink: 'https://www.corendon.be/vakantie#x',
      },
      {
        provider: 'Corendon',
        feedId: 'corendon-nl',
        host: 'www.corendon.nl',
        deepLink: 'https://www.corendon.nl/vakantie#x',
      },
    ],
  });
  assert.equal(affiliateHref(offer), 'https://www.corendon.nl/vakantie#x');
  assert.equal(affiliateHref(offer, FOUR_PAX_TWO_ROOMS), 'https://www.corendon.nl/vakantie#x');
  assert.equal(selectedProviderListing(offer)?.host, 'www.corendon.nl');
  assert.equal(formatListingHostLabel(offer.listingHost), 'corendon.nl');
  assert.equal(bookingCtaLabel(offer), 'Boek bij Corendon');
  assert.equal(bookingVacationCtaLabel(offer), 'Boek deze vakantie bij Corendon');
  assert.equal(formatListingHostLabel('fr.corendon.be'), 'fr.corendon.be');
});

test('variation JSON exposes room names, not raw JSON', () => {
  const names = parseVariationRoomNames(
    '{"variation":[{"property":[{"value":125651,"name":"roomId"},{"value":"2-persoonskamer Deluxe algemeen","name":"roomName"}]}]}',
  );
  assert.deepEqual(names, ['2-persoonskamer Deluxe algemeen']);
});

test('basis facts include currency, coordinates and categories-backed fields when present', () => {
  const facts = buildBasisFacts(
    makeOffer({
      currency: 'EUR',
      latitude: 39.53418,
      longitude: 2.38745,
      destinationCity: 'Calvià',
      extraInfo: 'Deluxe',
    }),
  );
  const byLabel = Object.fromEntries(facts.map((fact) => [fact.label, fact.value]));
  assert.equal(byLabel.Valuta, 'EUR');
  assert.equal(byLabel.Stad, 'Calvià');
  assert.equal(byLabel.Locatie, '39.53418, 2.38745');
});

test('basis facts show Inclusief huurauto only when hasCarRental is true', () => {
  const withCar = buildBasisFacts(makeOffer({ hasCarRental: true }));
  assert.equal(
    withCar.find((fact) => fact.label === 'Huurauto')?.value,
    'Inclusief huurauto',
  );
  const withoutCar = buildBasisFacts(makeOffer({}));
  assert.equal(withoutCar.some((fact) => fact.label === 'Huurauto'), false);
});

test('occupancy summary: 2 adults from DOBs', () => {
  assert.equal(
    formatOccupancySummary({
      party: [
        { dateOfBirth: '1990-01-15', roomIndex: 0 },
        { dateOfBirth: '1988-03-03', roomIndex: 0 },
      ],
    }),
    '2 volwassenen • 1 kamer',
  );
});

test('occupancy summary: 2 adults + 1 child', () => {
  assert.equal(
    formatOccupancySummary({
      rooms: 1,
      party: [
        { dateOfBirth: '1990-01-15', roomIndex: 0 },
        { dateOfBirth: '1988-03-03', roomIndex: 0 },
        { dateOfBirth: '2014-06-14', roomIndex: 0 },
      ],
    }),
    '2 volwassenen • 1 kind • 1 kamer',
  );
});

test('occupancy summary: 2 adults + 2 children + 2 rooms, not 4 volwassenen', () => {
  const summary = formatOccupancySummary({
    adults: 4,
    rooms: 2,
    party: [
      { dateOfBirth: '1990-01-15', roomIndex: 0 },
      { dateOfBirth: '1988-03-03', roomIndex: 0 },
      { dateOfBirth: '2014-06-14', roomIndex: 1 },
      { dateOfBirth: '2018-01-22', roomIndex: 1 },
    ],
  });
  assert.equal(summary, '2 volwassenen • 2 kinderen • 2 kamers');
  assert.equal(summary?.includes('4 volwassenen'), false);
});

test('occupancy summary: adults only with multiple rooms', () => {
  assert.equal(
    formatOccupancySummary({
      rooms: 2,
      party: [
        { dateOfBirth: '1990-01-15', roomIndex: 0 },
        { dateOfBirth: '1988-03-03', roomIndex: 1 },
      ],
    }),
    '2 volwassenen • 2 kamers',
  );
});

test('detail airport label is VacationWeb name, not IATA or country ISO', () => {
  assert.equal(
    formatDepartureAirport(
      makeOffer({
        departureAirport: 'BRU',
        departureAirportCode: 'BE',
        airport: 'Brussel Zaventem',
      }),
    ),
    'Brussel',
  );
  const facts = buildBasisFacts(
    makeOffer({
      departureAirport: 'BRU',
      departureAirportCode: 'BE',
      airport: 'Brussel Zaventem',
    }),
  );
  const airportFact = facts.find((fact) => fact.label === 'Vertrekluchthaven');
  assert.equal(airportFact?.value, 'Brussel');
  assert.equal(facts.some((fact) => fact.value === 'BRU' || fact.value.includes('BE')), false);
});

test('Results and Detail prefer offer departure date over search window', () => {
  const sunwebExact = formatDeparturePresentation(
    { departureStart: '2026-08-28', departureEnd: '2026-08-28' },
    '2026-08-28',
  );
  const corendonExact = formatDeparturePresentation(
    { departureStart: '2026-08-28', departureEnd: '2026-08-28' },
    '28/08/2026',
  );
  assert.equal(sunwebExact.phrase, 'Vertrek op 28/08/2026');
  assert.equal(corendonExact.phrase, sunwebExact.phrase);

  const rangeOnly = formatDeparturePresentation({
    departureStart: '2026-08-28',
    departureEnd: '2026-09-02',
  });
  assert.equal(rangeOnly.phrase, 'Vertrek tussen 28/08/2026 en 02/09/2026');

  const offerInRange = formatDeparturePresentation(
    { departureStart: '2026-08-28', departureEnd: '2026-09-02' },
    '2026-08-29',
  );
  assert.equal(offerInRange.phrase, 'Vertrek op 29/08/2026');

  const facts = buildBasisFacts(makeOffer({ departureDate: '2026-08-28' }));
  const dateFact = facts.find((fact) => fact.label === 'Vertrekdatum');
  assert.equal(dateFact?.value, 'Vertrek op 28/08/2026');
});

test('stripSimpleHtml drops Corendon style blocks so Overview never shows CSS', () => {
  const raw = `<style>
 .usp ul {
 list-style: none;
 }
 .usp li:before {
 content: "\\e775";
 font-family: COR Icons WF;
 display: inline-block;
 color: #26a514;
 width: 1.3em;
 margin-left: -3.1em;
 }
</style>
<div class="row"><p>Club Big Blue Suite Hotel ligt in de rustige wijk Oba.</p></div>`;
  const cleaned = stripSimpleHtml(raw);
  assert.equal(cleaned, 'Club Big Blue Suite Hotel ligt in de rustige wijk Oba.');
  assert.doesNotMatch(cleaned ?? '', /\.usp/);
  assert.doesNotMatch(cleaned ?? '', /list-style/);
  assert.doesNotMatch(cleaned ?? '', /font-family/);
  assert.equal(stripSimpleHtml('.usp { color: red; }'), undefined);
});

test('return date is departure plus nights and is not invented without a date', () => {
  assert.match(formatReturnDateLabel('15/10/2026', 7) ?? '', /22\s*okt\.?\s*2026/i);
  assert.match(formatReturnDateLabel('2026-10-15', 7) ?? '', /22\s*okt\.?\s*2026/i);
  assert.equal(formatReturnDateLabel(undefined, 7), undefined);
  assert.equal(formatReturnDateLabel('15/10/2026', 0), undefined);
});

test('generic durationType dagen is shown as days for Sunweb catalog offers', () => {
  assert.equal(formatDurationType('dagen'), undefined);
  assert.equal(formatDurationType('Dagen'), undefined);
  assert.equal(formatDurationType('days'), undefined);
  assert.equal(formatNightsLabel(5, 'dagen', 'Sunweb'), '5 dagen');
  assert.equal(formatNightsLabel(5, 'rondreis', 'Sunweb'), '5 dagen • Rondreis');
  assert.equal(formatNightsLabel(5, 'rondreis'), '5 nachten • Rondreis');
  const facts = buildBasisFacts(makeOffer({ nights: 5, durationType: 'dagen' }));
  assert.equal(facts.find((fact) => fact.label === 'Reisduur')?.value, '5 dagen');
  assert.equal(facts.find((fact) => fact.label === 'Duurtype'), undefined);
});

test('Corendon return date uses catalog days minus one', () => {
  assert.match(
    formatOfferReturnDateLabel(
      makeOffer({
        provider: 'Corendon',
        nights: 8,
        departureDate: '2026-08-29',
      }),
    ) ?? '',
    /5\s*sep\.?\s*2026/i,
  );
});

test('Sunweb return date uses catalog days as calendar offset', () => {
  assert.match(
    formatOfferReturnDateLabel(
      makeOffer({
        provider: 'Sunweb',
        nights: 8,
        departureDate: '2026-10-07',
      }),
    ) ?? '',
    /15\s*okt\.?\s*2026/i,
  );
});

