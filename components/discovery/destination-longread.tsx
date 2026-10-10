import { ArrowIcon, DiscoveryPhoto, PhotoCredit } from '@/components/discovery/photo';
import { YouTubeConsentEmbed } from '@/components/discovery/youtube-consent-embed';
import { ResultsSiteHeader } from '@/components/results-v2/results-site-header';
import type { SeasonLevel } from '@/content/destinations/types';
import type { DestinationView } from '@/lib/discovery/model';
import Link from 'next/link';

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'] as const;

const SEASON_CLASS: Record<SeasonLevel, string> = {
  0: 'bg-[#efe8da] text-[#7a6f5c]',
  1: 'bg-[#e9e1bf] text-[#7a6f5c]',
  2: 'bg-[#cfe3c0] text-[#2b5a2f]',
  3: 'bg-vw-green text-white',
};

function PlaceholderMark() {
  return (
    <span className="ml-1.5 inline-block rounded bg-[#fde6c4] px-1 py-px align-[2px] text-[8.5px] font-bold uppercase tracking-[0.09em] text-[#8a4b00]">
      placeholder
    </span>
  );
}

function QuietLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 border-b border-vw-gold pb-0.5 text-[15px] font-semibold text-vw-navy hover:border-vw-navy"
    >
      {label}
      <span aria-hidden>→</span>
    </Link>
  );
}

