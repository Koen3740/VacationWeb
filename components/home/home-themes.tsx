import { HomeTheme } from '@/lib/offers/derive-home-themes';
import { HomePhotoCardLink } from '@/components/home/home-photo-card-link';
import { RESULTS_MUTED, RESULTS_NAVY } from '@/components/results-v2/results-design-tokens';

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
    href: '/results',
  },
  {
    id: 'familievakantie',
    title: 'Familievakantie',
    image: '/images/vacation-types/familievakantie.png',
    href: '/results?vacationTypes=Familie',
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
    href: '/results?vacationTypes=Adults%20Only',
  },
] as const;

export function HomeThemes({ themes: _themes }: HomeThemesProps) {
  return (
    <section className="mx-auto max-w-[1200px] px-6 py-12 lg:px-8 lg:py-14">
      <div className="max-w-2xl">
        <h2 className="text-[22px] font-bold tracking-tight sm:text-[26px]" style={{ color: RESULTS_NAVY }}>
          Vakantietypes
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed sm:text-[16px]" style={{ color: RESULTS_MUTED }}>
          Weet je nog niet precies waarheen? Ontdek vakanties op basis van jouw voorkeuren.
        </p>
      </div>

      <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
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
