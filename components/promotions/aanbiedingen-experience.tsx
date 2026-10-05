import type { EditorialOffer } from '@/lib/tradetracker/promotions/editorial-offers';
import type { VacationWebPromotionMarket } from '@/lib/tradetracker/promotions/select-displayable';
import React from 'react';

export type AanbiedingenExperienceSection = {
  market: VacationWebPromotionMarket;
  offers: EditorialOffer[];
  error: boolean;
};

function safeImageSrc(value: string): string | null {
  if (!value || value.includes('/i?') || value.includes('/c?') || value.includes('://')) {
    return null;
  }
  if (value.startsWith('/aanbiedingen/creative-images/')) {
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

function OfferCopy({ offer, tone }: { offer: EditorialOffer; tone: 'light' | 'ink' }) {
  const light = tone === 'light';
  const click = safeClickHref(offer.clickUrl);
  return (
    <div className={light ? 'text-white' : 'text-[#0A2D62]'}>
      <p className={`text-[12px] font-semibold uppercase tracking-[0.28em] ${light ? 'text-[#E8C547]' : 'text-[#8A6A32]'}`}>
        {offer.providerName}
      </p>
      <h2
        className="mt-3 max-w-[12ch] text-[2.6rem] font-semibold leading-[0.98] tracking-[-0.035em] sm:text-[3.4rem]"
        style={{ fontFamily: 'var(--font-vw-serif), Georgia, serif' }}
      >
        {offer.title}
      </h2>
      <p className={`mt-8 text-[13px] font-semibold uppercase tracking-[0.34em] ${light ? 'text-white/75' : 'text-[#8A6A32]'}`}>
        {offer.benefitLead}
      </p>
      <p
        className="mt-1 text-[5.2rem] font-semibold leading-none tracking-[-0.045em] sm:text-[7rem]"
        style={{ fontFamily: 'var(--font-vw-serif), Georgia, serif' }}
      >
        {offer.benefitAmount}
      </p>
      {offer.benefitTail ? (
        <p className={`mt-2 text-[1.2rem] font-medium tracking-[0.12em] sm:text-[1.4rem] ${light ? 'text-[#E8C547]' : 'text-[#0A2D62]'}`}>
          {offer.benefitTail}
        </p>
      ) : null}
      {offer.summary ? (
        <p className={`mt-6 max-w-[34rem] text-[16px] leading-relaxed sm:text-[17px] ${light ? 'text-white/88' : 'text-[#243E68]'}`}>
          {offer.summary}
        </p>
      ) : null}
      {click ? (
        <a
          href={click}
          target="_blank"
          rel="noopener noreferrer"
          className={`mt-8 inline-flex items-center px-7 py-3.5 text-[13px] font-semibold uppercase tracking-[0.18em] transition ${
            light ? 'bg-[#E8C547] text-[#0A2D62] hover:bg-white' : 'bg-[#0A2D62] text-white hover:bg-[#163E78]'
          }`}
        >
          Bekijk de actie
        </a>
      ) : null}
    </div>
  );
}

function OfferFigure({ offer, className }: { offer: EditorialOffer; className: string }) {
  const src = safeImageSrc(offer.imageUrl);
  if (!src) {
    return null;
  }
  return <img src={src} alt={offer.imageAlt} className={className} />;
}

function HeroOffer({ offer }: { offer: EditorialOffer }) {
  return (
    <article className="group relative isolate min-h-[38rem] overflow-hidden bg-[#071833] sm:min-h-[42rem]">
      <OfferFigure
        offer={offer}
        className="absolute inset-0 h-full w-full object-cover object-[18%_center] transition duration-700 ease-out group-hover:scale-[1.03]"
      />
      <div
        className="absolute inset-0 bg-gradient-to-t from-[#071833] via-[#071833]/80 to-[#071833]/20 sm:bg-gradient-to-r sm:from-[#071833] sm:via-[#071833]/75 sm:to-[#071833]/10"
        aria-hidden
      />
      <div className="relative z-10 flex min-h-[38rem] flex-col justify-end px-6 py-10 sm:min-h-[42rem] sm:max-w-[40rem] sm:justify-center sm:px-12 sm:py-16">
        <OfferCopy offer={offer} tone="light" />
      </div>
    </article>
  );
}

function SupportingOffer({ offer }: { offer: EditorialOffer }) {
  return (
    <article className="grid overflow-hidden bg-[#fffdf8] shadow-[0_28px_70px_rgba(10,45,98,0.08)] lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
      <div className="group relative min-h-[18rem] overflow-hidden bg-[#0A2D62] sm:min-h-[24rem] lg:min-h-full">
        <OfferFigure
          offer={offer}
          className="absolute inset-0 h-full w-full object-cover object-[22%_center] transition duration-700 ease-out group-hover:scale-[1.035]"
        />
      </div>
      <div className="flex flex-col justify-center px-6 py-10 sm:px-10 lg:px-12 lg:py-16">
        <OfferCopy offer={offer} tone="ink" />
      </div>
    </article>
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
    <div className="space-y-16">
      {sections.map((section) => {
        if (section.offers.length === 0) {
          return null;
        }
        const heroes = section.offers.filter((offer) => offer.placement === 'hero');
        const supporting = section.offers.filter((offer) => offer.placement !== 'hero');
        const marketLabel = section.market === 'be' ? 'België' : 'Nederland';
        return (
          <section key={section.market} aria-labelledby={`promotions-${section.market}`} className="space-y-10">
            <h2
              id={`promotions-${section.market}`}
              className={showMarketTitles ? 'text-[13px] font-semibold uppercase tracking-[0.28em] text-[#8A6A32]' : 'sr-only'}
            >
              {marketLabel}
            </h2>
            {heroes.map((offer) => (
              <HeroOffer key={offer.id} offer={offer} />
            ))}
            {supporting.map((offer) => (
              <SupportingOffer key={offer.id} offer={offer} />
            ))}
          </section>
        );
      })}
    </div>
  );
}