export function DestinationLongread({ view }: { view: DestinationView }) {
  const subnav = [
    { href: '#intro', label: 'Verhaal' },
    ...(view.video ? [{ href: '#video', label: 'Video' }] : []),
    ...view.chapters.map((chapter) => ({ href: `#${chapter.id}`, label: chapter.navLabel })),
    { href: '#plekken', label: 'Plekken' },
    { href: '#regios', label: "Regio's" },
    { href: '#praktisch', label: 'Goed om te weten' },
  ];

  return (
    <div className="bg-vw-bg font-vw-sans text-vw-ink">
      <section className="relative isolate h-svh min-h-[560px] overflow-hidden text-white">
        <DiscoveryPhoto image={view.hero.image} priority sizes="100vw" />
        <div className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(to_bottom,rgba(6,18,38,.55)_0%,rgba(6,18,38,0)_26%,rgba(6,18,38,0)_50%,rgba(6,18,38,.72)_100%)]" />
        <div className="absolute inset-x-0 top-0 z-[3]">
          <ResultsSiteHeader appearance="overlay" activeKey="discover" />
        </div>
        <div className="absolute inset-x-0 bottom-0 z-[2] flex items-end pb-[150px] min-[901px]:pb-[120px]">
          <div className="mx-auto w-full max-w-vw-page px-4 min-[901px]:px-7">
            <p className="mb-3.5 text-[13px] opacity-90">
              <Link href="/ontdek" className="hover:underline">
                Ontdek
              </Link>
              {view.hero.breadcrumb.slice(1).map((crumb) => (
                <span key={crumb}>
                  {' '}
                  › {crumb}
                </span>
              ))}
            </p>
            <h1 className="m-0 font-vw-serif text-[76px] font-medium leading-[0.9] tracking-[-0.02em] [text-shadow:0_2px_30px_rgba(0,0,0,.25)] min-[901px]:text-[clamp(64px,11vw,168px)]">
              {view.hero.title}
            </h1>
            <p className="mt-4 max-w-[34ch] text-[17px] leading-snug min-[901px]:text-[clamp(17px,1.6vw,22px)] min-[901px]:leading-normal">
              {view.hero.intro}
            </p>
          </div>
        </div>
        <a
          href="#intro"
          className="absolute bottom-[86px] left-1/2 z-[3] flex -translate-x-1/2 flex-col items-center gap-1 text-[12.5px] font-semibold uppercase tracking-[0.08em] text-white min-[901px]:bottom-[26px]"
        >
          <span>Lees het verhaal</span>
          <span className="motion-safe:animate-bounce text-[20px]" aria-hidden>
            ↓
          </span>
        </a>
        <PhotoCredit credit={view.hero.image.credit} className="bottom-2.5 right-2.5 min-[901px]:bottom-3.5 min-[901px]:right-4" />
      </section>

      <nav className="sticky top-0 z-20 border-b border-vw-line bg-vw-bg/95 backdrop-blur-[10px]" aria-label="Op deze pagina">
        <div className="mx-auto flex max-w-vw-page items-center gap-1.5 overflow-x-auto px-4 py-2.5 [scrollbar-width:none] min-[901px]:px-7">
          {subnav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="inline-flex h-[34px] shrink-0 items-center rounded-full px-[13px] text-[13.5px] font-semibold text-[#3b4456] hover:bg-white"
            >
              {item.label}
            </a>
          ))}
          <Link
            href={view.countryHref.href}
            className="ml-auto hidden h-[34px] shrink-0 items-center rounded-full bg-vw-navy px-[13px] text-[13.5px] font-semibold text-white min-[901px]:inline-flex"
          >
            {view.countryHref.label}
          </Link>
        </div>
      </nav>

      <section id="intro" className="scroll-mt-16 py-14 min-[901px]:py-[84px] min-[901px]:pb-[70px]">
        <div className="mx-auto max-w-[760px] px-4 min-[901px]:px-7">
          <p className="mb-[18px] text-[12px] font-bold uppercase tracking-[0.14em] text-[#a17d2e]">{view.intro.kicker}</p>
          {view.intro.paragraphs.map((paragraph, index) => (
            <p
              key={paragraph.slice(0, 24)}
              className={`font-vw-serif text-[20px] font-normal leading-[1.55] text-[#1d2a40] min-[901px]:text-[clamp(21px,2vw,26px)] ${
                index === 0
                  ? 'first-letter:float-left first-letter:mr-[0.1em] first-letter:font-vw-serif first-letter:text-[4.1em] first-letter:font-medium first-letter:leading-[0.82] first-letter:text-vw-navy'
                  : 'mt-[18px]'
              }`}
            >
              {paragraph}
            </p>
          ))}
        </div>
      </section>

      {view.video ? (
        <section id="video" className="relative scroll-mt-16 overflow-hidden bg-[#071a36] py-14 text-[#e9eef7] min-[901px]:py-[84px]" aria-label="Video">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_40%,rgba(31,138,140,.28),transparent_70%)]" />
          <div className="relative mx-auto grid max-w-vw-page items-center gap-7 px-4 min-[901px]:grid-cols-[minmax(0,1fr)_minmax(0,390px)_minmax(0,1fr)] min-[901px]:gap-14 min-[901px]:px-7">
            <div>
              <p className="mb-[18px] text-[12px] font-bold uppercase tracking-[0.14em] text-vw-gold">{view.video.kicker}</p>
              <h2 className="mb-3.5 font-vw-serif text-[34px] font-medium leading-tight text-white min-[901px]:text-[44px]">
                {view.video.title}
              </h2>
              <p className="mb-0 max-w-[34ch] text-[16px] text-[#c3cde0]">{view.video.description}</p>
            </div>
            <YouTubeConsentEmbed video={view.video} />
            <div>
              <h3 className="mb-3 text-[12px] font-bold uppercase tracking-[0.14em] text-vw-gold">In dit verhaal</h3>
              <ol className="m-0 mb-[22px] list-none p-0">
                {view.chapters.map((chapter) => (
                  <li key={chapter.id}>
                    <a
                      href={`#${chapter.id}`}
                      className="flex items-baseline gap-3.5 border-b border-white/15 py-3 font-vw-serif text-[19px] font-medium leading-tight text-white no-underline min-[901px]:text-[22px]"
                    >
                      <b className="font-vw-sans text-[12px] font-semibold tracking-[0.08em] text-vw-gold">{chapter.number}</b>
                      {chapter.title}
                    </a>
                  </li>
                ))}
              </ol>
              <Link
                href={view.countryHref.href}
                className="inline-flex h-12 items-center gap-2 rounded-vw-control bg-white px-[22px] text-[15px] font-semibold text-vw-navy"
              >
                {view.countryHref.label}
                <ArrowIcon />
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      {view.chapters.map((chapter) => (
        <section key={chapter.id} id={chapter.id} className="relative scroll-mt-16" aria-labelledby={`h-${chapter.id}`}>
          <div className="sticky top-0 z-0 h-svh min-h-[560px] overflow-hidden">
            <DiscoveryPhoto image={chapter.image} sizes="100vw" />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,transparent_55%,rgba(6,18,38,.35)_100%)]" />
            <PhotoCredit credit={chapter.image.credit} className="right-3.5 top-3 min-[901px]:top-16" />
          </div>
          <div className="relative z-[2] -mt-[26svh] px-2.5 pb-14 min-[901px]:-mt-[34svh] min-[901px]:px-7 min-[901px]:pb-[90px]">
            <article className="mx-auto max-w-[720px] rounded-[22px] bg-vw-bg px-[22px] py-7 shadow-[0_-20px_60px_rgba(6,18,38,.18)] min-[901px]:rounded-[26px] min-[901px]:px-12 min-[901px]:py-10">
              <p className="mb-1.5 flex items-center gap-3 text-[12px] font-bold uppercase tracking-[0.14em] text-[#a17d2e]">
                <b className="rounded-full border border-vw-gold px-2.5 py-[3px] font-vw-serif text-[15px] font-medium normal-case tracking-normal text-vw-navy">
                  {chapter.number}
                </b>
                {chapter.kicker}
              </p>
              <h2 id={`h-${chapter.id}`} className="mb-4 font-vw-serif text-[clamp(34px,4vw,52px)] font-medium leading-none tracking-[-0.01em] text-vw-navy">
                {chapter.title}
              </h2>
              <div className="font-vw-serif text-[17.5px] leading-[1.65] text-[#26324a] min-[901px]:text-[19px]">
                {chapter.paragraphs.map((paragraph) => (
                  <p key={paragraph.slice(0, 32)} className="mb-3.5">
                    {paragraph}
                  </p>
                ))}
              </div>
              <aside className="my-[22px] border-l-[3px] border-vw-gold py-3.5 pl-[18px] text-[15px] leading-normal text-[#3b4456]">
                <b className="mb-0.5 block text-[11.5px] font-bold uppercase tracking-[0.14em] text-[#a17d2e]">Wist je dat?</b>
                {chapter.fact.text}
                <span className="sr-only"> Bron: {chapter.fact.source}.</span>
              </aside>
              <QuietLink href={chapter.results.href} label={chapter.results.label} />
            </article>
          </div>
        </section>
      ))}

      <div className="mx-auto max-w-vw-page px-4 min-[901px]:px-7">
        <section id="plekken" className="scroll-mt-16 pt-[52px] min-[901px]:pt-[70px]">
          <h2 className="m-0 font-vw-serif text-[28px] font-medium leading-tight text-vw-navy min-[901px]:text-[36px]">Mooiste plekken</h2>
          <p className="mb-5 mt-1.5 text-vw-muted">Swipe door de plekken uit dit verhaal. Elke plek linkt naar het aanbod.</p>
          <div className="-mx-4 flex gap-3.5 overflow-x-auto px-4 pb-2.5 [scrollbar-width:thin] min-[901px]:mx-[-28px] min-[901px]:px-7">
            {view.places.map((place) => (
              <article key={place.name} className="w-[62%] shrink-0 snap-start min-[901px]:w-[220px]">
                <div className="relative aspect-[4/5] overflow-hidden rounded-2xl">
                  <DiscoveryPhoto image={place.image} sizes="(max-width: 900px) 62vw, 220px" />
                </div>
                <p className="mb-0 mt-2.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[#a39a8c]">{place.regionLabel}</p>
                <h3 className="mt-0.5 font-vw-serif text-[21px] font-medium leading-tight text-vw-navy">{place.name}</h3>
                {place.results ? (
                  <Link href={place.results.href} className="mt-1 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-vw-navy">
                    {place.results.label}
                    <ArrowIcon />
                  </Link>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        <section id="regios" className="scroll-mt-16 pt-[52px] min-[901px]:pt-[70px]">
          <h2 className="m-0 font-vw-serif text-[28px] font-medium leading-tight text-vw-navy min-[901px]:text-[36px]">Regio&apos;s en plaatsen</h2>
          <p className="mb-5 mt-1.5 text-vw-muted">Klap een regio open en kies je plaats.</p>
          <div className="grid gap-3">
            {view.regions.map((region, index) => {
              return (
                <details key={region.id} className="group overflow-hidden rounded-[18px] border border-vw-line bg-vw-card" open={index === 0}>
                  <summary className="grid cursor-pointer list-none grid-cols-[84px_1fr_auto] items-center gap-3 px-2.5 py-2.5 min-[901px]:grid-cols-[120px_1fr_auto] min-[901px]:gap-4 min-[901px]:px-2.5 min-[901px]:pr-4 [&::-webkit-details-marker]:hidden">
                    <span className="relative block h-[72px] w-[84px] overflow-hidden rounded-xl min-[901px]:h-[84px] min-[901px]:w-[120px]">
                      <DiscoveryPhoto image={region.image} sizes="120px" />
                    </span>
                    <span className="flex flex-col">
                      <span className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#a39a8c]">Regio · niveau 2</span>
                      <b className="font-vw-serif text-[21px] font-medium leading-tight text-vw-navy">{region.name}</b>
                      <span className="text-[13px] text-vw-muted">
                        {region.places.length === 1 ? '1 plek · niveau 3' : `${region.places.length} plekken · niveau 3`}
                      </span>
                    </span>
                    <span className="text-[22px] text-vw-navy transition group-open:rotate-180" aria-hidden>
                      ⌄
                    </span>
                  </summary>
                  <div className="px-4 pb-4 min-[901px]:pl-[146px] min-[901px]:pr-[18px]">
                    <p className="mb-2.5 mt-0 text-[#475569]">{region.summary}</p>
                    <ul className="m-0 mb-3.5 list-none p-0">
                      {region.places.map((place) => (
                        <li key={place.name} className="flex flex-col items-start gap-0.5 border-t border-[#eee7da] py-[9px] min-[901px]:flex-row min-[901px]:items-center min-[901px]:justify-between min-[901px]:gap-3">
                          <b>{place.name}</b>
                          {place.results ? (
                            <Link href={place.results.href} className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-vw-navy">
                              {place.results.label}
                              <ArrowIcon />
                            </Link>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                    {region.results ? (
                      <Link
                        href={region.results.href}
                        className="inline-flex h-[42px] items-center gap-2 rounded-full bg-vw-navy px-4 text-[14px] font-semibold text-white"
                      >
                        {region.results.label}
                        <ArrowIcon />
                      </Link>
                    ) : null}
                  </div>
                </details>
              );
            })}
          </div>
        </section>

        {view.practical ? (
          <section id="praktisch" className="scroll-mt-16 pt-[52px] min-[901px]:pt-[70px]">
            <h2 className="m-0 font-vw-serif text-[28px] font-medium leading-tight text-vw-navy min-[901px]:text-[36px]">Goed om te weten</h2>
            <p className="mb-5 mt-1.5 text-vw-muted">{view.practical.lead}</p>
            <div className="grid gap-8 border-y border-vw-line py-8 min-[901px]:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] min-[901px]:gap-14">
              <div>
                <h3 className="m-0 font-vw-serif text-[22px] font-medium text-vw-navy">
                  {view.practical.bestPeriod.title}
                  {view.practical.bestPeriod.placeholder ? <PlaceholderMark /> : null}
                </h3>
                <p className="mb-1 mt-1 text-vw-muted">{view.practical.bestPeriod.note}</p>
                {view.practical.bestPeriod.rows.map((row) => (
                  <div key={row.label} className="mt-2 grid grid-cols-[62px_repeat(12,minmax(0,1fr))] items-center gap-[3px] min-[901px]:grid-cols-[96px_repeat(12,minmax(0,1fr))] min-[901px]:gap-1">
                    <span className="text-[11.5px] font-semibold text-vw-navy min-[901px]:text-[13px]">{row.label}</span>
                    {row.months.map((level, month) => (
                      <span
                        key={`${row.label}-${month}`}
                        title={MONTHS[month]}
                        className={`flex h-7 items-center justify-center rounded-[5px] text-[10px] font-semibold min-[901px]:h-[34px] min-[901px]:rounded-[7px] min-[901px]:text-[11px] ${SEASON_CLASS[level]}`}
                      >
                        {MONTHS[month]}
                      </span>
                    ))}
                  </div>
                ))}
                <div className="mt-3 flex flex-wrap gap-3.5 text-[12px] text-vw-muted">
                  <span><i className="mr-1 inline-block h-3 w-3 rounded-[3px] bg-vw-green align-[-2px]" />beste</span>
                  <span><i className="mr-1 inline-block h-3 w-3 rounded-[3px] bg-[#cfe3c0] align-[-2px]" />goed</span>
                  <span><i className="mr-1 inline-block h-3 w-3 rounded-[3px] bg-[#e9e1bf] align-[-2px]" />kan</span>
                  <span><i className="mr-1 inline-block h-3 w-3 rounded-[3px] bg-[#efe8da] align-[-2px]" />minder</span>
                </div>
              </div>
              <div>
                <h3 className="m-0 font-vw-serif text-[22px] font-medium text-vw-navy">
                  {view.practical.factsTitle}
                  <PlaceholderMark />
                </h3>
                <dl className="m-0 mt-1">
                  {view.practical.facts.map((fact) => (
                    <div key={fact.label} className="flex items-start justify-between gap-3 border-t border-[#eee7da] py-[11px] first:border-t">
                      <dt className="text-[14px] text-vw-muted">{fact.label}</dt>
                      <dd className="m-0 text-right text-[14px] font-semibold text-vw-navy">
                        {fact.value}
                        {fact.placeholder ? <PlaceholderMark /> : null}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </section>
        ) : null}
      </div>

      <section className="relative mt-14 h-[80svh] min-h-[460px] overflow-hidden text-white min-[901px]:mt-20 min-[901px]:h-[78svh]">
        <DiscoveryPhoto image={view.finalCta.image} sizes="100vw" />
        <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(6,18,38,.75),rgba(6,18,38,.05)_65%)]" />
        <div className="absolute inset-x-0 bottom-0 z-[2] px-4 pb-24 min-[901px]:px-7 min-[901px]:pb-16">
          <div className="mx-auto max-w-vw-page">
            <h2 className="m-0 max-w-[16ch] font-vw-serif text-[clamp(36px,5vw,64px)] font-medium leading-none">{view.finalCta.title}</h2>
            <p className="mb-[22px] mt-3 max-w-[52ch] text-[16px] opacity-95">{view.finalCta.text}</p>
            <Link
              href={view.finalCta.results.href}
              className="hidden h-[54px] items-center gap-2 rounded-vw-control bg-white px-[22px] text-[16px] font-semibold text-vw-navy min-[901px]:inline-flex"
            >
              {view.finalCta.results.label}
              <ArrowIcon />
            </Link>
          </div>
        </div>
        <PhotoCredit credit={view.finalCta.image.credit} className="bottom-3 right-3.5 z-[3]" />
      </section>

      <div className="mx-auto max-w-vw-page px-4 pb-28 pt-10 min-[901px]:px-7 min-[901px]:pb-16">
        <h2 className="mb-3 font-vw-serif text-[22px] font-medium text-vw-navy">Andere bestemmingen</h2>
        <div className="flex flex-wrap gap-2">
          {view.other.map((chip) => (
            <Link
              key={chip.label}
              href={chip.href}
              className="inline-flex h-10 items-center gap-1.5 rounded-full border border-vw-line bg-white px-4 text-[14px] font-semibold text-vw-navy"
            >
              {chip.label}
              {chip.isNew ? (
                <em className="rounded bg-[#f6ecd6] px-1 text-[10px] font-bold uppercase not-italic tracking-wide text-[#8a6a1c]">nieuw</em>
              ) : null}
            </Link>
          ))}
        </div>
        <footer className="mt-10 flex flex-wrap gap-[18px] border-t border-vw-line py-[22px] text-[13px] text-vw-muted">
          <span>© VacationWeb</span>
          <Link href="/privacy" className="hover:text-vw-navy">Privacybeleid</Link>
          <Link href="/cookies" className="hover:text-vw-navy">Cookiebeleid</Link>
          <Link href="/cookie-settings" className="hover:text-vw-navy">Cookie-instellingen</Link>
        </footer>
      </div>

      <Link
        href={view.countryHref.href}
        className="fixed inset-x-3 bottom-[calc(12px+env(safe-area-inset-bottom))] z-[60] inline-flex h-[52px] items-center justify-center gap-2 rounded-[14px] bg-vw-navy text-[15px] font-semibold text-white shadow-[0_10px_30px_rgba(10,30,60,.35)] min-[901px]:hidden"
      >
        {view.countryHref.label}
        <ArrowIcon />
      </Link>
    </div>
  );
}
