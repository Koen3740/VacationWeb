import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { mergeOfferDetail } from '@/lib/offers/compact-runtime';
import {
  loadOfferDetailMap,
  resetOfferDetailCacheForTests,
} from '@/lib/offers/load-offer-by-id';
import type { TravelOffer } from '@/types/travel';

function compactOffer(overrides: Partial<TravelOffer> = {}): TravelOffer {
  return {
    id: 'corendon-14034-EINBCN-280926-3-DZF',
    provider: 'Corendon',
    hotelName: 'Aparthotel Playas del Rey',
    destinationCountry: 'Spanje',
    nights: 4,
    price: 485,
    pricePerDay: 121,
    imageUrl: 'https://images.corendonresources.com/L1E14034A1W1600H1066.jpg',
    deepLink: 'https://www.corendon.nl/vakantie#14034',
    extraInfo: '2-persoonskamer',
    descriptionShort: 'Aparthotel in Blanes.',
    ...overrides,
  };
}

test('Vercel workers skip the remote sidecar instead of parsing the full map', async () => {
  const prevVercel = process.env.VERCEL;
  const prevFile = process.env.VACATIONWEB_OFFER_DETAILS_FILE;
  const missing = path.join(os.tmpdir(), `vw-missing-details-${process.pid}.json`);
  process.env.VERCEL = '1';
  process.env.VACATIONWEB_OFFER_DETAILS_FILE = missing;
  resetOfferDetailCacheForTests();

  try {
    assert.equal(fs.existsSync(missing), false);
    const started = Date.now();
    const map = await loadOfferDetailMap();
    assert.deepEqual(map, {});
    assert.ok(Date.now() - started < 2000);
    assert.equal(map['corendon-14034-EINBCN-280926-3-DZF'], undefined);
    assert.equal(map['eliza-6261655'], undefined);
    assert.equal(map['sunweb-6128017-2026-10-07-8-CRL-AllInclusive'], undefined);
  } finally {
    resetOfferDetailCacheForTests();
    if (prevVercel === undefined) {
      delete process.env.VERCEL;
    } else {
      process.env.VERCEL = prevVercel;
    }
    if (prevFile === undefined) {
      delete process.env.VACATIONWEB_OFFER_DETAILS_FILE;
    } else {
      process.env.VACATIONWEB_OFFER_DETAILS_FILE = prevFile;
    }
  }
});

test('compact Corendon/Eliza/Sunweb remain renderable when sidecar merge is a no-op', () => {
  for (const offer of [
    compactOffer(),
    compactOffer({
      id: 'eliza-6261655',
      provider: 'Eliza was here',
      imageUrl: 'https://static.elizawashere.be/products/Images/Original/x.jpg',
    }),
    compactOffer({
      id: 'sunweb-6128017-2026-10-07-8-CRL-AllInclusive',
      provider: 'Sunweb',
      imageUrl: 'https://static.sunweb.be/products/Images/Original/x.jpg',
    }),
  ]) {
    const merged = mergeOfferDetail(offer, undefined);
    assert.equal(merged.id, offer.id);
    assert.equal(merged.hotelName, offer.hotelName);
    assert.equal(merged.imageUrl, offer.imageUrl);
    assert.equal(merged.deepLink, offer.deepLink);
    assert.equal(merged.descriptionLong, undefined);
    assert.equal(merged.feedDescription, undefined);
  }
});
