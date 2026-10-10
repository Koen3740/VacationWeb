'use client';

import { ArrowIcon, DiscoveryPhoto, PhotoCredit, PlayGlyph } from '@/components/discovery/photo';
import type { MagazineCard, MagazineModel } from '@/lib/discovery/model';
import Link from 'next/link';
import { useMemo, useState } from 'react';

const SIZE_CLASS: Record<MagazineCard['size'], string> = {
  xl: 'min-[901px]:col-span-8 min-[901px]:row-span-2',
  tall: 'min-[901px]:col-span-4 min-[901px]:row-span-2',
  s: 'min-[901px]:col-span-4 min-[901px]:row-span-1',
  w: 'min-[901px]:col-span-6 min-[901px]:row-span-2',
  band: 'min-[901px]:col-span-12 min-[901px]:row-span-2',
};

function cardMatches(card: MagazineCard, filter: string): boolean {
  if (filter === 'Alles') return true;
  if (filter === 'Nieuw') return card.badges.includes('new');
  return card.themes.includes(filter);
}

export function DiscoveryMagazine({ magazine }: { magazine: MagazineModel }) {
  const filters = useMemo(() => ['Alles', 'Nieuw', ...magazine.themes], [magazine.themes]);
  const [filter, setFilter] = useState('Alles');
  const cards = magazine.cards.filter((card) => cardMatches(card, filter));

  return (
    <>
      <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-4 [scrollbar-width:none] min-[901px]:mx-0 min-[901px]:px-0" aria-label="Thema's">
        {filters.map((item) => {
          const on = item === filter;
          return (
            <button
              key={item}
              type="button"
              aria-pressed={on}
              onClick={() => setFilter(item)}
              className={`inline-flex h-9 shrink-0 items-center rounded-full border px-3.5 text-[13.5px] font-semibold ${
                on ? 'border-vw-navy bg-vw-navy text-white' : 'border-vw-line bg-white text-vw-navy'
              }`}
            >
              {item}
            </button>
          );
        })}
      </nav>

      <div className="flex flex-col gap-3.5 min-[901px]:grid min-[901px]:grid-cols-12 min-[901px]:auto-rows-[280px] min-[901px]:gap-4">
        {cards.map((card, index) => (
          <article
            key={card.id}
            className={`relative isolate aspect-[4/5] overflow-hidden rounded-[20px] shadow-[0_10px_30px_rgba(10,30,60,.10)] min-[901px]:aspect-auto min-[901px]:rounded-[22px] ${SIZE_CLASS[card.size]}`}
          >
            <DiscoveryPhoto
              image={card.image}
              priority={index === 0}
              sizes={card.size === 'xl' || card.size === 'band' ? '(max-width: 900px) 100vw, 66vw' : '(max-width: 900px) 100vw, 40vw'}
            />
            <div className="absolute left-3.5 top-3.5 z-[2] flex gap-1.5">
              {card.badges.includes('new') ? (
                <span className="inline-flex h-6 items-center rounded-full bg-vw-gold px-2 text-[11px] font-bold tracking-wide text-[#1d1606]">
                  Nieuw
                </span>
              ) : null}
              {card.badges.includes('video') ? (
                <span className="inline-flex h-6 items-center gap-1 rounded-full bg-[rgba(6,18,38,.6)] px-2 text-[11px] font-bold tracking-wide text-white backdrop-blur-sm">
                  <PlayGlyph /> Video
                </span>
              ) : null}
              {card.badges.includes('theme') ? (
                <span className="inline-flex h-6 items-center rounded-full bg-white/90 px-2 text-[11px] font-bold tracking-wide text-vw-navy">
                  Thema
                </span>
              ) : null}
            </div>
            <div className="absolute inset-x-0 bottom-0 z-[1] bg-[linear-gradient(to_top,rgba(6,18,38,.78)_0%,rgba(6,18,38,.30)_50%,transparent_100%)] px-[18px] pb-[18px] pt-[70px] text-white min-[901px]:px-7 min-[901px]:pb-6">
              <p className="m-0 text-[11.5px] font-semibold uppercase tracking-[0.1em] opacity-90">{card.eyebrow}</p>
              <h2
                className={`mt-1 font-vw-serif font-medium leading-[1.12] ${
                  card.size === 'xl' || card.size === 'band'
                    ? 'text-[28px] min-[901px]:text-[40px]'
                    : 'text-[28px] min-[901px]:text-[26px]'
                }`}
              >
                {card.title}
              </h2>
              <p
                className={`mt-1.5 max-w-[46ch] text-[14.5px] leading-snug opacity-95 ${
                  card.size === 's' ? 'min-[901px]:hidden' : ''
                }`}
              >
                {card.text}
              </p>
              <div className="mt-3.5 flex flex-wrap items-center gap-x-3.5 gap-y-2">
                <Link
                  href={card.results.href}
                  className="inline-flex h-[42px] items-center gap-2 rounded-full border border-white/45 bg-white/20 px-4 text-[14px] font-semibold text-white backdrop-blur-[10px] hover:bg-white/30"
                >
                  {card.results.label}
                  <ArrowIcon />
                </Link>
                {card.pageHref && card.pageLabel ? (
                  <Link href={card.pageHref} className="text-[14px] font-semibold text-white underline underline-offset-[3px]">
                    {card.pageLabel}
                  </Link>
                ) : null}
              </div>
            </div>
            <PhotoCredit credit={card.image.credit} className="right-2.5 top-2.5" />
          </article>
        ))}
      </div>

      <section className="mt-[46px]">
        <h2 className="m-0 font-vw-serif text-[26px] font-medium leading-tight text-vw-navy min-[901px]:text-[30px]">
          Net verschenen
        </h2>
        <p className="mb-4 mt-1 text-vw-muted">Korte verhalen, elke week nieuw.</p>
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 [scrollbar-width:none] min-[901px]:mx-0 min-[901px]:grid min-[901px]:grid-cols-4 min-[901px]:gap-[18px] min-[901px]:overflow-visible min-[901px]:px-0">
          {magazine.stories.map((story) => (
            <article key={story.id} className="w-[74%] shrink-0 snap-start min-[901px]:w-auto">
              <div className="relative aspect-[4/5] overflow-hidden rounded-[18px]">
                <DiscoveryPhoto image={story.image} sizes="(max-width: 900px) 74vw, 25vw" />
                <PhotoCredit credit={story.image.credit} className="right-2 top-2" />
              </div>
              <p className="mb-0 mt-2.5 text-[12px] text-[#8a7a5c]">{story.whenLabel}</p>
              <h3 className="mt-0.5 font-vw-serif text-[19px] font-medium leading-snug text-vw-navy">{story.title}</h3>
              <p className="mt-1 text-[14px] text-[#475569]">{story.text}</p>
              <Link href={story.results.href} className="mt-2 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-vw-navy">
                {story.results.label}
                <ArrowIcon />
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-[46px]">
        <h2 className="m-0 font-vw-serif text-[26px] font-medium leading-tight text-vw-navy min-[901px]:text-[30px]">
          Waar wil je heen?
        </h2>
        <p className="mb-4 mt-1 text-vw-muted">Kies uit de bestemmingen die we vergelijken.</p>
        <div className="flex flex-wrap gap-2">
          {magazine.chips.map((chip) => (
            <Link
              key={chip.label}
              href={chip.href}
              className="inline-flex h-10 items-center gap-1.5 rounded-full border border-vw-line bg-white px-4 text-[14px] font-semibold text-vw-navy"
            >
              {chip.label}
              {chip.isNew ? (
                <em className="rounded bg-[#f6ecd6] px-1 text-[10px] font-bold uppercase not-italic tracking-wide text-[#8a6a1c]">
                  nieuw
                </em>
              ) : null}
            </Link>
          ))}
        </div>
      </section>

      <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-vw-line py-[22px] text-[14px] text-[#475569] min-[901px]:flex-row min-[901px]:items-center">
        <span>
          <b className="text-vw-navy">Wij vergelijken, jij boekt bij de aanbieder.</b> Geen eigen pakketten, geen &apos;vanaf&apos;-prijzen.
        </span>
        <Link href="/results" className="inline-flex h-12 items-center gap-2 rounded-vw-control bg-vw-navy px-[22px] text-[15px] font-semibold text-white">
          Vakanties vergelijken
          <ArrowIcon />
        </Link>
      </div>
    </>
  );
}
