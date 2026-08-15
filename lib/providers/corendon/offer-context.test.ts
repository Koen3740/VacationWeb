import assert from 'node:assert/strict';
import test from 'node:test';
import type { TravelOffer } from '../../feeds/canonical/travel-offer';
import {
  buildCorendonLiveContext,
  corendonFragmentDateToIso,
  extractCorendonAccommodationId,
  parseCorendonUrlFragment,
  resolveCorendonLiveOccupancy,
  unwrapCorendonProductUrl,
} from './offer-context';

const FRAGMENT = '9514.COSPY.BRUCFU.270826.3-4-3.SZ-U';
const DIRECT_URL = `https://www.corendon.be/vakantie#${FRAGMENT}`;

function makeOffer(overrides: Partial<TravelOffer> = {}): TravelOffer {
  return {
    id: 'corendon-9514',
    provider: 'Corendon',
    hotelName: 'Spyridoula Apartments',
    destinationCountry: 'Griekenland',
    departureDate: '2026-08-27',
    nights: 4,
    price: 458,
    pricePerDay: 115,
    imageUrl: 'https://example.com/a.jpg',
    deepLink: DIRECT_URL,
    ...overrides,
  };
}

test('extractCorendonAccommodationId: feed id and variant suffix', () => {
  assert.equal(extractCorendonAccommodationId('corendon-9514'), '9514');
  assert.equal(extractCorendonAccommodationId('corendon-9514-2026-08-27-4'), '9514');
  assert.equal(extractCorendonAccommodationId('corendon-5007-EINPMI-041027-3-DZIU'), '5007');
  assert.equal(extractCorendonAccommodationId('corendon-a'), null);
  assert.equal(extractCorendonAccommodationId('prijsvrij-9514'), null);
});

test('unwrapCorendonProductUrl: TradeTracker u/r and direct URL', () => {
  const wrappedU =
    'https://tc.tradetracker.net/?c=1&u=' + encodeURIComponent(DIRECT_URL);
  const wrappedR =
    'https://www.prijsvrij.be/vakantie/?r=' + encodeURIComponent(DIRECT_URL);
  assert.equal(unwrapCorendonProductUrl(DIRECT_URL), DIRECT_URL);
  assert.equal(unwrapCorendonProductUrl(wrappedU), DIRECT_URL);
  assert.equal(unwrapCorendonProductUrl(wrappedR), DIRECT_URL);
});

test('parseCorendonUrlFragment: hotel, airport, DDMMYY date, duration', () => {
  const parsed = parseCorendonUrlFragment(DIRECT_URL);
  assert.ok(parsed);
  assert.equal(parsed.hotelId, '9514');
  assert.equal(parsed.accommodationCode, 'COSPY');
  assert.equal(parsed.airportRoute, 'BRUCFU');
  assert.equal(parsed.dateYymmdd, '270826');
  assert.equal(parsed.durationNights, '3-4-3');
  assert.equal(parsed.roomBoard, 'SZ-U');
  assert.equal(corendonFragmentDateToIso(parsed.dateYymmdd), '2026-08-27');
});

test('occupancy: default 2A only; children/babies/rooms invalid', () => {
  assert.equal(resolveCorendonLiveOccupancy({}).ok, true);
  assert.equal(resolveCorendonLiveOccupancy({ adults: 2 }).ok, true);
  assert.equal(resolveCorendonLiveOccupancy({ adults: 2, children: 1 }).ok, false);
  assert.equal(resolveCorendonLiveOccupancy({ adults: 2, babies: 1 }).ok, false);
  assert.equal(resolveCorendonLiveOccupancy({ adults: 2, rooms: 2 }).ok, false);
  assert.equal(resolveCorendonLiveOccupancy({ adults: 3 }).ok, false);
});

test('buildCorendonLiveContext: mapping + date + occupancy', () => {
  const ok = buildCorendonLiveContext(makeOffer(), { adults: 2 });
  assert.ok(ok);
  assert.equal(ok.accommodationId, '9514');
  assert.equal(ok.departureIso, '2026-08-27');
  assert.equal(ok.fragment.airportRoute, 'BRUCFU');
  assert.equal(ok.fragment.durationNights, '3-4-3');
  assert.equal(ok.feHost, 'www.corendon.be');

  assert.equal(buildCorendonLiveContext(makeOffer(), { adults: 2, children: 1 }), null);
  assert.equal(
    buildCorendonLiveContext(makeOffer({ id: 'corendon-9999' }), { adults: 2 }),
    null,
  );
  assert.equal(
    buildCorendonLiveContext(makeOffer({ deepLink: 'https://www.corendon.be/vakantie' }), { adults: 2 }),
    null,
  );
  assert.equal(
    buildCorendonLiveContext(makeOffer({ provider: 'Sunweb' }), { adults: 2 }),
    null,
  );
});
