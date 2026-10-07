'use client';

import { PromotionCardView } from '@/components/promotions/promotion-card';
import type {
  ProviderFilterOption,
  PromotionCard,
} from '@/lib/tradetracker/promotions/present-promotions';
import { useState } from 'react';

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden className="shrink-0">
      <path
        d="m3.5 8.5 3 3 6-7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const chipBase =
  'inline-flex min-h-[44px] items-center gap-2 rounded-full border px-4 py-2 text-[14px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A2D62]';
const chipActive = 'border-[#0A2D62] bg-[#0A2D62] text-white';
const chipIdle = 'border-[#D6D0C4] bg-white text-[#0A2D62] hover:border-[#0A2D62]';

/**
 * Provider filter + card grid. Data is rendered once on the server; the filter
 * only narrows the already-delivered list (no refetch, no navigation).
 * The filter is shown only when at least two providers have promotions.
 */
export function AanbiedingenPromotionList({
  cards,
  providers,
}: {
  cards: PromotionCard[];
  providers: ProviderFilterOption[];
}) {
  const [active, setActive] = useState<string | null>(null);
  const showFilter = providers.length > 1;
  const visible = active ? cards.filter((card) => card.providerName === active) : cards;
  // Wide lead card only when the grid is full enough to stay balanced (>= 4 cards).
  const leadFirst = visible.length >= 4;
  const gridCols = visible.length >= 3 ? 'md:grid-cols-2 xl:grid-cols-3' : 'md:grid-cols-2';

  return (
    <div>
      {showFilter ? (
        <div role="group" aria-label="Filter op aanbieder" className="mb-8 flex flex-wrap gap-2.5">
          <button
            type="button"
            aria-pressed={active === null}
            onClick={() => setActive(null)}
            className={`${chipBase} ${active === null ? chipActive : chipIdle}`}
          >
            {active === null ? <CheckIcon /> : null}
            Alle
            <span className="font-normal opacity-80">{cards.length}</span>
          </button>
          {providers.map((provider) => {
            const pressed = active === provider.name;
            return (
              <button
                key={provider.name}
                type="button"
                aria-pressed={pressed}
                onClick={() => setActive(pressed ? null : provider.name)}
                className={`${chipBase} ${pressed ? chipActive : chipIdle}`}
              >
                {pressed ? <CheckIcon /> : null}
                {provider.name}
                <span className="font-normal opacity-80">{provider.count}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      <p className="sr-only" role="status" aria-live="polite">
        {visible.length === 1 ? '1 aanbieding' : `${visible.length} aanbiedingen`}
        {active ? ` van ${active}` : ''}
      </p>

      <ul className={`grid grid-cols-1 gap-6 ${gridCols} xl:gap-7`}>
        {visible.map((card, index) => {
          const lead = leadFirst && index === 0;
          return (
            <li key={card.id} className={lead ? 'md:col-span-2 xl:col-span-2' : ''}>
              <PromotionCardView card={card} lead={lead} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
