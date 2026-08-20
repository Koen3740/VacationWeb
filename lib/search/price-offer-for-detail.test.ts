import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import type { TravelOffer } from '../feeds/canonical/travel-offer';
import { clearLivePriceInflightForTests } from '../providers/prijsvrij/page1-receipt-pricing';
import { clearPrijsvrijReceiptTokenCache } from '../providers/prijsvrij/receipt-auth';
import { hasValidPresentablePrice, resultsPricePresentation } from './presentable-price';
import {
  clearResultsLivePriceCache,
  setResultsLivePriceOverlay,
} from './results-live-price-cache';
import { priceOfferForDetail } from './price-offer-for-detail';

const CORENDON_FRAGMENT = '9514.COSPY.BRUCFU.270826.3-4-3.SZ-U';

function makeOffer(
  overrides: Partial<TravelOffer> & Pick<TravelOffer, 'id' | 'provider'>,
): TravelOffer {
  return {
    hotelName: 'Test Hotel',
    destinationCountry: 'Spanje',
    departureDate: '2026-08-27',
    nights: 4,
    flightIncluded: 'true',
    price: 458,
    pricePerDay: 115,
    imageUrl: 'https://example.com/a.jpg',
    deepLink: `https://www.corendon.be/vakantie#${CORENDON_FRAGMENT}`,
    ...overrides,
  };
}

function okLowestBody(price = 876): string {
  return JSON.stringify({
    package: {
      lowestPriceTrip: {
        tripDepartureDate: '2026-08-27T00:00:00',
        trip: {
          price,
          tripCode: '9514.COSPY.BRUCFU.270826.3-4-3.SZ-U.BRUCFU4C.CFU',
        },
      },
    },
  });
}

beforeEach(() => {
  clearPrijsvrijReceiptTokenCache();
  clearResultsLivePriceCache();
  clearLivePriceInflightForTests();
});

test('Sunweb catalog price is not a bookable Detail candidate without proven live €', async () => {
  const priced = await priceOfferForDetail(
    makeOffer({
      id: 'sunweb-a',
      provider: 'Sunweb',
      price: 350,
      pricePerDay: 50,
      deepLink: 'https://www.sunweb.nl/hotel',
    }),
    { adults: 2 },
  );
  assert.equal(priced.price, 350);
  assert.equal(hasValidPresentablePrice(priced), false);
  assert.notEqual(resultsPricePresentation(priced), 'amount');
});

test('Corendon Detail uses live lowestpricesacco, not feed €', async () => {
  let lowestCalls = 0;
  const priced = await priceOfferForDetail(
    makeOffer({ id: 'corendon-9514', provider: 'Corendon', price: 458 }),
    { adults: 2 },
    {
      fetchImpl: async (input) => {
        const url = String(input);
        if (url.includes('lowestpricesacco')) {
          lowestCalls += 1;
          return new Response(okLowestBody(), { status: 200 });
        }
        throw new Error(`unexpected fetch ${url}`);
      },
    },
  );

  assert.equal(lowestCalls, 1);
  assert.equal(priced.livePriceStatus, 'proven');
  assert.equal(priced.livePriceSource, 'lowestpricesacco');
  assert.equal(priced.price, 876);
  assert.ok(hasValidPresentablePrice(priced));
});

test('Prijsvrij Detail does not call Receipt and does not show feed as live', async () => {
  let fetchCalls = 0;
  const priced = await priceOfferForDetail(
    makeOffer({
      id: 'prijsvrij-1',
      provider: 'Prijsvrij',
      price: 400,
      deepLink: 'https://www.prijsvrij.be/hotel',
    }),
    { adults: 2 },
    {
      fetchImpl: async () => {
        fetchCalls += 1;
        throw new Error('Receipt must not run on Detail');
      },
    },
  );

  assert.equal(fetchCalls, 0);
  assert.equal(priced.livePriceStatus, 'unavailable');
  assert.ok(!hasValidPresentablePrice(priced));
});

test('Prijsvrij Detail reuses a proven Results Receipt overlay', async () => {
  const offer = makeOffer({
    id: 'prijsvrij-cached',
    provider: 'Prijsvrij',
    price: 400,
    deepLink: 'https://www.prijsvrij.be/hotel',
  });
  setResultsLivePriceOverlay(offer.id, { adults: 2 }, {
    price: 512,
    pricePerDay: 128,
    livePriceStatus: 'proven',
    livePriceSource: 'receipt',
  });

  const priced = await priceOfferForDetail(offer, { adults: 2 }, {
    fetchImpl: async () => {
      throw new Error('Receipt must not run when overlay exists');
    },
  });

  assert.equal(priced.price, 512);
  assert.equal(priced.livePriceSource, 'receipt');
  assert.ok(hasValidPresentablePrice(priced));
});

