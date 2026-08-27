import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  FAVORITES_STORAGE_KEY,
  favoriteEntryFromOffer,
  isFavoriteId,
  normalizeFavorites,
  readFavorites,
  removeFavorite,
  toggleFavorite,
  upsertFavorite,
  writeFavorites,
  type FavoriteEntry,
} from '@/lib/favorites/favorites-storage';

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
}

function entry(id: string, overrides: Partial<FavoriteEntry> = {}): FavoriteEntry {
  return {
    id,
    hotelName: `Hotel ${id}`,
    imageUrl: `https://example.com/${id}.jpg`,
    provider: 'Corendon',
    price: 500,
    savedAt: 1_000,
    ...overrides,
  };
}

test('toggleFavorite adds then removes without duplicates', () => {
  const storage = memoryStorage();
  const first = toggleFavorite(entry('a', { savedAt: 10 }), storage);
  assert.equal(first.added, true);
  assert.equal(first.favorites.length, 1);

  const again = toggleFavorite(entry('a', { savedAt: 20 }), storage);
  assert.equal(again.added, false);
  assert.equal(again.favorites.length, 0);

  upsertFavorite(entry('a'), storage);
  upsertFavorite(entry('a', { hotelName: 'Updated', savedAt: 99 }), storage);
  const list = readFavorites(storage);
  assert.equal(list.length, 1);
  assert.equal(list[0].hotelName, 'Updated');
});

test('normalizeFavorites deduplicates by id keeping newest savedAt', () => {
  const normalized = normalizeFavorites([
    entry('a', { savedAt: 1, hotelName: 'Old' }),
    entry('b', { savedAt: 2 }),
    entry('a', { savedAt: 5, hotelName: 'New' }),
  ]);
  assert.equal(normalized.length, 2);
  assert.equal(normalized[0].id, 'a');
  assert.equal(normalized[0].hotelName, 'New');
  assert.equal(normalized[1].id, 'b');
});

test('favorites persist through write/read round-trip', () => {
  const storage = memoryStorage();
  writeFavorites([entry('x'), entry('y')], storage);
  assert.equal(isFavoriteId('x', storage), true);
  assert.equal(isFavoriteId('missing', storage), false);
  removeFavorite('x', storage);
  assert.deepEqual(
    readFavorites(storage).map((item) => item.id),
    ['y'],
  );
  assert.ok(storage.getItem(FAVORITES_STORAGE_KEY));
});

test('favoriteEntryFromOffer uses stable offer id', () => {
  const built = favoriteEntryFromOffer({
    id: 'corendon-123',
    hotelName: 'Reymar Hotel',
    imageUrl: 'https://example.com/r.jpg',
    provider: 'Corendon',
    price: 542,
    destinationCountry: 'Spanje',
  });
  assert.equal(built.id, 'corendon-123');
  assert.equal(built.hotelName, 'Reymar Hotel');
  assert.equal(built.provider, 'Corendon');
});
