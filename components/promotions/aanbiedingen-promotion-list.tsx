import type { DisplayablePromotion } from '@/lib/tradetracker/promotions/select-displayable';

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
  promotions,
  emptyMessage,
}: {
  promotions: DisplayablePromotion[];
  emptyMessage: string;
}) {
  if (promotions.length === 0) {
    return <p className="text-[14px] text-[#64748B]">{emptyMessage}</p>;
  }

  return (
    <ul className="space-y-3">
      {promotions.map((promotion) => {
        const validity = formatDateRange(promotion.publishDate, promotion.expirationDate);
        return (
          <li
            key={promotion.id}
            className="rounded-xl border border-[#E8ECF2] bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
          >
            <p className="text-[12px] font-semibold uppercase tracking-wide text-[#64748B]">
              {promotion.providerName}
            </p>
            <h3 className="mt-1 text-[17px] font-semibold tracking-tight text-[#0A2D62]">
              {promotion.title}
            </h3>
            {promotion.summary ? (
              <p className="mt-2 text-[14px] leading-relaxed text-[#334155]">{promotion.summary}</p>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
              {validity ? <span className="text-[#64748B]">Geldig: {validity}</span> : null}
              {promotion.campaignUrl ? (
                <a
                  href={promotion.campaignUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-[#0A2D62] hover:underline"
                >
                  Bekijk bij {promotion.providerName}
                </a>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
