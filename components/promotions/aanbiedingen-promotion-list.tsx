import type { AanbiedingenCard } from '@/lib/tradetracker/promotions/compose-aanbiedingen';
import { isOwnCreativeImageUrl } from '@/lib/tradetracker/promotions/creative-image-path';
import React from 'react';

function formatDateRange(start: string | null, end: string | null): string | null {
  if (!start && !end) {
    return null;
  }
  if (start && end) {
    return `${start} t/m ${end}`;
  }
  if (start) {
    return `vanaf ${start}`;
  }
  return `tot ${end}`;
}

export function AanbiedingenPromotionList({
  cards,
  emptyMessage,
}: {
  cards: AanbiedingenCard[];
  emptyMessage: string;
}) {
  if (cards.length === 0) {
    return <p className="text-[14px] text-[#64748B]">{emptyMessage}</p>;
  }

  return (
    <ul className="space-y-3">
      {cards.map((card) => {
        const validity = formatDateRange(card.publishDate, card.expirationDate);
        const marketLabel = card.market === 'be' ? 'België' : 'Nederland';
        const imageSrc = isOwnCreativeImageUrl(card.imageUrl) ? card.imageUrl : null;
        return (
          <li
            key={card.id}
            className="rounded-xl border border-[#E8ECF2] bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
          >
            <p className="text-[12px] font-semibold uppercase tracking-wide text-[#64748B]">
              {card.providerName}
            </p>
            <h3 className="mt-1 text-[17px] font-semibold tracking-tight text-[#0A2D62]">{card.title}</h3>
            {imageSrc ? (
              <img
                src={imageSrc}
                alt={card.title}
                width={card.imageWidth ?? undefined}
                height={card.imageHeight ?? undefined}
                className="mt-3 h-auto max-w-full rounded-lg border border-[#E8ECF2]"
              />
            ) : null}
            {card.benefitText ? (
              <p className="mt-2 text-[14px] leading-relaxed text-[#334155]">Voordeel: {card.benefitText}</p>
            ) : null}
            {card.summary ? (
              <p className="mt-2 text-[14px] leading-relaxed text-[#334155]">{card.summary}</p>
            ) : null}
            {card.conditions ? (
              <p className="mt-2 text-[14px] leading-relaxed text-[#334155]">{card.conditions}</p>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-[#64748B]">
              {card.campaignName ? <span>Campagne {card.campaignName}</span> : null}
              <span>Markt {marketLabel}</span>
              {card.dimensionsLabel ? <span>{card.dimensionsLabel}</span> : null}
              {card.materialItemId ? <span>Materiaal {card.materialItemId}</span> : null}
              {validity ? <span>Geldig: {validity}</span> : null}
              {card.discountText && card.discountText !== card.benefitText ? (
                <span>Korting: {card.discountText}</span>
              ) : null}
              {card.campaignUrl ? (
                <a
                  href={card.campaignUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-[#0A2D62] hover:underline"
                >
                  Bekijk bij {card.providerName}
                </a>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
