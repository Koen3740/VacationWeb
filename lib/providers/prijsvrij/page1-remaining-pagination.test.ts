import assert from 'node:assert/strict';
import test from 'node:test';
import type { TravelOffer } from '../../feeds/canonical/travel-offer';
import { PRIJSVRIJ_PROVIDER_NAME } from './constants';
import {
  getResultsPageOffers,
  selectPage1Candidates,
  splitPage1AndRemaining,
} from './page1-receipt-pricing';

function makeOffer(
  overrides: Partial<TravelOffer> & Pick<TravelOffer, 'id' | 'provider'>,
): TravelOffer {
  return {
    hotelName: 'Test Hotel',
    destinationCountry: 'Spanje',
    destinationRegion: 'Mallorca',
    departureDate: '2026-09-30',
    nights: 8,
    flightIncluded: 'true',
    price: 400,
    pricePerDay: 50,
    imageUrl: 'https://example.com/a.jpg',
    deepLink: 'https://example.com',
    ...overrides,
  };
}

function ids(offers: TravelOffer[]): string[] {
  return offers.map((o) => o.id);
}

function assertPartitionIntegrity(original: TravelOffer[], page1: TravelOffer[], remaining: TravelOffer[]) {
  const originalIds = ids(original);
  const combined = [...ids(page1), ...ids(remaining)];
  assert.deepEqual([...combined].sort(), [...originalIds].sort());
  assert.equal(new Set(combined).size, combined.length);
  assert.equal(new Set(ids(page1)).size, page1.length);
  assert.equal(new Set(ids(remaining)).size, remaining.length);

  // Remaining keeps relative order of original.
  const originalIndex = new Map(originalIds.map((id, i) => [id, i]));
  for (let i = 1; i < remaining.length; i += 1) {
    assert.ok(
      (originalIndex.get(remaining[i - 1].id) ?? -1) < (originalIndex.get(remaining[i].id) ?? -1),
    );
  }
}

test('exact 10 totale resultaten on page 1 when enough offers', () => {
  const offers = [
    ...Array.from({ length: 5 }, (_, i) =>
      makeOffer({ id: `prijsvrij-${i}`, provider: PRIJSVRIJ_PROVIDER_NAME }),
    ),
    ...Array.from({ length: 12 }, (_, i) =>
      makeOffer({ id: `corendon-${i}`, provider: 'Corendon' }),
    ),
  ];
  const { page1 } = splitPage1AndRemaining(offers);
  assert.equal(page1.length, 10);
});

test('0 Prijsvrij → first 10 by ranking', () => {
  const offers = Array.from({ length: 15 }, (_, i) =>
    makeOffer({ id: `corendon-${i}`, provider: 'Corendon' }),
  );
  const { page1, remaining } = splitPage1AndRemaining(offers);
  assert.deepEqual(ids(page1), ids(offers.slice(0, 10)));
  assert.deepEqual(ids(remaining), ids(offers.slice(10)));
  assertPartitionIntegrity(offers, page1, remaining);
});

test('1 Prijsvrij on page 1', () => {
  const offers = [
    makeOffer({ id: 'prijsvrij-0', provider: PRIJSVRIJ_PROVIDER_NAME }),
    ...Array.from({ length: 12 }, (_, i) =>
      makeOffer({ id: `corendon-${i}`, provider: 'Corendon' }),
    ),
  ];
  const { page1 } = splitPage1AndRemaining(offers);
  assert.equal(page1.filter((o) => o.provider === PRIJSVRIJ_PROVIDER_NAME).length, 1);
  assert.equal(page1.length, 10);
});

test('2 Prijsvrij on page 1', () => {
  const offers = [
    makeOffer({ id: 'prijsvrij-0', provider: PRIJSVRIJ_PROVIDER_NAME }),
    makeOffer({ id: 'prijsvrij-1', provider: PRIJSVRIJ_PROVIDER_NAME }),
    ...Array.from({ length: 12 }, (_, i) =>
      makeOffer({ id: `corendon-${i}`, provider: 'Corendon' }),
    ),
  ];
  const { page1 } = splitPage1AndRemaining(offers);
  assert.equal(page1.filter((o) => o.provider === PRIJSVRIJ_PROVIDER_NAME).length, 2);
});

test('3 Prijsvrij on page 1', () => {
  const offers = [
    makeOffer({ id: 'prijsvrij-0', provider: PRIJSVRIJ_PROVIDER_NAME }),
    makeOffer({ id: 'prijsvrij-1', provider: PRIJSVRIJ_PROVIDER_NAME }),
    makeOffer({ id: 'prijsvrij-2', provider: PRIJSVRIJ_PROVIDER_NAME }),
    ...Array.from({ length: 12 }, (_, i) =>
      makeOffer({ id: `corendon-${i}`, provider: 'Corendon' }),
    ),
  ];
  const { page1 } = splitPage1AndRemaining(offers);
  assert.equal(page1.filter((o) => o.provider === PRIJSVRIJ_PROVIDER_NAME).length, 3);
});

