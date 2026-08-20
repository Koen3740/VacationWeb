import assert from 'node:assert/strict';
import test from 'node:test';
import type { TravelOffer } from '../feeds/canonical/travel-offer';
import { affiliateHref, buildGalleryImages, formatTravelerLines } from './offer-detail-view';
import {
  catalogSectionsForDisplay,
  parseCatalogContent,
  resolveOfferRoomTypes,
  selectCatalogRoom,
  selectedRoomAllowsProvenLivePrice,
} from './catalog-content';
import {
  CORENDON_14398_COPY,
  CORENDON_14398_HOTELKAMERS,
} from './fixtures/corendon-14398-catalog';
import { buildOfferDetailHref, buildResultsPageHref } from '../search/pagination';
import { parseSearchParams } from '../search/parse-search-params';
import { hasValidPresentablePrice } from '../search/presentable-price';
import { priceOfferForDetail } from '../search/price-offer-for-detail';
import { clearResultsLivePriceCache } from '../search/results-live-price-cache';
import { clearLivePriceInflightForTests } from '../providers/prijsvrij/page1-receipt-pricing';

const FRAGMENT = '14398.FECAR.AMSDLM.271026.4.DD-X';

function makeOffer(overrides: Partial<TravelOffer> = {}): TravelOffer {
  return {
    id: 'corendon-14398',
    provider: 'Corendon',
    hotelName: 'XO Cape Arnna Resort',
    destinationCountry: 'Turkije',
    extraInfo: '2-persoonskamer Deluxe',
    nights: 4,
    price: 1499,
    pricePerDay: 375,
    imageUrl: 'https://images.corendonresources.com/hotel.jpg',
    images: [
      'https://images.corendonresources.com/hotel.jpg',
      'https://images.corendonresources.com/pool.jpg',
    ],
    deepLink: `https://www.corendon.nl/vakantie#${FRAGMENT}`,
    listingHost: 'www.corendon.nl',
    feedSourceId: 'corendon-nl',
    descriptionLong: CORENDON_14398_COPY,
    ...overrides,
  };
}

test('Detail shows the mapped Hotelkamers types, not an invented subset', () => {
  const rooms = resolveOfferRoomTypes(makeOffer());
  assert.equal(rooms.length, 14);
  assert.deepEqual(
    rooms.map((room) => room.code),
    ['DZ2', 'DZ1', 'DJ', 'DD', 'FZ', 'FZ1', 'FJ', 'FU', 'FU1', 'FUX', 'FW', 'J', 'U1', 'U2'],
  );
  assert.equal(rooms.find((room) => room.code === 'DD')?.name, '2-persoonskamer Deluxe');
  assert.equal(rooms.find((room) => room.code === 'J')?.name, 'Junior suite');
});

test('roomtype data comes from mapped provider copy, including description and facts', () => {
  const deluxe = resolveOfferRoomTypes(makeOffer()).find((room) => room.code === 'DD');
  assert.ok(deluxe);
  assert.equal(deluxe.area, 'Oppervlakte tussen 48 en 54 m²');
  assert.ok(deluxe.facilities.includes('Airconditioning'));
  assert.ok(deluxe.facilities.includes('Wifi'));
  assert.match(deluxe.description ?? '', /Minibar/);
  assert.equal(deluxe.airConditioning, 'Airconditioning');
});

test('no invented room types when Hotelkamers is absent', () => {
  const rooms = resolveOfferRoomTypes(
    makeOffer({
      descriptionLong: 'Ligging * Aan het strand',
      extraInfo: '2-persoonskamer Deluxe',
    }),
  );
  assert.equal(rooms.length, 1);
  assert.equal(rooms[0].name, '2-persoonskamer Deluxe');
  assert.equal(rooms[0].included, true);
  assert.equal(rooms[0].code, 'DD');
});

test('room description is the provider feature list for that type', () => {
  const parsed = parseCatalogContent(CORENDON_14398_HOTELKAMERS);
  const swimUp = parsed.rooms.find((room) => room.code === 'DZ2');
  assert.ok(swimUp);
  assert.ok(swimUp.facilities.some((item) => /gedeelde zwembad/i.test(item)));
  assert.equal(
    swimUp.facilities.some((item) => item.includes('2-persoonskamer Standaard DZ1')),
    false,
  );
});

