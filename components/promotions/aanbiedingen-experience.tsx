import type { EditorialOffer } from '@/lib/tradetracker/promotions/editorial-offers';
import type { VacationWebPromotionMarket } from '@/lib/tradetracker/promotions/select-displayable';
import React from 'react';

export type AanbiedingenExperienceSection = {
  market: VacationWebPromotionMarket;
  offers: EditorialOffer[];
  error: boolean;
};

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

function sceneKey(id: string): string {
  const key = id.replace(/[^a-zA-Z0-9]/g, '');
  return key || 'scene';
}

function DiscountBadge({ offer, size }: { offer: EditorialOffer; size: 'hero' | 'card' }) {
  const hero = size === 'hero';
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-full bg-[#E8C547] text-center text-[#0A2D62] shadow-[0_16px_40px_rgba(10,45,98,0.18)] ring-4 ring-white/70 ${
        hero ? 'h-40 w-40 sm:h-48 sm:w-48' : 'h-24 w-24'
      }`}
    >
      <span className={`font-semibold uppercase tracking-[0.18em] ${hero ? 'text-[11px]' : 'text-[9px]'}`}>{offer.benefitLead}</span>
      <span
        className={`mt-1 font-semibold leading-none tracking-[-0.04em] ${hero ? 'text-[2.7rem] sm:text-[3.15rem]' : 'text-[1.35rem]'}`}
        style={{ fontFamily: 'var(--font-vw-serif), Georgia, serif' }}
      >
        {offer.benefitAmount}
      </span>
      {offer.benefitTail ? (
        <span className={`mt-1 max-w-[7.2rem] font-semibold uppercase leading-tight tracking-[0.06em] ${hero ? 'text-[10px]' : 'text-[8px]'}`}>
          {offer.benefitTail}
        </span>
      ) : null}
    </div>
  );
}

function VacationScene({ offer, large }: { offer: EditorialOffer; large: boolean }) {
  const image = safeImageSrc(offer.imageUrl);
  const key = sceneKey(offer.id);
  return (
    <div className={`relative overflow-hidden ${large ? 'min-h-[20rem] sm:min-h-[26rem]' : 'min-h-[11.5rem]'}`}>
      {image ? (
        <img src={image} alt={offer.imageAlt} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <svg viewBox="0 0 800 560" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden>
          <defs>
            <linearGradient id={`${key}-sky`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6EBFEE" />
              <stop offset="46%" stopColor="#D4F0FF" />
              <stop offset="100%" stopColor="#F8E7B0" />
            </linearGradient>
            <linearGradient id={`${key}-sea`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#49C0DC" />
              <stop offset="100%" stopColor="#1878A2" />
            </linearGradient>
          </defs>
          <rect width="800" height="560" fill={`url(#${key}-sky)`} />
          <circle cx="640" cy="118" r="108" fill="#FFF6D0" opacity="0.9" />
          <circle cx="640" cy="118" r="62" fill="#F3D36A" />
          <g fill="#FFFFFF">
            <ellipse cx="168" cy="96" rx="78" ry="24" opacity="0.92" />
            <ellipse cx="224" cy="84" rx="46" ry="20" opacity="0.92" />
            <ellipse cx="122" cy="82" rx="36" ry="16" opacity="0.88" />
            <ellipse cx="430" cy="70" rx="54" ry="16" opacity="0.72" />
          </g>
          <path d="M40 318c70-46 130-28 176 6 28 20 18 8 18 8" fill="#8ECAE6" opacity="0.55" />
          <path d="M520 300c48-36 110-22 168 8v40c-70-28-120-18-168-8z" fill="#7EC4B0" opacity="0.45" />
          <path d="M0 348c90-28 150 24 250-4 110-30 150 28 260-8 90-28 180 8 290-16v240H0V348z" fill={`url(#${key}-sea)`} />
          <path d="M0 392c120-36 190 20 310-8 130-30 180 22 300-10 40-8 120 6 190-12" fill="none" stroke="#FFFFFF" strokeOpacity="0.55" strokeWidth="4" />
          <path d="M0 468c140-28 240 24 400-6 120-22 220 16 400-18v116H0V468z" fill="#F6D7A6" />
          <path d="M0 500c160 16 280-20 460 8 90 10 200-8 340-4v56H0v-60z" fill="#E8C48A" opacity="0.65" />
          <g transform="translate(78 250)">
            <path d="M46 250c10-70 2-130 14-196" fill="none" stroke="#7A5230" strokeWidth="11" strokeLinecap="round" />
            <ellipse cx="58" cy="48" rx="16" ry="52" fill="#1B6B3C" transform="rotate(-8 58 48)" />
            <ellipse cx="58" cy="50" rx="14" ry="48" fill="#22864A" transform="rotate(28 58 50)" />
            <ellipse cx="58" cy="52" rx="13" ry="44" fill="#145C32" transform="rotate(-42 58 52)" />
            <ellipse cx="58" cy="54" rx="12" ry="40" fill="#2E9458" transform="rotate(62 58 54)" />
            <ellipse cx="58" cy="56" rx="11" ry="36" fill="#176B38" transform="rotate(-72 58 56)" />
          </g>
        </svg>
      )}
      {large ? (
        <p
          className="pointer-events-none absolute bottom-7 left-[34%] text-[22px] text-white/95 drop-shadow-sm sm:text-[26px]"
          style={{ fontFamily: "Segoe Script, 'Apple Chancery', 'Snell Roundhand', cursive" }}
          aria-hidden
        >
          Tijd voor zon.
        </p>
      ) : null}
      <div className={`absolute ${large ? 'right-5 top-5 sm:right-8 sm:top-8' : 'right-3 top-3'}`}>
        <DiscountBadge offer={offer} size={large ? 'hero' : 'card'} />
      </div>
    </div>
  );
}