test('>3 Prijsvrij: max 3 on page 1; skipped PV stays for page 2+', () => {
  const offers = [
    makeOffer({ id: 'prijsvrij-1', provider: PRIJSVRIJ_PROVIDER_NAME }),
    makeOffer({ id: 'prijsvrij-2', provider: PRIJSVRIJ_PROVIDER_NAME }),
    makeOffer({ id: 'prijsvrij-3', provider: PRIJSVRIJ_PROVIDER_NAME }),
    makeOffer({ id: 'prijsvrij-4', provider: PRIJSVRIJ_PROVIDER_NAME }),
    makeOffer({ id: 'corendon-1', provider: 'Corendon' }),
    makeOffer({ id: 'sunweb-1', provider: 'Sunweb' }),
    makeOffer({ id: 'eliza-1', provider: 'Eliza was here' }),
    makeOffer({ id: 'corendon-2', provider: 'Corendon' }),
    makeOffer({ id: 'sunweb-2', provider: 'Sunweb' }),
    makeOffer({ id: 'eliza-2', provider: 'Eliza was here' }),
    makeOffer({ id: 'corendon-3', provider: 'Corendon' }),
    makeOffer({ id: 'prijsvrij-5', provider: PRIJSVRIJ_PROVIDER_NAME }),
    makeOffer({ id: 'corendon-4', provider: 'Corendon' }),
  ];

  const { page1, remaining } = splitPage1AndRemaining(offers);
  assert.equal(page1.length, 10);
  assert.equal(page1.filter((o) => o.provider === PRIJSVRIJ_PROVIDER_NAME).length, 3);
  assert.ok(ids(page1).includes('prijsvrij-1'));
  assert.ok(ids(page1).includes('prijsvrij-2'));
  assert.ok(ids(page1).includes('prijsvrij-3'));
  assert.ok(!ids(page1).includes('prijsvrij-4'));
  assert.ok(ids(remaining).includes('prijsvrij-4'));
  assert.ok(ids(remaining).includes('prijsvrij-5'));

  const page2 = getResultsPageOffers(offers, 2);
  assert.ok(ids(page2).includes('prijsvrij-4'));
  assertPartitionIntegrity(offers, page1, remaining);
});

test('geen duplicaten tussen page 1 en page 2', () => {
  const offers = [
    ...Array.from({ length: 6 }, (_, i) =>
      makeOffer({ id: `prijsvrij-${i}`, provider: PRIJSVRIJ_PROVIDER_NAME }),
    ),
    ...Array.from({ length: 20 }, (_, i) =>
      makeOffer({ id: `corendon-${i}`, provider: 'Corendon' }),
    ),
  ];
  const page1 = getResultsPageOffers(offers, 1);
  const page2 = getResultsPageOffers(offers, 2);
  const overlap = ids(page1).filter((id) => ids(page2).includes(id));
  assert.deepEqual(overlap, []);
});

test('geen kandidaten verdwijnen; ORIGINAL = PAGE1 + REMAINING', () => {
  const offers = [
    makeOffer({ id: 'prijsvrij-1', provider: PRIJSVRIJ_PROVIDER_NAME }),
    makeOffer({ id: 'prijsvrij-2', provider: PRIJSVRIJ_PROVIDER_NAME }),
    makeOffer({ id: 'prijsvrij-3', provider: PRIJSVRIJ_PROVIDER_NAME }),
    makeOffer({ id: 'prijsvrij-4', provider: PRIJSVRIJ_PROVIDER_NAME }),
    makeOffer({ id: 'c1', provider: 'Corendon' }),
    makeOffer({ id: 's1', provider: 'Sunweb' }),
    makeOffer({ id: 'e1', provider: 'Eliza was here' }),
    makeOffer({ id: 'c2', provider: 'Corendon' }),
    makeOffer({ id: 's2', provider: 'Sunweb' }),
    makeOffer({ id: 'e2', provider: 'Eliza was here' }),
    makeOffer({ id: 'pv5', provider: PRIJSVRIJ_PROVIDER_NAME }),
    makeOffer({ id: 'c3', provider: 'Corendon' }),
  ];
  const { page1, remaining } = splitPage1AndRemaining(offers);
  assertPartitionIntegrity(offers, page1, remaining);
  assert.equal(page1.length + remaining.length, offers.length);
});

test('oorspronkelijke rankingvolgorde van remaining behouden', () => {
  const offers = [
    makeOffer({ id: 'prijsvrij-1', provider: PRIJSVRIJ_PROVIDER_NAME }),
    makeOffer({ id: 'prijsvrij-2', provider: PRIJSVRIJ_PROVIDER_NAME }),
    makeOffer({ id: 'prijsvrij-3', provider: PRIJSVRIJ_PROVIDER_NAME }),
    makeOffer({ id: 'prijsvrij-4', provider: PRIJSVRIJ_PROVIDER_NAME }),
    makeOffer({ id: 'c1', provider: 'Corendon' }),
    makeOffer({ id: 's1', provider: 'Sunweb' }),
    makeOffer({ id: 'e1', provider: 'Eliza was here' }),
    makeOffer({ id: 'c2', provider: 'Corendon' }),
    makeOffer({ id: 's2', provider: 'Sunweb' }),
    makeOffer({ id: 'e2', provider: 'Eliza was here' }),
    makeOffer({ id: 'c3', provider: 'Corendon' }),
    makeOffer({ id: 'prijsvrij-5', provider: PRIJSVRIJ_PROVIDER_NAME }),
    makeOffer({ id: 'c4', provider: 'Corendon' }),
  ];
  const { page1, remaining } = splitPage1AndRemaining(offers);
  // PV4 skipped on page 1 → first in remaining among leftovers in original order
  assert.equal(remaining[0].id, 'prijsvrij-4');
  assert.deepEqual(
    ids(remaining),
    ids(offers.filter((o) => !ids(page1).includes(o.id))),
  );
});

