import Image from 'next/image';
import type { PromotionCard } from '@/lib/tradetracker/promotions/present-promotions';

const SERIF = { fontFamily: 'var(--font-vw-serif), Georgia, serif' } as const;

function ExternalIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden className="shrink-0">
      <path
        d="M6 3.5H3.5v9h9V10M9.5 3h3.5v3.5M13 3 7.5 8.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * One promotion, text-first. TradeTracker supplies no promotion-specific imagery (banners
 * carry no machine-readable link to a news item), so the card relies on typography,
 * hierarchy and whitespace. The only image is the provider's own official campaign
 * logo, shown as a provider mark - never as a picture of the action.
 * Shows only what the source states; empty fields are omitted, never replaced
 * by placeholders.
 */
export function PromotionCardView({ card, lead }: { card: PromotionCard; lead: boolean }) {
  const titleId = `${card.id}-title`;
  const hasMultipleLinks = card.links.length > 1;
  const metaRows: { label: string; value: string }[] = [];
  if (card.period) {
    metaRows.push({ label: card.periodLabel ?? 'Periode', value: card.period });
  }
  if (card.validToLabel) {
    metaRows.push({ label: 'Geldig t/m', value: card.validToLabel });
  }
  if (card.voucherCode) {
    metaRows.push({ label: 'Code', value: card.voucherCode });
  }
  if (card.conditions) {
    metaRows.push({ label: 'Voorwaarden', value: card.conditions });
  }
  if (card.publishedLabel) {
    metaRows.push({ label: 'Gepubliceerd', value: card.publishedLabel });
  }

  return (
    <article
      aria-labelledby={titleId}
      className={`flex h-full flex-col rounded-2xl border border-[#E8E4DC] bg-white p-6 sm:p-8 ${
        lead ? 'lg:p-10' : ''
      }`}
    >
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {card.providerLogo ? (
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#E8E4DC] bg-white">
              <Image
                src={card.providerLogo}
                alt=""
                width={44}
                height={44}
                className="h-full w-full object-contain p-1"
              />
            </span>
          ) : (
            <span
              aria-hidden
              style={SERIF}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F3EFE7] text-[18px] font-semibold text-[#0A2D62]"
            >
              {card.providerName.charAt(0).toLocaleUpperCase('nl')}
            </span>
          )}
          <p className="min-w-0 break-words text-[14px] font-semibold text-[#0A2D62]">
            {card.providerName}
          </p>
        </div>
        {card.kindLabel !== 'Actie' ? (
          <span className="shrink-0 rounded-full border border-[#D6D0C4] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#475569]">
            {card.kindLabel}
          </span>
        ) : null}
      </header>

      <h3
        id={titleId}
        style={SERIF}
        className={`mt-6 break-words font-semibold tracking-tight text-[#0A2D62] ${
          lead ? 'text-[26px] leading-[1.2] sm:text-[30px] lg:text-[34px]' : 'text-[22px] leading-[1.25]'
        }`}
      >
        {card.title}
      </h3>

      {card.highlight ? (
        <div className="mt-5 border-l-2 border-[#89ACD3] pl-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#475569]">Actie</p>
          <p
            className={`mt-1 break-words leading-relaxed text-[#1E293B] ${
              lead ? 'text-[17px] lg:text-[18px]' : 'text-[16px]'
            }`}
          >
            {card.highlight}
          </p>
        </div>
      ) : card.description ? (
        <p className="mt-4 break-words text-[15px] leading-relaxed text-[#334155]">
          {card.description}
        </p>
      ) : null}

      {metaRows.length > 0 ? (
        <dl className="mt-5 space-y-1.5 text-[14px] leading-snug">
          {metaRows.map((row) => (
            <div key={row.label} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
              <dt className="shrink-0 font-medium text-[#475569] sm:w-[7.5rem]">{row.label}</dt>
              <dd className="min-w-0 break-words text-[#1E293B]">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <div className="mt-auto pt-7">
        <p className="text-[13px] leading-snug text-[#475569]">
          Deze actie wordt aangeboden door {card.providerName}.
        </p>
        {card.links.length > 0 ? (
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            {card.links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-full bg-[#0A2D62] px-6 py-2.5 text-[15px] font-semibold text-white transition hover:bg-[#082452] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A2D62] sm:w-auto"
              >
                <span>
                  {card.ctaLabel}
                  {hasMultipleLinks && link.domain ? ` op ${link.domain}` : ''}
                </span>
                <ExternalIcon />
                <span className="sr-only"> (opent in een nieuw tabblad)</span>
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}