function CallToAction({ offer, prominent }: { offer: EditorialOffer; prominent: boolean }) {
  const click = safeClickHref(offer.clickUrl);
  if (!click) {
    return null;
  }
  return (
    <a
      href={click}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center justify-center gap-2 rounded-[12px] bg-[#E8C547] font-semibold text-[#0A2D62] shadow-[0_8px_20px_rgba(232,197,71,0.35)] transition hover:bg-[#0A2D62] hover:text-white ${
        prominent ? 'min-h-12 px-6 py-3 text-[15px]' : 'min-h-11 px-4 py-2.5 text-[13px]'
      }`}
    >
      Bekijk de actie
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </a>
  );
}

function OfferCopy({ offer, prominent }: { offer: EditorialOffer; prominent: boolean }) {
  return (
    <div className={prominent ? 'flex flex-col justify-center px-6 py-8 sm:px-10 sm:py-12' : 'flex flex-1 flex-col px-5 py-6'}>
      <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#8A6A32]">{offer.providerName}</p>
      {prominent ? (
        <h3
          className="mt-3 max-w-[12ch] text-[2.5rem] font-semibold leading-[1.02] tracking-[-0.03em] text-[#0A2D62] sm:text-[3.15rem]"
          style={{ fontFamily: 'var(--font-vw-serif), Georgia, serif' }}
        >
          {offer.title}
        </h3>
      ) : (
        <h3
          className="mt-2 text-[1.55rem] font-semibold leading-tight tracking-[-0.02em] text-[#0A2D62]"
          style={{ fontFamily: 'var(--font-vw-serif), Georgia, serif' }}
        >
          {offer.title}
        </h3>
      )}
      {offer.summary ? (
        <p className={`leading-relaxed text-[#243E68] ${prominent ? 'mt-5 max-w-[34rem] text-[16.5px]' : 'mt-3 flex-1 text-[14px]'}`}>{offer.summary}</p>
      ) : null}
      <div className={prominent ? 'mt-8' : 'mt-5'}>
        <CallToAction offer={offer} prominent={prominent} />
      </div>
    </div>
  );
}

function HeroOffer({ offer }: { offer: EditorialOffer }) {
  return (
    <article
      data-placement="hero"
      className="grid overflow-hidden rounded-[20px] bg-white shadow-[0_22px_60px_rgba(10,45,98,0.10)] ring-1 ring-[#E7DCC8] lg:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)]"
    >
      <VacationScene offer={offer} large />
      <OfferCopy offer={offer} prominent />
    </article>
  );
}

function CardOffer({ offer, wide }: { offer: EditorialOffer; wide: boolean }) {
  return (
    <article
      data-placement="card"
      className={`flex h-full overflow-hidden rounded-[16px] bg-white shadow-[0_14px_36px_rgba(10,45,98,0.07)] ring-1 ring-[#E7DCC8] ${
        wide ? 'flex-col md:grid md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]' : 'flex-col'
      }`}
    >
      <VacationScene offer={offer} large={false} />
      <OfferCopy offer={offer} prominent={false} />
    </article>
  );
}

function cardGridClass(count: number): string {
  if (count <= 1) {
    return 'grid';
  }
  if (count >= 5) {
    return 'grid gap-5 sm:grid-cols-2 xl:grid-cols-3';
  }
  return 'grid gap-6 md:grid-cols-2';
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
    <div className="space-y-16">
      {sections.map((section) => {
        if (section.offers.length === 0) {
          return null;
        }
        const hero = section.offers.find((offer) => offer.placement === 'hero') ?? null;
        const cards = section.offers.filter((offer) => offer !== hero);
        const marketLabel = section.market === 'be' ? 'België' : 'Nederland';
        return (
          <section key={section.market} aria-labelledby={`promotions-${section.market}`} className="space-y-6">
            <h2
              id={`promotions-${section.market}`}
              className={showMarketTitles ? 'text-[13px] font-semibold uppercase tracking-[0.28em] text-[#8A6A32]' : 'sr-only'}
            >
              {marketLabel}
            </h2>
            {hero ? <HeroOffer offer={hero} /> : null}
            {cards.length > 0 ? (
              <div className={cardGridClass(cards.length)}>
                {cards.map((offer) => (
                  <CardOffer key={offer.id} offer={offer} wide={cards.length === 1} />
                ))}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
