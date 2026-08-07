'use client';

import { ResultsAdjustSearchFab } from '@/components/results-v2/results-adjust-search-fab';
import { ResultsHero } from '@/components/results-v2/results-hero';
import {
  RESULTS_INTRO_BY_VARIANT,
  type ResultsIntroVariant,
} from '@/components/results-v2/results-intro-copy';
import { ResultsSiteHeader } from '@/components/results-v2/results-site-header';
import { ResultsUspBar } from '@/components/results-v2/results-usp-bar';
import { ResultsVariantTabs } from '@/components/results-v2/results-variant-tabs';
import { ResultsWhyCard } from '@/components/results-v2/results-why-card';
import {
  RESULTS_CTA,
  RESULTS_CTA_HOVER,
  RESULTS_NAVY,
  RESULTS_RATING_GREEN,
} from '@/components/results-v2/results-design-tokens';
import { TravelCardGallery } from '@/components/results/travel-card-gallery';
import { getDepartureDisplay } from '@/components/search/departure-display';
import {
  CalendarIcon,
  DurationIcon,
  TravelersIcon,
} from '@/components/home/home-search-icons';
import { useState, type ReactNode } from 'react';

/** Preview demo: period selection (uses central departure display rules) */
const PREVIEW_DEPARTURE = getDepartureDisplay({
  departureStart: '2026-08-01',
  departureEnd: '2026-08-31',
  flexibilityDays: 2,
});

const MOCK_CARDS = [
  {
    id: '1',
    hotel: 'Flamingo Paradise Beach Hotel',
    location: 'Costa Dorada, Spanje',
    stars: 4,
    rating: 9.4,
    board: 'All Inclusive',
    airport: 'Brussel',
    departure: '1 aug – 31 aug',
    nights: 8,
    price: 1714,
    pricePerDay: 214,
    partners: 3,
    lastMinute: true,
    image: '/images/results-card-placeholder.png',
    photoCount: 8,
  },
  {
    id: '2',
    hotel: 'Hotel Mar Azul Resort',
    location: 'Costa Blanca, Spanje',
    stars: 4,
    rating: 8.7,
    board: 'Halfpension',
    airport: 'Rotterdam',
    departure: '1 aug – 31 aug',
    nights: 7,
    price: 1249,
    pricePerDay: 178,
    partners: 2,
    lastMinute: false,
    image: '/images/results-card-placeholder.png',
    photoCount: 5,
  },
  {
    id: '3',
    hotel: 'Iberostar Selection Playa',
    location: 'Mallorca, Spanje',
    stars: 5,
    rating: 9.1,
    board: 'All Inclusive',
    airport: 'Amsterdam',
    departure: '8 aug – 22 aug',
    nights: 10,
    price: 1895,
    pricePerDay: 190,
    partners: 4,
    lastMinute: false,
    image: '/images/results-card-placeholder.png',
    photoCount: 1,
  },
  {
    id: '4',
    hotel: 'Apartamentos Sol y Mar',
    location: 'Costa del Sol, Spanje',
    stars: 3,
    rating: 8.2,
    board: 'Logies ontbijt',
    airport: 'Eindhoven',
    departure: '1 aug – 31 aug',
    nights: 8,
    price: 899,
    pricePerDay: 112,
    partners: 2,
    lastMinute: false,
    image: '/images/results-card-placeholder.png',
    photoCount: 6,
  },
] as const;

function PlaneIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
      <path
        d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0011.5 2 1.5 1.5 0 0010 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"
        fill="#64748B"
      />
    </svg>
  );
}

