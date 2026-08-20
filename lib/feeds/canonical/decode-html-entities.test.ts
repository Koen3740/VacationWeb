import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeHtmlEntities } from './decode-html-entities';
import { normalizeOffer } from './normalize-offer';
import type { StoredOffer } from '../types/stored-offer';

function makeStored(overrides: Partial<StoredOffer> = {}): StoredOffer {
  return {
    externalId: 'sunweb-1',
    provider: 'Sunweb',
    hotelName: 'Test Hotel',
    country: 'Griekenland',
    nights: 8,
    price: 526,
    imageUrl: 'https://example.com/a.jpg',
    deepLink: 'https://www.sunweb.be/nl/vakantie',
    descriptionShort: 'Villa&#039;s description stays encoded here',
    ...overrides,
  };
}

test('decodeHtmlEntities: apostrophe numeric and named entities', () => {
  assert.equal(decodeHtmlEntities("Villa&#039;s"), "Villa's");
  assert.equal(decodeHtmlEntities("Cook&apos;s Club"), "Cook's Club");
  assert.equal(decodeHtmlEntities("D&#039;Andrea"), "D'Andrea");
  assert.equal(decodeHtmlEntities("D&#39;Andrea"), "D'Andrea");
});

test('decodeHtmlEntities: real ampersand and accents stay intact', () => {
  assert.equal(decodeHtmlEntities('Fly & Go Alaaddin Beach'), 'Fly & Go Alaaddin Beach');
  assert.equal(decodeHtmlEntities('Curaçao Resort'), 'Curaçao Resort');
  assert.equal(decodeHtmlEntities('AT&T Hotel'), 'AT&T Hotel');
});

test('decodeHtmlEntities: encoded ampersand becomes a real ampersand once', () => {
  assert.equal(decodeHtmlEntities('H&amp;M Hotel'), 'H&M Hotel');
  assert.equal(decodeHtmlEntities(decodeHtmlEntities("Villa&#039;s")), "Villa's");
});

test('normalizeOffer decodes hotelName and leaves descriptionShort unchanged', () => {
  const offer = normalizeOffer(
    makeStored({
      hotelName: "Appartementen Villa&#039;s Elpiniki",
      descriptionShort: "Villa&#039;s description stays encoded here",
    }),
  );
  assert.equal(offer.hotelName, "Appartementen Villa's Elpiniki");
  assert.equal(offer.descriptionShort, "Villa&#039;s description stays encoded here");
});

test('normalizeOffer does not damage already-decoded names', () => {
  const offer = normalizeOffer(
    makeStored({
      hotelName: "Appartementen Villa's Elpiniki",
    }),
  );
  assert.equal(offer.hotelName, "Appartementen Villa's Elpiniki");
});
