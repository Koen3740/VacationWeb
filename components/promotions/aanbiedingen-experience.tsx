import type { EditorialOffer } from '@/lib/tradetracker/promotions/editorial-offers';
import type { VacationWebPromotionMarket } from '@/lib/tradetracker/promotions/select-displayable';
import React from 'react';

export type AanbiedingenExperienceSection = {
  market: VacationWebPromotionMarket;
  /** Markets of this section. Two markets means offers that BE and NL carry identically. */
  markets?: readonly VacationWebPromotionMarket[];
  key?: string;
  offers: EditorialOffer[];
  error: boolean;
};

const MARKET_LABEL: Record<VacationWebPromotionMarket, string> = {
  be: 'België',
  nl: 'Nederland',
};

const WIDE_CARD_CLASS =
  'grid w-full overflow-hidden rounded-[22px] bg-white shadow-[0_22px_50px_rgba(10,45,98,0.08)] ring-1 ring-[#E7DCC8] md:grid-cols-2';

function safeImageSrc(value: string): string | null {
  if (!value || value.includes('/i?') || value.includes('/c?') || value.includes('://') || value.includes('corendonresources.com')) {
    return null;
  }
  if (value.startsWith('/aanbiedingen/creative-images/') && !value.includes('/homepage/')) {
    return value;
  }
  return null;
}