function Field({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
}) {
  return (
    <div className="flex min-h-[60px] min-w-0 flex-1 items-center gap-2.5 px-3.5 py-2">
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-[#94A3B8]">
          {label}
        </span>
        <span className="mt-0.5 block truncate text-[13px] font-semibold text-[#0A2D62]">{value}</span>
        <span className="mt-0.5 block truncate text-[11px] text-[#94A3B8]">{hint}</span>
      </span>
    </div>
  );
}

function StaticSearchBar() {
  return (
    <div className="rounded-[16px] bg-white p-1 shadow-[0_10px_28px_rgba(10,45,98,0.12)] ring-1 ring-black/[0.04]">
      <div className="flex flex-col lg:flex-row lg:items-stretch">
        <div className="flex min-w-0 flex-1 flex-col divide-y divide-[#EEF2F6] lg:flex-row lg:divide-x lg:divide-y-0">
          <Field
            label="Wanneer"
            value={PREVIEW_DEPARTURE.label ?? 'Kies periode'}
            hint={PREVIEW_DEPARTURE.hint ?? ''}
            icon={<CalendarIcon />}
          />
          <Field label="Hoe lang" value="8 - 11 dagen" hint="Flexibel" icon={<DurationIcon />} />
          <Field label="Reizigers" value="2 volwassenen" hint="1 kamer" icon={<TravelersIcon />} />
          <Field label="Luchthaven" value="Alle luchthavens" hint="Flexibel" icon={<PlaneIcon />} />
        </div>
        <button
          type="button"
          className="mt-1 inline-flex h-11 shrink-0 items-center justify-center rounded-[12px] px-6 text-[14px] font-semibold text-white lg:mt-0 lg:h-auto lg:min-w-[104px] lg:self-stretch"
          style={{ backgroundColor: RESULTS_CTA }}
        >
          Zoeken
        </button>
      </div>
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className={`shrink-0 text-[#64748B] transition-transform ${open ? 'rotate-180' : ''}`}
    >
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Accordion({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="border-b border-[#E8ECF2]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 py-[14px] text-left"
        aria-expanded={open}
      >
        <span className="text-[15px] font-semibold text-[#0A2D62]">{title}</span>
        <Chevron open={open} />
      </button>
      {open && children ? <div className="pb-4">{children}</div> : null}
    </div>
  );
}

function StaticFilters() {
  const [open, setOpen] = useState<Record<string, boolean>>({
    destinations: true,
    budget: true,
  });

  return (
    <aside>
      <div className="rounded-[16px] border border-[#E5E9F0] bg-white px-4 shadow-[0_4px_16px_rgba(10,45,98,0.04)]">
        <Accordion
          title="Bestemmingen"
          open={!!open.destinations}
          onToggle={() => setOpen((p) => ({ ...p, destinations: !p.destinations }))}
        >
          <div className="space-y-3">
            {[
              ['Land', 'Spanje'],
              ['Streek / Regio', 'Alle streken'],
              ['Plaats', 'Alle plaatsen'],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="mb-1.5 text-[12px] font-medium text-[#64748B]">{label}</p>
                <div className="flex h-11 w-full items-center justify-between rounded-[10px] border border-[#D9E0EA] bg-white px-3 text-[14px] text-[#0A2D62]">
                  <span>{value}</span>
                  <Chevron open={false} />
                </div>
              </div>
            ))}
          </div>
        </Accordion>

        <Accordion
          title="Prijs per persoon"
          open={!!open.budget}
          onToggle={() => setOpen((p) => ({ ...p, budget: !p.budget }))}
        >
          <div className="space-y-3">
            <div className="relative h-2 rounded-full bg-[#E8ECF2]">
              <div className="absolute left-[8%] right-[18%] top-0 h-2 rounded-full bg-[#89ACD3]" />
            </div>
            <div className="flex justify-between text-[12px] text-[#64748B]">
              <span>€0</span>
              <span>€2.000+</span>
            </div>
          </div>
        </Accordion>

        {[
          'Verblijf',
          'Verzorging',
          'Aantal sterren',
          'Beoordeling',
          'Type vakantie',
          'Vertrekdatum',
          'Aantal slaapkamers',
        ].map((title) => (
          <Accordion
            key={title}
            title={title}
            open={!!open[title]}
            onToggle={() => setOpen((p) => ({ ...p, [title]: !p[title] }))}
          />
        ))}

        <div className="py-4">
          <button
            type="button"
            className="w-full rounded-[10px] border border-[#D9E0EA] bg-white px-3 py-2.5 text-[14px] font-medium text-[#0A2D62]"
          >
            Wis alle filters
          </button>
        </div>
      </div>
      <ResultsWhyCard />
    </aside>
  );
}

function MockCard({ card }: { card: (typeof MOCK_CARDS)[number] }) {
  const metaLine = `${card.nights} nachten • ${card.board} • ${card.airport}`;

  return (
    <article className="overflow-hidden rounded-[16px] border border-[#E5E9F0] bg-white shadow-[0_4px_18px_rgba(10,45,98,0.05)]">
      <div className="flex flex-col md:flex-row">
        <div className="relative w-full shrink-0 md:w-[320px] lg:w-[340px]">
          <TravelCardGallery
            images={[card.image]}
            alt={card.hotel}
            isLastMinute={card.lastMinute}
            previewPhotoCount={card.photoCount}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-between gap-3 p-4 sm:px-5 sm:py-4 md:flex-row md:gap-6">
          <div className="min-w-0 flex-1 py-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[18.5px] font-bold leading-snug text-[#0A2D62] sm:text-[19.5px]">
                {card.hotel}
              </h3>
              <span className="text-[14px] text-[#F5C542]">{'★'.repeat(card.stars)}</span>
            </div>
            <p className="mt-0.5 text-[13px] text-[#64748B]">{card.location}</p>
            <div className="mt-2.5 flex items-center gap-2">
              <span
                className="inline-flex h-6 min-w-[1.85rem] items-center justify-center rounded-[5px] px-1.5 text-[12px] font-bold text-white"
                style={{ backgroundColor: RESULTS_RATING_GREEN }}
              >
                {String(card.rating).replace('.', ',')}
              </span>
              <span className="text-[13px] font-semibold" style={{ color: RESULTS_RATING_GREEN }}>
                Fantastisch
              </span>
            </div>
            <p className="mt-2.5 text-[13px] leading-relaxed text-[#475569]">{metaLine}</p>
            <p className="mt-1 text-[12.5px] text-[#64748B]">Vertrek tussen {card.departure}</p>
          </div>

          <div className="flex w-full shrink-0 flex-col items-end justify-between border-t border-[#EEF2F6] pt-3 md:w-[158px] md:border-l md:border-t-0 md:pl-5 md:pt-0">
            <span className="inline-flex h-10 w-10 items-center justify-center text-[22px] leading-none text-[#94A3B8]" aria-hidden>
              ♡
            </span>
            <div className="mt-1 flex w-full flex-1 flex-col items-end justify-center text-right">
              <p className="text-[28px] font-bold leading-none" style={{ color: RESULTS_NAVY }}>
                €&nbsp;{card.price.toLocaleString('nl-NL')}
              </p>
              <p className="mt-1.5 text-[12px] font-medium text-[#94A3B8]">p.p.</p>
              <p className="mt-2 text-[11px] font-normal text-[#A8B3C4]">
                € {card.pricePerDay} per dag
              </p>
            </div>
            <div className="mt-3 w-full">
              <button
                type="button"
                className="inline-flex h-10 w-full items-center justify-center rounded-[11px] text-[13px] font-semibold text-white"
                style={{ backgroundColor: RESULTS_CTA }}
              >
                Bekijk aanbieding
              </button>
              <p className="mt-1.5 text-center text-[11.5px] font-medium" style={{ color: RESULTS_CTA_HOVER }}>
                Bekijk bij {card.partners} partners
              </p>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

export function ResultsPreviewStatic() {
  const [variant, setVariant] = useState<ResultsIntroVariant>('country');
  const intro = RESULTS_INTRO_BY_VARIANT[variant];
  const previewResultsSummary =
    variant === 'country'
      ? ['Spanje', PREVIEW_DEPARTURE.summarySegment, '8 - 11 dagen', '2 volwassenen', '1 kamer']
          .filter(Boolean)
          .join(' • ')
      : intro.resultsSummary;

  return (
    <div className="min-h-screen bg-[#F3F5F8] text-slate-900">
      <ResultsSiteHeader />
      <ResultsHero intro={intro} searchBar={<StaticSearchBar />} />

      <main className="mx-auto max-w-[1280px] px-6 pb-10 pt-10 lg:px-8 lg:pt-12">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[270px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)]">
          <StaticFilters />
          <section>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <ResultsVariantTabs active={variant} onChange={setVariant} />
              <label className="inline-flex items-center gap-2 text-[13px] text-[#64748B]">
                <span>Sorteren op:</span>
                <select className="h-10 rounded-[10px] border border-[#D9E0EA] bg-white px-3 text-[13px] font-semibold text-[#0A2D62]">
                  <option>Beste prijs/kwaliteit</option>
                </select>
              </label>
            </div>
            <div className="mb-5">
              <h2 className="text-[22px] font-bold tracking-tight text-[#0A2D62]">{intro.resultsTitle}</h2>
              <p className="mt-1.5 text-[13px] text-[#64748B]">{previewResultsSummary}</p>
            </div>
            <div className="space-y-3.5">
              {MOCK_CARDS.map((card) => (
                <MockCard key={card.id} card={card} />
              ))}
            </div>
            <nav className="mt-8 flex flex-wrap items-center justify-center gap-2" aria-label="Paginatie">
              {[1, 2, 3].map((page) => (
                <span
                  key={page}
                  className={`inline-flex h-10 min-w-10 items-center justify-center rounded-[10px] px-3 text-sm font-semibold ${
                    page === 1 ? 'bg-[#0A2D62] text-white' : 'border border-[#D9E0EA] bg-white text-[#334155]'
                  }`}
                >
                  {page}
                </span>
              ))}
              <span className="px-1 text-sm text-[#94A3B8]">…</span>
              <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-[10px] border border-[#D9E0EA] bg-white px-3 text-sm font-semibold text-[#334155]">
                20
              </span>
              <span className="ml-1 inline-flex h-10 items-center px-3 text-sm font-semibold text-[#0A2D62]">
                Volgende &gt;
              </span>
            </nav>
          </section>
        </div>
      </main>
      <ResultsUspBar />
      <ResultsAdjustSearchFab />
    </div>
  );
}
