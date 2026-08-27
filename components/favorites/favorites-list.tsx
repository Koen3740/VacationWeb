'use client';

import { useFavorites } from '@/components/favorites/favorites-provider';
import { RESULTS_CTA, RESULTS_MUTED, RESULTS_NAVY } from '@/components/results-v2/results-design-tokens';
import Link from 'next/link';
import Image from 'next/image';
import React from 'react';

function formatPrice(value: number): string {
  return new Intl.NumberFormat('nl-NL', {
    style: 'decimal',
    maximumFractionDigits: 0,
  }).format(value);
}

export function FavoritesList() {
  const { favorites, toggle } = useFavorites();

  if (favorites.length === 0) {
    return (
      <div className="rounded-[16px] border border-[#E8ECF2] bg-white px-6 py-10 text-center">
        <p className="text-[16px] font-semibold text-[#0A2D62]">Nog geen favorieten</p>
        <p className="mt-2 text-[14px] text-[#64748B]">
          Bewaar vakanties via het hartje op een resultaatkaart.
        </p>
        <Link
          href="/results"
          className="mt-5 inline-flex h-10 items-center justify-center rounded-[11px] px-5 text-[13px] font-semibold text-white"
          style={{ backgroundColor: RESULTS_CTA }}
        >
          Bekijk vakanties
        </Link>
      </div>
    );
  }

  return (
    <ul className="space-y-3.5">
      {favorites.map((entry) => {
        const location = [entry.destinationCountry, entry.destinationRegion, entry.destinationCity]
          .filter(Boolean)
          .join(' · ');
        return (
          <li
            key={entry.id}
            className="flex flex-col gap-4 overflow-hidden rounded-[16px] border border-[#E8ECF2] bg-white p-4 sm:flex-row sm:items-center"
          >
            <div className="relative h-[120px] w-full shrink-0 overflow-hidden rounded-[12px] bg-[#F3F0EA] sm:h-[96px] sm:w-[144px]">
              {entry.imageUrl ? (
                <Image
                  src={entry.imageUrl}
                  alt={entry.hotelName}
                  fill
                  className="object-cover"
                  sizes="144px"
                />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-[17px] font-bold text-[#0A2D62]">{entry.hotelName}</h2>
              {location ? <p className="mt-0.5 text-[13px] text-[#64748B]">{location}</p> : null}
              <p className="mt-1 text-[12px]" style={{ color: RESULTS_MUTED }}>
                Aangeboden door {entry.provider}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
              {entry.price != null ? (
                <p className="text-[22px] font-bold leading-none" style={{ color: RESULTS_NAVY }}>
                  € {formatPrice(entry.price)}
                </p>
              ) : null}
              <div className="flex gap-2">
                <Link
                  href={`/offers/${encodeURIComponent(entry.id)}`}
                  className="inline-flex h-10 items-center justify-center rounded-[11px] px-4 text-[13px] font-semibold text-white"
                  style={{ backgroundColor: RESULTS_CTA }}
                >
                  Bekijk aanbieding
                </Link>
                <button
                  type="button"
                  onClick={() => toggle(entry)}
                  className="inline-flex h-10 items-center justify-center rounded-[11px] border border-[#E8ECF2] px-4 text-[13px] font-medium text-[#64748B] transition hover:text-[#0A2D62]"
                >
                  Verwijderen
                </button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