function safeClickHref(value: string): string | null {
  if (!value || value.includes('/i?')) {
    return null;
  }
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname === 'ti.tradetracker.net') {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function amountClass(amount: string): string {
  const compact = amount.replace(/\s+/g, '');
  if (compact.length <= 5) {
    return 'text-[4.4rem] leading-[0.84] sm:text-[5.5rem]';
  }
  if (amount.length <= 18) {
    return 'text-[2.35rem] leading-[0.95] sm:text-[2.9rem]';
  }
  return 'text-[1.7rem] leading-tight sm:text-[2rem]';
}

function BenefitBadge({ offer }: { offer: EditorialOffer }) {
  const long = offer.benefitAmount.length > 8;
  return (
    <div
      className={
        long
          ? 'max-w-[13rem] rounded-2xl bg-[#E8C547] px-4 py-3 text-center text-[#0A2D62] shadow-[0_12px_30px_rgba(10,45,98,0.16)] ring-4 ring-white/80'
          : 'flex h-[7.25rem] w-[7.25rem] flex-col items-center justify-center rounded-full bg-[#E8C547] text-center text-[#0A2D62] shadow-[0_12px_30px_rgba(10,45,98,0.16)] ring-4 ring-white/80'
      }
    >
      {offer.benefitLead ? <span className="text-[10px] font-semibold uppercase tracking-[0.16em]">{offer.benefitLead}</span> : null}
      <span
        className={`mt-1 font-semibold tracking-[-0.04em] ${long ? 'text-[1.35rem] leading-tight' : 'max-w-[6.2rem] text-[1.55rem] leading-none'}`}
        style={{ fontFamily: 'var(--font-vw-serif), Georgia, serif' }}
      >
        {offer.benefitAmount}
      </span>
      {offer.benefitTail ? (
        <span className="mt-1 max-w-[6.2rem] text-[8px] font-semibold uppercase leading-tight tracking-[0.06em]">{offer.benefitTail}</span>
      ) : null}
    </div>
  );
}

function OfferVisual({ offer }: { offer: EditorialOffer }) {
  const image = safeImageSrc(offer.imageUrl);
  if (image) {
    return (
      <div data-photo="campaign" className="relative min-h-[16.5rem] md:min-h-[19rem]">
        <img src={image} alt={offer.imageAlt} className="absolute inset-0 h-full w-full object-cover object-center" />
        <div className="absolute right-4 top-4">
          <BenefitBadge offer={offer} />
        </div>
      </div>
    );
  }
  return (
    <div
      data-photo="none"
      className="relative flex min-h-[16.5rem] items-center overflow-hidden px-8 py-10 md:min-h-[19rem] md:px-10"
      style={{ backgroundImage: 'linear-gradient(155deg, #FFF8EE 0%, #F7FBFE 58%, #E7F3FB 100%)' }}
    >
      <span className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#E8C547]/30" aria-hidden />
      <span className="pointer-events-none absolute -bottom-24 -left-16 h-52 w-52 rounded-full bg-[#D7EEF8]" aria-hidden />
      <div className="relative max-w-[16rem]">
        {offer.benefitLead ? (
          <p className="text-[12px] font-semibold uppercase tracking-[0.28em] text-[#8A6A32]">{offer.benefitLead}</p>
        ) : null}
        <p
          className={`mt-2 font-semibold tracking-[-0.045em] text-[#0A2D62] ${amountClass(offer.benefitAmount)}`}
          style={{ fontFamily: 'var(--font-vw-serif), Georgia, serif' }}
        >
          {offer.benefitAmount}
        </p>
        <span className="mt-5 block h-[3px] w-12 rounded-full bg-[#E8C547]" aria-hidden />
        {offer.benefitTail ? (
          <p className="mt-3 text-[13px] font-semibold uppercase tracking-[0.16em] text-[#0A2D62]">{offer.benefitTail}</p>
        ) : null}
      </div>
    </div>
  );
}

const CTA_CLASS =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-[12px] bg-[#E8C547] px-5 py-2.5 text-[14px] font-semibold text-[#0A2D62] shadow-[0_8px_20px_rgba(232,197,71,0.35)] transition hover:bg-[#0A2D62] hover:text-white';

/** One clickout per market. A single-market offer keeps its own `clickUrl`. */
function offerClickouts(offer: EditorialOffer): { market: VacationWebPromotionMarket | null; url: string }[] {
  if (offer.clickouts && offer.clickouts.length > 0) {
    return offer.clickouts.map((clickout) => ({ market: clickout.market, url: clickout.url }));
  }
  return [{ market: null, url: offer.clickUrl }];
}

function CallToAction({ offer }: { offer: EditorialOffer }) {
  const clickouts = offerClickouts(offer)
    .map((clickout) => ({ ...clickout, href: safeClickHref(clickout.url) }))
    .filter((clickout): clickout is { market: VacationWebPromotionMarket | null; url: string; href: string } => Boolean(clickout.href));
  if (clickouts.length === 0) {
    return null;
  }
  const labelled = clickouts.length > 1;
  return (
    <div className="flex flex-wrap gap-3">
      {clickouts.map((clickout) => (
        <a
          key={clickout.market ?? 'default'}
          href={clickout.href}
          target="_blank"
          rel="noopener noreferrer"
          data-market={clickout.market ?? undefined}
          className={CTA_CLASS}
        >
          {labelled && clickout.market ? `Bekijk de actie (${MARKET_LABEL[clickout.market]})` : 'Bekijk de actie'}
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      ))}
    </div>
  );
}

function WideOffer({ offer }: { offer: EditorialOffer }) {
  return (
    <article data-placement="offer" className={WIDE_CARD_CLASS}>
      <OfferVisual offer={offer} />
      <div className="flex flex-col justify-center px-6 py-8 sm:px-8">
        <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#8A6A32]">{offer.providerName}</p>
        <h3
          className="mt-3 text-[2rem] font-semibold leading-[1.05] tracking-[-0.03em] text-[#0A2D62] sm:text-[2.35rem]"
          style={{ fontFamily: 'var(--font-vw-serif), Georgia, serif' }}
        >
          {offer.title}
        </h3>
        {offer.summary ? <p className="mt-4 text-[15px] leading-relaxed text-[#243E68]">{offer.summary}</p> : null}
        <div className="mt-6">
          <CallToAction offer={offer} />
        </div>
      </div>
    </article>
  );
}

export function AanbiedingenEmptyState() {
  return (
    <div className="rounded-[22px] bg-white px-6 py-12 text-center shadow-[0_22px_50px_rgba(10,45,98,0.08)] ring-1 ring-[#E7DCC8] sm:px-10">
      <p className="text-[18px] leading-relaxed text-[#243E68]">Momenteel zijn er geen actuele aanbiedingen.</p>
      <a
        href="/"
        className="mt-6 inline-flex min-h-11 items-center justify-center rounded-[12px] bg-[#E8C547] px-5 py-2.5 text-[14px] font-semibold text-[#0A2D62] shadow-[0_8px_20px_rgba(232,197,71,0.35)]"
      >
        Zoek een vakantie
      </a>
    </div>
  );
}

export function AanbiedingenExperience({
  sections,
  showMarketTitles,
}: {
  sections: AanbiedingenExperienceSection[];
  showMarketTitles: boolean;
}) {
  const visible = sections.reduce((sum, section) => sum + section.offers.length, 0);
  if (visible === 0) {
    return null;
  }

  return (
    <div className="space-y-14">
      {sections.map((section) => {
        if (section.offers.length === 0) {
          return null;
        }
        const markets = section.markets && section.markets.length > 0 ? section.markets : [section.market];
        const marketLabel = markets.map((market) => MARKET_LABEL[market]).join(' en ');
        const sectionKey = section.key ?? markets.join('-');
        return (
          <section key={sectionKey} aria-labelledby={`promotions-${sectionKey}`} className="space-y-6">
            <h2
              id={`promotions-${sectionKey}`}
              className={showMarketTitles ? 'text-[13px] font-semibold uppercase tracking-[0.28em] text-[#8A6A32]' : 'sr-only'}
            >
              {marketLabel}
            </h2>
            <div className="flex flex-col gap-8">
              {section.offers.map((offer) => (
                <WideOffer key={offer.id} offer={offer} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
