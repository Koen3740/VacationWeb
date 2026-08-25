import assert from 'node:assert/strict';
import test from 'node:test';
import type { StoredOffer } from '../feeds/types/stored-offer';
import {
  assignCanonicalOfferIdentities,
  buildCanonicalOfferIdentity,
  detailObjectKey,
  detailObjectSha256,
} from './canonical-offer-identity';

function prijsvrij(overrides: Partial<StoredOffer> = {}): StoredOffer {
  return {
    externalId: 'prijsvrij-446251-2026-09-30-8-722-HP',
    provider: 'Prijsvrij',
    hotelName: 'Test PV',
    country: 'Spanje',
    nights: 8,
    price: 722,
    departureDate: '2026-09-30',
    boardType: 'Half pension',
    deepLink: 'https://www.prijsvrij.be/x',
    imageUrl: 'https://example.com/a.jpg',
    ...overrides,
  };
}

function corendon(overrides: Partial<StoredOffer> = {}): StoredOffer {
  return {
    externalId: 'corendon-5007-EINPMI-041027-3-DZIU',
    provider: 'Corendon',
    hotelName: 'Test Corendon',
    country: 'Spanje',
    nights: 3,
    price: 400,
    deepLink: 'https://www.corendon.be/vakantie#5007.MLELC.EINPMI.041027.3.DZI-U',
    imageUrl: 'https://example.com/a.jpg',
    ...overrides,
  };
}

function sunweb(overrides: Partial<StoredOffer> = {}): StoredOffer {
  const landing =
    'https://www.sunweb.be/nl/vakantie/x?Duration[0]=8&TransportType[0]=Flight&Mealplan[0]=All Inclusive&DepartureAirport[0]=BRU&DepartureDate[0]=2026-08-28';
  return {
    externalId: 'sunweb-38128-2026-08-28-8-BRU-AllInclusive',
    provider: 'Sunweb',
    hotelName: 'Test Sunweb',
    country: 'Griekenland',
    nights: 8,
    price: 500,
    departureDate: '2026-08-28',
    departureAirport: 'BRU',
    boardType: 'All Inclusive',
    deepLink: `https://www.sunweb.be/nl/vakantie/reizen?tt=1&r=${encodeURIComponent(landing)}`,
    imageUrl: 'https://example.com/a.jpg',
    ...overrides,
  };
}

function eliza(overrides: Partial<StoredOffer> = {}): StoredOffer {
  return {
    externalId: 'eliza-6270665',
    provider: 'Eliza was here',
    hotelName: 'Test Eliza',
    country: 'Griekenland',
    nights: 7,
    price: 300,
    deepLink: 'https://www.elizawashere.be/x',
    imageUrl: 'https://example.com/a.jpg',
    ...overrides,
  };
}

test('canonical identity is deterministic', () => {
  const first = buildCanonicalOfferIdentity(prijsvrij());
  const second = buildCanonicalOfferIdentity(prijsvrij());
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  if (first.ok && second.ok) {
    assert.equal(first.identity, second.identity);
    assert.equal(first.identity, 'prijsvrij|446251|2026-09-30|8|HP');
  }
});

test('canonical identity differs for genuinely different provider offers', () => {
  const ids = [prijsvrij(), corendon(), sunweb(), eliza()].map((offer) => {
    const result = buildCanonicalOfferIdentity(offer);
    assert.equal(result.ok, true);
    return result.ok ? result.identity : '';
  });
  assert.equal(new Set(ids).size, 4);
});

test('Prijsvrij price changes do not change canonical identity', () => {
  const cheap = buildCanonicalOfferIdentity(prijsvrij({ price: 100, externalId: 'prijsvrij-446251-2026-09-30-8-100-HP' }));
  const expensive = buildCanonicalOfferIdentity(prijsvrij({ price: 9999, externalId: 'prijsvrij-446251-2026-09-30-8-9999-HP' }));
  assert.equal(cheap.ok && expensive.ok, true);
  if (cheap.ok && expensive.ok) {
    assert.equal(cheap.identity, expensive.identity);
  }
});

