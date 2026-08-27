export const FAVORITES_STORAGE_KEY = 'vacationweb.favorites.v1';

export type FavoriteEntry = {
  id: string;
  hotelName: string;
  imageUrl: string;
  provider: string;
  price?: number;
  destinationCountry?: string;
  destinationRegion?: string;
  destinationCity?: string;
  savedAt: number;
};

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function memoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

let fallbackStorage: StorageLike | null = null;

function resolveStorage(storage?: StorageLike): StorageLike {
  if (storage) {
    return storage;
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  if (!fallbackStorage) {
    fallbackStorage = memoryStorage();
  }
  return fallbackStorage;
}

function isFavoriteEntry(value: unknown): value is FavoriteEntry {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const entry = value as FavoriteEntry;
  return (
    typeof entry.id === 'string' &&
    entry.id.trim() !== '' &&
    typeof entry.hotelName === 'string' &&
    typeof entry.imageUrl === 'string' &&
    typeof entry.provider === 'string' &&
    typeof entry.savedAt === 'number'
  );
}

/** Deduplicate by id, keeping the newest savedAt. */
export function normalizeFavorites(entries: readonly FavoriteEntry[]): FavoriteEntry[] {
  const byId = new Map<string, FavoriteEntry>();
  for (const entry of entries) {
    if (!isFavoriteEntry(entry)) {
      continue;
    }
    const id = entry.id.trim();
    const existing = byId.get(id);
    if (!existing || entry.savedAt >= existing.savedAt) {
      byId.set(id, { ...entry, id });
    }
  }
  return [...byId.values()].sort((a, b) => b.savedAt - a.savedAt);
}

export function readFavorites(storage?: StorageLike): FavoriteEntry[] {
  const raw = resolveStorage(storage).getItem(FAVORITES_STORAGE_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return normalizeFavorites(parsed.filter(isFavoriteEntry));
  } catch {
    return [];
  }
}

export function writeFavorites(entries: readonly FavoriteEntry[], storage?: StorageLike): FavoriteEntry[] {
  const normalized = normalizeFavorites(entries);
  resolveStorage(storage).setItem(FAVORITES_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function isFavoriteId(id: string, storage?: StorageLike): boolean {
  const needle = id.trim();
  if (!needle) {
    return false;
  }
  return readFavorites(storage).some((entry) => entry.id === needle);
}

export function upsertFavorite(entry: FavoriteEntry, storage?: StorageLike): FavoriteEntry[] {
  const current = readFavorites(storage).filter((item) => item.id !== entry.id.trim());
  return writeFavorites([{ ...entry, id: entry.id.trim(), savedAt: entry.savedAt || Date.now() }, ...current], storage);
}

export function removeFavorite(id: string, storage?: StorageLike): FavoriteEntry[] {
  const needle = id.trim();
  return writeFavorites(
    readFavorites(storage).filter((entry) => entry.id !== needle),
    storage,
  );
}

export function toggleFavorite(
  entry: FavoriteEntry,
  storage?: StorageLike,
): { favorites: FavoriteEntry[]; added: boolean } {
  if (isFavoriteId(entry.id, storage)) {
    return { favorites: removeFavorite(entry.id, storage), added: false };
  }
  return { favorites: upsertFavorite(entry, storage), added: true };
}

export function favoriteEntryFromOffer(offer: {
  id: string;
  hotelName: string;
  imageUrl?: string;
  provider: string;
  price?: number;
  destinationCountry?: string;
  destinationRegion?: string;
  destinationCity?: string;
}): FavoriteEntry {
  return {
    id: offer.id,
    hotelName: offer.hotelName,
    imageUrl: offer.imageUrl || '',
    provider: offer.provider,
    price: typeof offer.price === 'number' && offer.price > 0 ? offer.price : undefined,
    destinationCountry: offer.destinationCountry,
    destinationRegion: offer.destinationRegion,
    destinationCity: offer.destinationCity,
    savedAt: Date.now(),
  };
}
