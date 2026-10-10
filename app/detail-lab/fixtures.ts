import type { CatalogRoomType } from '@/lib/offers/catalog-content';
import type { SearchParams, TravelOffer } from '@/types/travel';

/**
 * Fixture offers for the local detail harness. Not used by the live detail route.
 * Prices are the provider-shaped totals from the approved mock-up, not live calls.
 */

export const LAB_PARAMS: SearchParams = {
  adults: 2,
  rooms: 1,
  party: [
    { age: null, roomIndex: 0 },
    { age: null, roomIndex: 0 },
  ],
};

const HOTEL_IMAGES = [
  '/images/verified/crete/vw-story-crete-elafonissi-water-15071869.jpg',
  '/images/verified/crete/vw-story-crete-balos-aerial-commons.jpg',
  '/images/verified/sicily/vw-story-sicily-cefalu-waterfront-18453312.jpg',
  '/images/verified/crete/vw-pool-crete-falassarna.jpg',
  '/images/verified/sicily/vw-story-sicily-taormina-teatro-etna-commons.jpg',
  '/images/verified/crete/vw-story-crete-vai-beach-commons.jpg',
  '/images/verified/sicily/vw-story-sicily-isola-bella-37105275.jpg',
];

const ROUTE_IMAGES = [
  '/images/verified/crete/vw-story-crete-knossos-palace-commons.jpg',
  '/images/verified/albania/vw-story-albania-gjirokaster-cityscape-pudelek-fp.jpg',
  '/images/verified/sicily/vw-pool-sicily-noto-duomo.jpg',
  '/images/verified/crete/vw-story-crete-chania-shipyards-lighthouse-qi.jpg',
  '/images/verified/sicily/vw-story-sicily-concordia-temple-37261506.jpg',
  '/images/verified/albania/vw-story-albania-gjirokaster-clock-tower-pudelek5.jpg',
  '/images/verified/crete/vw-story-crete-spinalonga-ile-qi.jpg',
  '/images/verified/sicily/vw-pool-sicily-ortigia.jpg',
];

export const LAB_GALLERY_NOTE =
  'Voorbeeldfoto\'s voor deze weergave. Niet de foto\'s van deze accommodatie.';

function room(
  partial: Pick<CatalogRoomType, 'id' | 'name' | 'included'> & Partial<CatalogRoomType>,
): CatalogRoomType {
  return {
    code: undefined,
    area: undefined,
    bedrooms: undefined,
    bedConfig: undefined,
    airConditioning: undefined,
    balcony: undefined,
    seaView: undefined,
    pool: undefined,
    bathroom: undefined,
    minibar: undefined,
    safe: undefined,
    wifi: undefined,
    facilities: [],
    images: [],
    ...partial,
  };
}

export const hotelLabOffer: TravelOffer = {
  id: 'lab-hotel-bougainvillea',
  provider: 'Sunweb',
  hotelName: 'Bougainvillea Beach Resort',
  accommodation: 'Bougainvillea Beach Resort',
  accommodationType: 'Resort',
  destinationCountry: 'Spanje',
  destinationRegion: 'Canarische Eilanden',
  destinationProvince: 'Tenerife',
  destinationCity: 'Costa Adeje',
  departureAirport: 'BRU',
  departureAirportCode: 'BRU',
  departureDate: '2026-10-10',
  boardType: 'Halfpension',
  nights: 8,
  durationType: 'dagen',
  flightIncluded: 'true',
  stars: 5,
  rating: 8.9,
  price: 1107.75,
  pricePerDay: 158.25,
  currency: 'EUR',
  livePriceStatus: 'proven',
  livePriceSource: 'getPromotedPrice',
  liveTotalPrice: 2215.5,
  liveTotalPriceField: 'getPromotedPrice.totalPrice',
  liveDetailFacts: {
    listPrice: 2637.5,
    discountPercentage: 16,
  },
  imageUrl: HOTEL_IMAGES[0],
  images: HOTEL_IMAGES,
  descriptionShort:
    'Ruim resort aan de kust, met een grote tuin, zwembaden en het strand op loopafstand.',
  deepLink: 'https://www.sunweb.be/',
  lastMinute: 'true',
};

export const hotelLabRooms: CatalogRoomType[] = [
  room({
    id: 'DZZ',
    name: 'Tweepersoonskamer Zeezicht',
    code: 'DZZ',
    included: true,
    area: '28 m²',
    seaView: 'Zeezicht',
    balcony: 'Balkon',
    bathroom: 'Douche',
    wifi: 'Wifi',
    facilities: ['Airconditioning', 'Kluis', 'Föhn'],
  }),
  room({
    id: 'JS2',
    name: 'Junior Suite',
    code: 'JS2',
    included: false,
    area: '42 m²',
  }),
  room({
    id: 'FK4',
    name: 'Familiekamer',
    code: 'FK4',
    included: false,
    area: '38 m²',
  }),
];

export const rondreisLabOffer: TravelOffer = {
  id: 'lab-rondreis-andalusie',
  provider: 'Corendon',
  hotelName: 'Fly & Drive Andalusië Compleet',
  destinationCountry: 'Spanje',
  destinationRegion: 'Andalusië',
  departureAirport: 'BRU',
  departureAirportCode: 'BRU',
  arrivalAirport: 'AGP',
  departureDate: '2026-11-25',
  boardType: 'Logies en ontbijt',
  nights: 8,
  durationType: 'dagen',
  flightIncluded: 'true',
  hasCarRental: true,
  rating: 8.3,
  price: 769,
  pricePerDay: 109.86,
  currency: 'EUR',
  livePriceStatus: 'proven',
  livePriceSource: 'upsales',
  liveTotalPrice: 1538,
  liveTotalPriceField: 'upsales.totalPrice',
  liveDetailFacts: {
    arrivalAirport: 'AGP',
    flights: [
      {
        direction: 'outbound',
        departureAirportCode: 'BRU',
        arrivalAirportCode: 'AGP',
        departureAt: '06:40',
        arrivalAt: '09:25',
        airlineName: 'Corendon Airlines',
        airlineCode: 'XC',
        flightNumber: 'XC1234',
        baggageKg: 20,
      },
      {
        direction: 'inbound',
        departureAirportCode: 'AGP',
        arrivalAirportCode: 'BRU',
        departureAt: '18:10',
        arrivalAt: '21:55',
        airlineName: 'Corendon Airlines',
        airlineCode: 'XC',
        flightNumber: 'XC1235',
        baggageKg: 20,
      },
    ],
    transfer: {
      status: 'bookable',
      remark: 'Je kunt de transfer als extra bijboeken.',
    },
  },
  imageUrl: ROUTE_IMAGES[0],
  images: ROUTE_IMAGES,
  descriptionShort:
    'Acht dagen met vlucht en huurauto door Andalusië.',
  deepLink: 'https://www.corendon.be/',
};

export const hotelLabImages = [...HOTEL_IMAGES, ...ROUTE_IMAGES];
export const rondreisLabImages = ROUTE_IMAGES;
