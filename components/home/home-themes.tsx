import { HomeTheme } from '@/lib/offers/derive-home-themes';
import { HomePhotoCardLink } from '@/components/home/home-photo-card-link';

type HomeThemesProps = {
  themes: HomeTheme[];
};

const VACATION_TYPES = [
  {
    id: 'all-inclusive',
    title: 'All inclusive',
    image: '/images/vacation-types/all-inclusive.png',
    href: '/results?boardTypes=All%20Inclusive,Ultra%20All%20Inclusive',
  },
  {
    id: 'strandvakantie',
    title: 'Strandvakantie',
    image: '/images/vacation-types/strandvakantie.png',
    href: '/results?sort=value',
  },
  {
    id: 'familievakantie',
    title: 'Familievakantie',
    image: '/images/vacation-types/familievakantie.png',
    href: '/results?sort=value',
  },
  {
    id: 'last-minute',
    title: 'Last minute',
    image: '/images/vacation-types/last-minute.png',
    href: '/results?sort=price',
  },
  {
    id: 'adults-only',
    title: 'Adults Only',
    image: '/images/vacation-types/adults-only.png',
    href: '/results?sort=value',
  },
] as const;

export function HomeThemes({ themes: _themes }: HomeThemesProps) {
  return (
    <section className="mx-auto max-w-[1200px] px-4 py-14 sm:px-5 lg:px-6">
      <div className="max-w-2xl">
        <h2 className="text-[28px] font-bold tracking-[-0.02em] text-[#0A2D62] sm:text-[32px]">
          Vakantietypes
        </h2>
        <p className="mt-3 text-[17px] leading-relaxed text-slate-600">
          Weet je nog niet precies waarheen? Ontdek vakanties op basis van jouw voorkeuren.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-5 gap-3 sm:gap-4">
        {VACATION_TYPES.map((type) => (
          <HomePhotoCardLink
            key={type.id}
            href={type.href}
            imageSrc={type.image}
            title={type.title}
          />
        ))}
      </div>
    </section>
  );
}