test('room images stay empty when only a hotel gallery exists', () => {
  const offer = makeOffer();
  const rooms = resolveOfferRoomTypes(offer);
  const gallery = buildGalleryImages(offer);
  assert.ok(gallery.length >= 2);
  for (const room of rooms) {
    assert.deepEqual(room.images, []);
  }
});

test('hotel gallery stays distinct from room data', () => {
  const offer = makeOffer();
  const gallery = buildGalleryImages(offer);
  const rooms = resolveOfferRoomTypes(offer);
  assert.ok(gallery.includes(offer.imageUrl));
  assert.equal(rooms.some((room) => room.images.includes(offer.imageUrl)), false);
});

test('room selection changes Detail state via the room query param', () => {
  const rooms = resolveOfferRoomTypes(makeOffer());
  const comfort = rooms.find((room) => room.code === 'DJ');
  assert.ok(comfort);
  const href = buildOfferDetailHref('corendon-14398', {
    adults: 2,
    selectedRoom: comfort.id,
  });
  const parsed = parseSearchParams(Object.fromEntries(new URL(href, 'https://vacationmap.be').searchParams));
  assert.equal(parsed.selectedRoom, 'DJ');
  const selected = selectCatalogRoom(rooms, parsed.selectedRoom);
  assert.equal(selected?.code, 'DJ');
  assert.equal(selected?.included, false);
});

test('room selection survives Detail href round-trip with search context', () => {
  const href = buildOfferDetailHref('corendon-14398', {
    adults: 4,
    rooms: 2,
    selectedRoom: 'FZ1',
    party: [
      { dateOfBirth: '1975-03-12', roomIndex: 0 },
      { dateOfBirth: '1978-06-04', roomIndex: 0 },
      { dateOfBirth: '2010-09-01', roomIndex: 0 },
      { dateOfBirth: '2022-01-22', roomIndex: 1 },
    ],
    departureAirport: 'AMS',
    departureStart: '2026-10-27',
    nights: [4],
    page: 2,
  });
  const parsed = parseSearchParams(Object.fromEntries(new URL(href, 'https://vacationmap.be').searchParams));
  assert.equal(parsed.selectedRoom, 'FZ1');
  assert.equal(parsed.adults, 4);
  assert.equal(parsed.rooms, 2);
  assert.deepEqual(
    parsed.party?.map((traveller) => traveller.dateOfBirth),
    ['1975-03-12', '1978-06-04', '2010-09-01', '2022-01-22'],
  );
  assert.deepEqual(
    parsed.party?.map((traveller) => traveller.roomIndex),
    [0, 0, 0, 1],
  );
  assert.equal(parsed.departureAirport, 'AMS');
  assert.equal(parsed.page, 2);
});

test('Reisgezelschap V2 DOB, room count and assignments stay on Detail and back', () => {
  const detailHref = buildOfferDetailHref('corendon-14398', {
    adults: 4,
    rooms: 2,
    selectedRoom: 'DD',
    party: [
      { dateOfBirth: '1980-03-12', roomIndex: 0 },
      { dateOfBirth: '1982-08-07', roomIndex: 0 },
      { dateOfBirth: '2011-06-14', roomIndex: 0 },
      { dateOfBirth: '2022-01-22', roomIndex: 1 },
    ],
    departureAirport: 'BRU',
    page: 3,
  });
  const detailParams = parseSearchParams(
    Object.fromEntries(new URL(detailHref, 'https://vacationmap.be').searchParams),
  );
  const lines = formatTravelerLines(detailParams);
  assert.equal(lines.length, 4);
  assert.match(lines[0] ?? '', /1980/);
  assert.match(lines[3] ?? '', /kamer 2/);

  const backHref = buildResultsPageHref(detailParams, detailParams.page ?? 1);
  const back = parseSearchParams(Object.fromEntries(new URL(backHref, 'https://vacationmap.be').searchParams));
  assert.equal(back.selectedRoom, undefined);
  assert.equal(back.adults, 4);
  assert.equal(back.rooms, 2);
  assert.deepEqual(back.party, detailParams.party);
  assert.equal(back.departureAirport, 'BRU');
  assert.equal(back.page, 3);
});

