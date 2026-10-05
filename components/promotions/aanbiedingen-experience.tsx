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

function Amount({ offer, tone }: { offer: EditorialOffer; tone: 'light' | 'ink' }) {
  const light = tone === 'light';
  return (
    <div>
      <p className={`text-[13px] font-semibold uppercase tracking-[0.34em] ${light ? 'text-white/70' : 'text-[#8A6A32]'}`}>
        {offer.benefitLead}
      </p>
      <p
        className={`mt-1 text-[5.4rem] font-semibold leading-[0.85] tracking-[-0.05em] sm:text-[7.5rem] ${light ? 'text-white' : 'text-[#0A2D62]'}`}
        style={{ fontFamily: 'var(--font-vw-serif), Georgia, serif' }}
      >
        {offer.benefitAmount}
      </p>
      {offer.benefitTail ? (
        <p className={`mt-3 text-[1.15rem] font-medium tracking-[0.14em] sm:text-[1.35rem] ${light ? 'text-[#E8C547]' : 'text-[#0A2D62]'}`}>
          {offer.benefitTail}
        </p>
      ) : null}
    </div>
  );
}

function OfferText({ offer, tone }: { offer: EditorialOffer; tone: 'light' | 'ink' }) {
  const light = tone === 'light';
  const click = safeClickHref(offer.clickUrl);
  return (
    <div className={light ? 'text-white' : 'text-[#0A2D62]'}>
      <p className={`text-[12px] font-semibold uppercase tracking-[0.28em] ${light ? 'text-[#E8C547]' : 'text-[#8A6A32]'}`}>
        {offer.providerName}
      </p>
      <h2
        className="mt-3 max-w-[12ch] text-[2.5rem] font-semibold leading-[0.98] tracking-[-0.035em] sm:text-[3.3rem]"
        style={{ fontFamily: 'var(--font-vw-serif), Georgia, serif' }}
      >
        {offer.title}
      </h2>
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

function AllowedFigure({ offer }: { offer: EditorialOffer }) {
  const src = safeImageSrc(offer.imageUrl);
  if (!src) {
    return null;
  }
  return <img src={src} alt={offer.imageAlt} className="h-full w-full object-cover" />;
}

function HeroOffer({ offer }: { offer: EditorialOffer }) {
  const figure = <AllowedFigure offer={offer} />;
  return (
    <article className="relative overflow-hidden bg-[#071833]">
      <p
        className="pointer-events-none absolute -right-6 top-6 hidden select-none text-[14rem] font-semibold leading-none tracking-[-0.06em] text-white/[0.05] lg:block"
        style={{ fontFamily: 'var(--font-vw-serif), Georgia, serif' }}
        aria-hidden
      >
        {offer.benefitAmount.replace(/[^\d]/g, '')}
      </p>
      <div className={`relative grid min-h-[34rem] lg:min-h-[40rem] ${figure ? 'lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]' : 'lg:grid-cols-[minmax(0,1.15fr)_minmax(16rem,0.85fr)]'}`}>
        {figure ? (
          <div className="relative min-h-[16rem] overflow-hidden lg:min-h-full">{figure}</div>
        ) : (
          <div className="flex flex-col justify-end px-6 py-12 sm:px-12 sm:py-16">
            <OfferText offer={offer} tone="light" />
          </div>
        )}
        <div className={`flex flex-col justify-end gap-10 border-t border-white/15 px-6 py-12 sm:px-12 lg:border-l lg:border-t-0 ${figure ? '' : 'lg:justify-end'}`}>
          {figure ? <OfferText offer={offer} tone="light" /> : null}
          <Amount offer={offer} tone="light" />
        </div>
      </div>
    </article>
  );
}

function SupportingOffer({ offer }: { offer: EditorialOffer }) {
  const figure = <AllowedFigure offer={offer} />;
  return (
    <article className="grid overflow-hidden bg-[#fffdf8] lg:grid-cols-[minmax(14rem,0.78fr)_minmax(0,1.22fr)]">
      <div className={`flex min-h-[16rem] flex-col justify-end px-6 py-10 sm:px-10 lg:px-12 lg:py-16 ${figure ? 'relative bg-[#0A2D62]' : 'border-b border-[#E4D8C4] lg:border-b-0 lg:border-r'}`}>
        {figure ? <div className="absolute inset-0">{figure}</div> : <Amount offer={offer} tone="ink" />}
      </div>
      <div className="flex flex-col justify-center px-6 py-10 sm:px-10 lg:px-12 lg:py-16">
        {figure ? <Amount offer={offer} tone="ink" /> : null}
        <div className={figure ? 'mt-8' : ''}>
          <OfferText offer={offer} tone="ink" />
        </div>
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
          <section key={section.market} aria-labelledby={`promotions-${section.market}`} className="space-y-8 lg:space-y-12">
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
