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
    if (url.protocol !== 'https:') {
      return null;
    }
    if (url.hostname === 'ti.tradetracker.net') {
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
  const conditionsHref = safeClickHref(offer.conditionsUrl);
  return (
    <div className={light ? 'text-white' : 'text-[#0A2D62]'}>
      <p className={`text-[12px] font-semibold uppercase tracking-[0.28em] ${light ? 'text-[#E8C547]' : 'text-[#8A6A32]'}`}>
        {offer.providerName}
      </p>
      <h2
        className="mt-3 max-w-[16ch] text-[2.4rem] font-semibold leading-[1.02] tracking-[-0.03em] sm:text-[3.1rem]"
        style={{ fontFamily: 'var(--font-vw-serif), Georgia, serif' }}
      >
        {offer.title}
      </h2>
      <p className={`mt-6 text-[13px] font-semibold uppercase tracking-[0.32em] ${light ? 'text-white/80' : 'text-[#8A6A32]'}`}>
        {offer.benefitLead}
      </p>
      <p
        className="mt-1 text-[4.6rem] font-semibold leading-none tracking-[-0.04em] sm:text-[6.4rem]"
        style={{ fontFamily: 'var(--font-vw-serif), Georgia, serif' }}
      >
        {offer.benefitAmount}
      </p>
      {offer.benefitTail ? (
        <p className={`mt-2 text-[1.15rem] font-medium tracking-[0.08em] sm:text-[1.35rem] ${light ? 'text-white/90' : 'text-[#0A2D62]'}`}>
          {offer.benefitTail}
        </p>
      ) : null}
      {offer.summary ? (
        <p className={`mt-6 max-w-[38rem] text-[16px] leading-relaxed ${light ? 'text-white/90' : 'text-[#243E68]'}`}>
          {offer.summary}
        </p>
      ) : null}
      {offer.conditions ? (
        <p className={`mt-3 max-w-[40rem] text-[14px] leading-relaxed ${light ? 'text-white/75' : 'text-[#4A5E7A]'}`}>
          {offer.conditions}
        </p>
      ) : null}
      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
        {click ? (
          <a
            href={click}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center px-6 py-3.5 text-[13px] font-semibold uppercase tracking-[0.18em] transition ${
              light
                ? 'bg-[#E8C547] text-[#0A2D62] hover:bg-white'
                : 'bg-[#0A2D62] text-white hover:bg-[#163E78]'
            }`}
          >
            Bekijk aanbieding
          </a>
        ) : null}
        {conditionsHref && conditionsHref !== click ? (
          <a
            href={conditionsHref}
            target="_blank"
            rel="noopener noreferrer"
            className={`text-[14px] underline decoration-1 underline-offset-4 ${light ? 'text-white/85 hover:text-white' : 'text-[#0A2D62]'}`}
          >
            Actievoorwaarden
          </a>
        ) : null}
      </div>
    </div>
  );
}

function OfferFigure({ offer, className }: { offer: EditorialOffer; className: string }) {
  const src = safeImageSrc(offer.imageUrl);
  if (!src) {
    return null;
  }
  return (
    <img
      src={src}
      alt={offer.imageAlt}
      className={className}
    />
  );
}

function HeroOffer({ offer }: { offer: EditorialOffer }) {
  return (
    <article className="group relative isolate min-h-[36rem] overflow-hidden bg-[#071833] sm:min-h-[40rem] lg:min-h-[44rem]">
      <OfferFigure
        offer={offer}
        className="absolute inset-0 h-full w-full object-cover object-[78%_center] transition duration-700 ease-out group-hover:scale-[1.035]"
      />
      <div
        className="absolute inset-0 bg-gradient-to-t from-[#071833] via-[#071833]/78 to-[#071833]/25 lg:bg-gradient-to-r lg:from-[#071833] lg:via-[#071833]/72 lg:to-[#071833]/10"
        aria-hidden
      />
      <div className="relative z-10 flex min-h-[36rem] flex-col justify-end px-6 py-10 sm:min-h-[40rem] sm:px-10 sm:py-12 lg:min-h-[44rem] lg:max-w-[46rem] lg:justify-center lg:px-14 lg:py-16">
        <OfferCopy offer={offer} tone="light" />
      </div>
    </article>
  );
}

function SupportingOffer({ offer }: { offer: EditorialOffer }) {
  return (
    <article className="grid overflow-hidden bg-[#fffdf8] shadow-[0_24px_60px_rgba(10,45,98,0.06)] lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
      <div className="group relative min-h-[16rem] overflow-hidden bg-[#0A2D62] sm:min-h-[20rem] lg:min-h-full">
        <OfferFigure
          offer={offer}
          className="absolute inset-0 h-full w-full object-cover object-[76%_center] transition duration-700 ease-out group-hover:scale-[1.04]"
        />
      </div>
      <div className="flex flex-col justify-center px-6 py-10 sm:px-10 lg:px-12 lg:py-14">
        <OfferCopy offer={offer} tone="ink" />
      </div>
    </article>
  );
}

function EmptyOffers() {
  return (
    <section className="relative overflow-hidden bg-[#0A2D62] text-white">
      <div
        className="pointer-events-none absolute -right-24 top-0 h-[28rem] w-[28rem] rounded-full bg-[#E8C547]/15 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-0 left-0 h-40 w-full bg-gradient-to-t from-black/25 to-transparent"
        aria-hidden
      />
      <div className="relative grid min-h-[32rem] lg:min-h-[38rem] lg:grid-cols-[minmax(0,1.35fr)_minmax(16rem,0.7fr)]">
        <div className="flex flex-col justify-end px-6 py-12 sm:px-10 sm:py-16 lg:px-14 lg:py-20">
          <p className="text-[12px] font-semibold uppercase tracking-[0.32em] text-[#E8C547]">Nu geen actie</p>
          <div className="mt-5 h-px w-16 bg-[#E8C547]" aria-hidden />
          <h2
            className="mt-6 max-w-[14ch] text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.035em] sm:text-[3.7rem]"
            style={{ fontFamily: 'var(--font-vw-serif), Georgia, serif' }}
          >
            Er staat nu geen aanbieding.
          </h2>
          <p className="mt-6 max-w-[34rem] text-[17px] leading-relaxed text-white/85">
            Hier verschijnt een actie pas wanneer het kortingsbedrag in de bron staat.
          </p>
        </div>
        <div className="flex items-end px-6 pb-12 sm:px-10 lg:px-12 lg:py-20">
          <div className="w-full border border-white/20 bg-white/5 px-6 py-7 backdrop-blur-sm">
            <p className="text-[12px] font-semibold uppercase tracking-[0.28em] text-[#E8C547]">Wat hier telt</p>
            <p
              className="mt-4 text-[1.7rem] font-semibold leading-tight tracking-[-0.03em]"
              style={{ fontFamily: 'var(--font-vw-serif), Georgia, serif' }}
            >
              Een concreet bedrag of percentage uit de bron.
            </p>
            <p className="mt-4 text-[14px] leading-relaxed text-white/75">
              Zonder dat bedrag is het geen aanbieding op VacationWeb.
            </p>
          </div>
        </div>
      </div>
    </section>
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

  return (
    <div className="space-y-14">
      {visible === 0 ? <EmptyOffers /> : null}
      {visible === 0 && sections.some((section) => section.error) ? (
        <p className="max-w-[40rem] text-[14px] leading-relaxed text-[#4A5E7A]">
          De promotiebron kon nu niet worden gelezen. Zonder een aangetoond kortingsbedrag blijft de pagina leeg.
        </p>
      ) : null}
      {visible === 0
        ? null
        : sections.map((section) => {
        const heroes = section.offers.filter((offer) => offer.placement === 'hero');
        const supporting = section.offers.filter((offer) => offer.placement !== 'hero');
        const marketLabel = section.market === 'be' ? 'België' : 'Nederland';
        return (
          <section key={section.market} aria-labelledby={`promotions-${section.market}`} className="space-y-8">
            <h2
              id={`promotions-${section.market}`}
              className={showMarketTitles ? 'text-[13px] font-semibold uppercase tracking-[0.28em] text-[#8A6A32]' : 'sr-only'}
            >
              {marketLabel}
            </h2>
            {section.error ? (
              <p className="border border-[#E7C3C3] bg-[#FDF6F6] px-5 py-4 text-[15px] text-[#7A2430]">
                Aanbiedingen konden nu niet worden geladen. Probeer het later opnieuw.
              </p>
            ) : null}
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
