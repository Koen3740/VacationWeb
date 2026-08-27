'use client';

import { useFavorites } from '@/components/favorites/favorites-provider';
import Link from 'next/link';
import React from 'react';

function HeartIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      aria-hidden
      className="shrink-0"
    >
      <path
        d="M12 20.5 5.5 13.8a4.7 4.7 0 0 1 0-6.6 4.5 4.5 0 0 1 6.4 0L12 7.1l.1-.1a4.5 4.5 0 0 1 6.4 0 4.7 4.7 0 0 1 0 6.6L12 20.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FavoritesNavLink({
  className = 'inline-flex items-center gap-1.5 text-[14px] font-medium text-[#334155] transition hover:text-[#0A2D62]',
}: {
  className?: string;
}) {
  const { count } = useFavorites();
  return (
    <Link href="/favorieten" className={className} aria-label={`Favorieten${count > 0 ? ` (${count})` : ''}`}>
      <HeartIcon filled={count > 0} />
      Favorieten
      {count > 0 ? <span className="tabular-nums text-[#64748B]">({count})</span> : null}
    </Link>
  );
}
