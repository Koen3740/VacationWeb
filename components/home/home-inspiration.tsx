import Image from 'next/image';
import Link from 'next/link';
import {
  RESULTS_BORDER,
  RESULTS_CARD_BG,
  RESULTS_CARD_SHADOW,
  RESULTS_MUTED,
  RESULTS_NAVY,
} from '@/components/results-v2/results-design-tokens';

const INSPIRATION_CARDS = [
  {
    id: 'mallorca',
    title: 'Mallorca',
    teaser: 'Mediterrane baaien, dorpjes in het binnenland en zonzekere stranden.',
    cta: 'Ontdek Mallorca',
    imageSrc: '/images/destinations/spanje.jfif',
    href: '/results?country=Spanje&region=Mallorca',
  },
  {
    id: 'rome',
    title: 'Rome',
    teaser: 'Cultuur, geschiedenis en sfeervolle buurten in het hart van Italië.',
    cta: 'Ontdek Rome',
    imageSrc: '/images/vacation-types/familievakantie.jpg',
    href: '/results?country=Itali%C3%AB',
  },
  {
    id: 'toscane',
    title: 'Toscane',
    teaser: 'Heuvels, wijngaarden en charmante steden voor een rustige vakantie.',
    cta: 'Ontdek Toscane',
    imageSrc: '/images/vacation-types/starndvakantie.jpg',
    href: '/results?country=Itali%C3%AB&region=Toscane',
  },
] as const;

export function HomeInspiration() {
  return (
    <section id="inspiratie" className="mx-auto max-w-[1600px] px-6 py-10 lg:px-8 lg:py-12">
      <div className="max-w-2xl">
        <h2 className="text-[22px] font-bold tracking-tight" style={{ color: RESULTS_NAVY }}>
          Laat je inspireren
        </h2>
        <p className="mt-1.5 text-[14px] leading-relaxed" style={{ color: RESULTS_MUTED }}>
          Kijk rond, ontdek nieuwe bestemmingen en vind een vakantie die bij je past.
        </p>
      </div>

      <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
        {INSPIRATION_CARDS.map((card) => (
          <li key={card.id}>
            <article
              className="flex h-full flex-col overflow-hidden rounded-[16px] border"
              style={{
                backgroundColor: RESULTS_CARD_BG,
                borderColor: RESULTS_BORDER,
                boxShadow: RESULTS_CARD_SHADOW,
              }}
            >
              <div className="relative aspect-[16/10] w-full overflow-hidden">
                <Image
                  src={card.imageSrc}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover object-center"
                  unoptimized={card.imageSrc.toLowerCase().endsWith('.jfif')}
                />
              </div>
              <div className="flex flex-1 flex-col px-4 py-4 sm:px-5 sm:py-5">
                <h3 className="text-[17px] font-bold tracking-tight text-[#0A2D62]">{card.title}</h3>
                <p className="mt-1.5 flex-1 text-[13.5px] leading-relaxed text-[#475569]">{card.teaser}</p>
                <Link
                  href={card.href}
                  className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-[12px] bg-[#89ACD3] px-4 text-[14px] font-semibold text-white transition hover:bg-[#7A9DC4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E66F5] sm:w-fit"
                >
                  {card.cta}
                </Link>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}