const ELIZA_LANDING =
  'https://www.elizawashere.be/spanje/andalusie/ronda/casita-paradise-island' +
  '?Duration[0]=8&TransportType[0]=Flight&Mealplan[0]=LG' +
  '&DepartureAirport[0]=BRU&DepartureDate[0]=2026-11-19' +
  '&Participants[0][0]=1996-07-30&Participants[0][1]=1996-07-30';

const ELIZA_PRODUCT_URL =
  'https://www.elizawashere.be/reizen?tt=1327_2084000_511747_&r=' +
  encodeURIComponent(ELIZA_LANDING);

const ELIZA_LANDING_HTML =
  '{"template":"AccommodationPage","contextItemId":"29c6d01a-70c6-4297-9422-1c3dab8c94ad"}' +
  '"PDP.promotedPriceId":"C6E4E13C-D74A-4A4D-BC6B-C151B6FF1E42"';

test('Eliza Detail uses live getPromotedPrice, not feed €', async () => {
  let promotedCalls = 0;
  const priced = await priceOfferForDetail(
    makeOffer({
      id: 'eliza-6270665',
      provider: 'Eliza was here',
      price: 599,
      nights: 7,
      departureDate: '2026-11-19',
      deepLink: ELIZA_PRODUCT_URL,
    }),
    { adults: 2 },
    {
      fetchImpl: async (input) => {
        const url = String(input);
        if (url.includes('GetPromotedPriceApi')) {
          promotedCalls += 1;
          return new Response(
            JSON.stringify({
              accommodationId: 6270665,
              duration: 8,
              price: {
                totalPrice: 1304,
                averagePrice: 652,
                value: 652,
                legend: 'Vanafprijs p.p.',
              },
              departureDate: { raw: '2026-11-19' },
              acmInformation: { mealplanCode: 'LG' },
            }),
            { status: 200 },
          );
        }
        if (url.includes('elizawashere.be')) {
          return new Response(ELIZA_LANDING_HTML, { status: 200 });
        }
        throw new Error(`unexpected fetch ${url}`);
      },
    },
  );

  assert.equal(promotedCalls, 1);
  assert.equal(priced.livePriceStatus, 'proven');
  assert.equal(priced.livePriceSource, 'getPromotedPrice');
  assert.equal(priced.price, 652);
  assert.ok(hasValidPresentablePrice(priced));
});

test('Eliza Detail 4p/2r uses party Participants, not feed 2A', async () => {
  let promotedUrl = '';
  let landingUrl = '';
  const priced = await priceOfferForDetail(
    makeOffer({
      id: 'eliza-6270665',
      provider: 'Eliza was here',
      price: 599,
      nights: 7,
      departureDate: '2026-11-19',
      deepLink: ELIZA_PRODUCT_URL,
    }),
    {
      adults: 2,
      children: 2,
      rooms: 2,
      party: [
        { dateOfBirth: '1990-01-15', roomIndex: 0 },
        { dateOfBirth: '1988-03-03', roomIndex: 0 },
        { dateOfBirth: '2014-06-14', roomIndex: 1 },
        { dateOfBirth: '2018-01-22', roomIndex: 1 },
      ],
    },
    {
      fetchImpl: async (input) => {
        const url = String(input);
        if (url.includes('GetPromotedPriceApi')) {
          promotedUrl = url;
          return new Response(
            JSON.stringify({
              accommodationId: 6270665,
              duration: 8,
              price: {
                totalPrice: 3560,
                averagePrice: 890,
                value: 890,
                legend: 'Vanafprijs p.p.',
              },
              departureDate: { raw: '2026-11-19' },
              acmInformation: { mealplanCode: 'LG' },
            }),
            { status: 200 },
          );
        }
        if (url.includes('elizawashere.be')) {
          landingUrl = url;
          return new Response(ELIZA_LANDING_HTML, { status: 200 });
        }
        throw new Error(`unexpected fetch ${url}`);
      },
    },
  );

  assert.equal(priced.livePriceStatus, 'proven');
  assert.equal(priced.livePriceSource, 'getPromotedPrice');
  assert.equal(priced.price, 890);
  const landing = new URL(landingUrl);
  assert.equal(landing.searchParams.get('Participants[0][0]'), '1990-01-15');
  assert.equal(landing.searchParams.get('Participants[1][1]'), '2018-01-22');
  const promoted = new URL(promotedUrl);
  assert.equal(promoted.searchParams.get('Participants[0][0]'), '1990-01-15');
  assert.equal(promoted.searchParams.get('Participants[1][1]'), '2018-01-22');
  assert.ok(!landingUrl.includes('1996-07-30'));
});