test('Sunweb overlay price is not part of identity', () => {
  const a = buildCanonicalOfferIdentity(sunweb({ price: 400 }));
  const b = buildCanonicalOfferIdentity(sunweb({ price: 800 }));
  assert.equal(a.ok && b.ok, true);
  if (a.ok && b.ok) {
    assert.equal(a.identity, b.identity);
    assert.equal(a.identity, 'sunweb|38128|2026-08-28|8|BRU|all-inclusive');
  }
});

test('Corendon identity includes accommodationCode and keeps roomBoard hyphens', () => {
  const result = buildCanonicalOfferIdentity(corendon());
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.identity, 'corendon|5007|mlelc|einpmi|041027|3|dzi-u');
  }
});

test('Corendon BE/NL listing host is not identity', () => {
  const be = buildCanonicalOfferIdentity(corendon());
  const nl = buildCanonicalOfferIdentity(
    corendon({
      deepLink: 'https://www.corendon.nl/vakantie#5007.MLELC.EINPMI.041027.3.DZI-U',
      listingHost: 'www.corendon.nl',
    }),
  );
  assert.equal(be.ok && nl.ok, true);
  if (be.ok && nl.ok) {
    assert.equal(be.identity, nl.identity);
  }
});

test('Eliza identity is productId only', () => {
  const result = buildCanonicalOfferIdentity(eliza());
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.identity, 'eliza|6270665');
  }
});

test('duplicate canonical identity detection', () => {
  const assigned = assignCanonicalOfferIdentities([
    prijsvrij(),
    prijsvrij({ externalId: 'prijsvrij-446251-2026-09-30-8-900-HP', price: 900 }),
  ]);
  assert.equal(assigned.collisions.length, 1);
  assert.equal(assigned.collisions[0].identity, 'prijsvrij|446251|2026-09-30|8|HP');
});

test('detail key is sha256 of canonical identity under provider folder', () => {
  const result = buildCanonicalOfferIdentity(eliza());
  assert.equal(result.ok, true);
  if (result.ok) {
    const sha = detailObjectSha256(result.identity);
    assert.equal(sha.length, 64);
    assert.equal(
      detailObjectKey('g20260821T142158Z-a1b2c3d4e5f6', result.providerSlug, result.identity),
      `generations/g20260821T142158Z-a1b2c3d4e5f6/details/eliza/${sha}.json`,
    );
  }
});

test('Sunweb hash product IDs use opaque acco token plus landing board', () => {
  const landing =
    'https://www.sunweb.be/nl/vakantie/x?Duration[0]=8&TransportType[0]=Flight&Mealplan[0]=AI&DepartureAirport[0]=BRU&DepartureDate[0]=2024-10-12';
  const result = buildCanonicalOfferIdentity(
    sunweb({
      externalId: 'sunweb-f77858bf7fb9d98660fcb9048e18d5a7ccf8a4da-2024-10-12-8-BRU-708',
      departureDate: '2024-10-12',
      boardType: undefined,
      deepLink: `https://www.sunweb.be/nl/vakantie/reizen?tt=1&r=${encodeURIComponent(landing)}`,
    }),
  );
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(
      result.identity,
      'sunweb|f77858bf7fb9d98660fcb9048e18d5a7ccf8a4da|2024-10-12|8|BRU|all-inclusive',
    );
  }
});

test('Sunweb board spelling variants share identity', () => {
  const landingA =
    'https://www.sunweb.be/nl/vakantie/x?Duration[0]=8&TransportType[0]=Flight&Mealplan[0]=All inclusive&DepartureAirport[0]=BRU&DepartureDate[0]=2026-08-28';
  const landingB =
    'https://www.sunweb.be/nl/vakantie/x?Duration[0]=8&TransportType[0]=Flight&Mealplan[0]=AllInclusive&DepartureAirport[0]=BRU&DepartureDate[0]=2026-08-28';
  const a = buildCanonicalOfferIdentity(
    sunweb({ deepLink: `https://www.sunweb.be/nl/vakantie/reizen?tt=1&r=${encodeURIComponent(landingA)}` }),
  );
  const b = buildCanonicalOfferIdentity(
    sunweb({ deepLink: `https://www.sunweb.be/nl/vakantie/reizen?tt=2&r=${encodeURIComponent(landingB)}` }),
  );
  assert.equal(a.ok && b.ok, true);
  if (a.ok && b.ok) {
    assert.equal(a.identity, b.identity);
  }
});
