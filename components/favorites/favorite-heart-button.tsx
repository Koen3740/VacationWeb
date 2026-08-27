'use client';

import { useFavorites } from '@/components/favorites/favorites-provider';
import React from 'react';

export function FavoriteHeartButton({
  offer,
}: {
  offer: {
    id: string;
    hotelName: string;
    imageUrl?: string;
    provider: string;
    price?: number;
    destinationCountry?: string;
    destinationRegion?: string;
    destinationCity?: string;
  };
}) {
  const { isFavorite, toggle } = useFavorites();
  const active = isFavorite(offer.id);

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        toggle(offer);
      }}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur-sm transition hover:bg-white ${
        active ? 'text-[#C45B5B]' : 'text-[#64748B] hover:text-[#0A2D62]'
      }`}
      aria-label={active ? 'Verwijder uit favorieten' : 'Toevoegen aan favorieten'}
      aria-pressed={active}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} aria-hidden>
        <path
          d="M12 20.5 5.5 13.8a4.7 4.7 0 0 1 0-6.6 4.5 4.5 0 0 1 6.4 0L12 7.1l.1-.1a4.5 4.5 0 0 1 6.4 0 4.7 4.7 0 0 1 0 6.6L12 20.5Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