test('included Deluxe room allows listing-bound live price; Comfort does not use feed fallback', async () => {
  clearResultsLivePriceCache();
  clearLivePriceInflightForTests();
  const offer = makeOffer({
    providerListings: [
      {
        provider: 'Corendon',
        feedId: 'corendon-nl',
        host: 'www.corendon.nl',
        deepLink: `https://www.corendon.nl/vakantie#${FRAGMENT}`,
      },
    ],
  });
  const priced = await priceOfferForDetail(offer, { adults: 2 }, {
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          package: {
            lowestPriceTrip: {
              tripDepartureDate: '2026-10-27T00:00:00',
              trip: {
                price: 2565,
                tripCode: '14398.FECAR.AMSDLM.271026.4.DD-X.AMSDLM4C.DLM',
              },
            },
          },
        }),
        { status: 200 },
      ),
  });
  const rooms = resolveOfferRoomTypes(priced);
  const included = selectCatalogRoom(rooms, 'DD');
  const alternate = selectCatalogRoom(rooms, 'DJ');
  assert.equal(priced.livePriceStatus, 'proven');
  assert.equal(priced.price, 2565);
  assert.equal(priced.listingHost, 'www.corendon.nl');
  assert.ok(hasValidPresentablePrice(priced));
  assert.equal(selectedRoomAllowsProvenLivePrice(included), true);
  assert.equal(selectedRoomAllowsProvenLivePrice(alternate), false);
  assert.notEqual(priced.price, offer.price);
  assert.equal(affiliateHref(priced), priced.deepLink);
  assert.match(affiliateHref(priced) ?? '', /www\.corendon\.nl/);
});

test('catalog copy keeps hotel sections and strips Hotelkamers from the blob', () => {
  const copy = catalogSectionsForDisplay(CORENDON_14398_COPY);
  assert.ok(copy.sections.some((section) => section.title === 'Ligging'));
  assert.ok(copy.sections.some((section) => section.title === 'Algemeen & faciliteiten'));
  assert.equal(copy.sections.some((section) => /hotelkamers/i.test(section.title)), false);
});

test('glued Hotelkamers heading in real feed copy still yields room types', () => {
  const parsed = parseCatalogContent(
    'Tegen betaling: import drankjesHotelkamers * 2-persoonskamer Deluxe DD * Oppervlakte tussen 48 en 54 m² * Wifi * Familiekamer Standaard FZ * 2 slaapkamers',
  );
  assert.equal(parsed.rooms.length, 2);
  assert.equal(parsed.rooms[0].code, 'DD');
  assert.equal(parsed.rooms[1].code, 'FZ');
});

test('sidecar-style TOC and Standaardkamer still yield mapped rooms', () => {
  const parsed = parseCatalogContent(
    'Direct naar: * Ligging () * Faciliteiten () * Hotelkamers () * Verzorging () * Ligging: Alaaddin Beach * Direct aan het strand * Faciliteiten * 1 gebouw * Hotelkamers * Standaardkamer (1-2 personen) * Ca. 18-20 m² * Airconditioning * Televisie * Minibar*',
  );
  assert.equal(parsed.rooms.length, 1);
  assert.equal(parsed.rooms[0].name, 'Standaardkamer (1-2 personen)');
  assert.ok(parsed.rooms[0].area?.includes('18-20'));
  assert.ok(parsed.sections.some((section) => section.title === 'Ligging'));
  assert.ok(parsed.sections.some((section) => section.title === 'Faciliteiten'));
});

test('French Hotelkamers without codes still split on room names, not size lines', () => {
  const parsed = parseCatalogContent(
    "Hotelkamers * Chambres standard (min. 1 ad. - max. 2 ad. + 1 enf.) * Chambre (24-34 m²) * Téléphone * Télévision * Climatisation (gratuite) * Minibar (payant) * WiFi gratuit",
  );
  assert.equal(parsed.rooms.length, 1);
  assert.equal(parsed.rooms[0].name, 'Chambres standard (min. 1 ad. - max. 2 ad. + 1 enf.)');
  assert.ok(parsed.rooms[0].facilities.some((item) => /24-34/.test(item)));
});
