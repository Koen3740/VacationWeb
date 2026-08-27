'use client';

import {
  favoriteEntryFromOffer,
  readFavorites,
  toggleFavorite,
  type FavoriteEntry,
} from '@/lib/favorites/favorites-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from 'react';

type FavoritesContextValue = {
  favorites: FavoriteEntry[];
  isFavorite: (id: string) => boolean;
  toggle: (offer: Parameters<typeof favoriteEntryFromOffer>[0]) => void;
  count: number;
};

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

const listeners = new Set<() => void>();

function emitFavoritesChange() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribeFavorites(listener: () => void) {
  listeners.add(listener);
  if (typeof window !== 'undefined') {
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === 'vacationweb.favorites.v1') {
        listener();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener('storage', onStorage);
    };
  }
  return () => {
    listeners.delete(listener);
  };
}

function getFavoritesSnapshot(): FavoriteEntry[] {
  return readFavorites();
}

function getServerFavoritesSnapshot(): FavoriteEntry[] {
  return [];
}

export function useFavoritesStore(): FavoritesContextValue {
  const favorites = useSyncExternalStore(
    subscribeFavorites,
    getFavoritesSnapshot,
    getServerFavoritesSnapshot,
  );

  const isFavorite = useCallback(
    (id: string) => favorites.some((entry) => entry.id === id.trim()),
    [favorites],
  );

  const toggle = useCallback((offer: Parameters<typeof favoriteEntryFromOffer>[0]) => {
    toggleFavorite(favoriteEntryFromOffer(offer));
    emitFavoritesChange();
  }, []);

  return useMemo(
    () => ({
      favorites,
      isFavorite,
      toggle,
      count: favorites.length,
    }),
    [favorites, isFavorite, toggle],
  );
}

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const value = useFavoritesStore();
  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

/** Prefers provider context when present; otherwise uses the shared store. */
export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  const store = useFavoritesStore();
  return ctx ?? store;
}