test('page 3 werkt correct uit remaining', () => {
  const offers = Array.from({ length: 35 }, (_, i) => {
    if (i < 5) {
      return makeOffer({ id: `prijsvrij-${i}`, provider: PRIJSVRIJ_PROVIDER_NAME });
    }
    return makeOffer({ id: `corendon-${i}`, provider: 'Corendon' });
  });
  const { page1, remaining } = splitPage1AndRemaining(offers);
  const page3 = getResultsPageOffers(offers, 3);
  assert.deepEqual(ids(page3), ids(remaining.slice(10, 20)));
  assert.equal(page3.length, 10);
  const allPageIds = [...ids(page1), ...ids(getResultsPageOffers(offers, 2)), ...ids(page3)];
  assert.equal(new Set(allPageIds).size, allPageIds.length);
});

test('page 4+ werkt volgens dezelfde remaining resultset', () => {
  const offers = Array.from({ length: 45 }, (_, i) =>
    makeOffer({
      id: i % 4 === 0 ? `prijsvrij-${i}` : `corendon-${i}`,
      provider: i % 4 === 0 ? PRIJSVRIJ_PROVIDER_NAME : 'Corendon',
    }),
  );
  const { remaining } = splitPage1AndRemaining(offers);
  const page4 = getResultsPageOffers(offers, 4);
  assert.deepEqual(ids(page4), ids(remaining.slice(20, 30)));
});

test('onvoldoende niet-Prijsvrij-aanbod → extra Prijsvrij op page 1', () => {
  const offers = [
    makeOffer({ id: 'c1', provider: 'Corendon' }),
    ...Array.from({ length: 15 }, (_, i) =>
      makeOffer({ id: `prijsvrij-${i}`, provider: PRIJSVRIJ_PROVIDER_NAME }),
    ),
  ];
  const { page1, remaining } = splitPage1AndRemaining(offers);
  assert.equal(page1.length, 10);
  assert.equal(page1.filter((o) => o.provider === 'Corendon').length, 1);
  assert.ok(page1.filter((o) => o.provider === PRIJSVRIJ_PROVIDER_NAME).length > 3);
  assertPartitionIntegrity(offers, page1, remaining);
});

test('minder dan 10 totale resultaten', () => {
  const offers = [
    makeOffer({ id: 'prijsvrij-1', provider: PRIJSVRIJ_PROVIDER_NAME }),
    makeOffer({ id: 'corendon-1', provider: 'Corendon' }),
    makeOffer({ id: 'sunweb-1', provider: 'Sunweb' }),
  ];
  const { page1, remaining } = splitPage1AndRemaining(offers);
  assert.equal(page1.length, 3);
  assert.equal(remaining.length, 0);
  assert.deepEqual(ids(getResultsPageOffers(offers, 2)), []);
  assertPartitionIntegrity(offers, page1, remaining);
});

test('page 2+ past geen max-3-Prijsvrij-regel toe', () => {
  const offers = [
    ...Array.from({ length: 3 }, (_, i) =>
      makeOffer({ id: `prijsvrij-top-${i}`, provider: PRIJSVRIJ_PROVIDER_NAME }),
    ),
    ...Array.from({ length: 7 }, (_, i) =>
      makeOffer({ id: `corendon-${i}`, provider: 'Corendon' }),
    ),
    ...Array.from({ length: 8 }, (_, i) =>
      makeOffer({ id: `prijsvrij-late-${i}`, provider: PRIJSVRIJ_PROVIDER_NAME }),
    ),
  ];
  const page2 = getResultsPageOffers(offers, 2);
  assert.equal(page2.filter((o) => o.provider === PRIJSVRIJ_PROVIDER_NAME).length, 8);
});

test('selectPage1Candidates and splitPage1AndRemaining agree on selected set', () => {
  const offers = [
    ...Array.from({ length: 6 }, (_, i) =>
      makeOffer({ id: `prijsvrij-${i}`, provider: PRIJSVRIJ_PROVIDER_NAME }),
    ),
    ...Array.from({ length: 10 }, (_, i) =>
      makeOffer({ id: `corendon-${i}`, provider: 'Corendon' }),
    ),
  ];
  const selected = selectPage1Candidates(offers).selected;
  const { page1 } = splitPage1AndRemaining(offers);
  assert.deepEqual(ids(page1), ids(selected));
});
