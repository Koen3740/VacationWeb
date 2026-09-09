import type { DisplayablePromotion } from '@/lib/tradetracker/promotions/select-displayable';

function kindLabel(kind: DisplayablePromotion['kind']): string {
  switch (kind) {
    case 'voucher':
      return 'Voucher';
    case 'incentive_offer':
      return 'Incentive';
    case 'vouchercode_update':
      return 'Vouchercode';
    case 'incentive_update':
      return 'Incentive-update';
    case 'consumer_promotion':
    default:
      return 'Consumentenpromotie';
  }
}

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
    <ul className="space-y-4">
      {promotions.map((promotion) => {
        const validity = formatDateRange(promotion.publishDate, promotion.expirationDate);
        return (
          <li
            key={promotion.id}
            className="rounded-xl border border-[#E8ECF2] bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
          >
            <div className="flex flex-wrap items-center gap-2 text-[12px] font-medium uppercase tracking-wide text-[#64748B]">
              <span>{kindLabel(promotion.kind)}</span>
              {promotion.campaignName ? (
                <>
                  <span aria-hidden>·</span>
                  <span className="normal-case tracking-normal text-[#0A2D62]">
                    {promotion.campaignName}
                  </span>
                </>
              ) : null}
            </div>
            <h3 className="mt-2 text-[18px] font-semibold tracking-tight text-[#0A2D62]">
              {promotion.title}
            </h3>
            {promotion.content ? (
              <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-[#334155]">
                {promotion.content}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-[#64748B]">
              {validity ? <span>Geldig: {validity}</span> : null}
              {promotion.campaignUrl ? (
                <a
                  href={promotion.campaignUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-[#0A2D62] hover:underline"
                >
                  Naar campagne
                </a>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
