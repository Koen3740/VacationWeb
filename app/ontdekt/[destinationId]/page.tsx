import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DestinationBudget } from '@/components/destination/destination-budget';
import { DestinationChapter } from '@/components/destination/destination-chapter';
import { DestinationChapterNav } from '@/components/destination/destination-chapter-nav';
import { DestinationCompareCta } from '@/components/destination/destination-compare-cta';
import { DestinationDesire } from '@/components/destination/destination-desire';
import { DestinationEssence } from '@/components/destination/destination-essence';
import { DestinationGallery } from '@/components/destination/destination-gallery';
import { DestinationHero } from '@/components/destination/destination-hero';
import { DestinationHighlights } from '@/components/destination/destination-highlights';
import { DestinationPlaces } from '@/components/destination/destination-places';
import { DestinationPractical } from '@/components/destination/destination-practical';
import { DestinationWowInterrupt } from '@/components/destination/destination-wow-interrupt';
import { ResultsSiteHeader } from '@/components/results-v2/results-site-header';
import { buildDestinationPageModel } from '@/lib/discover/build-destination-page-model';
import {
  buildDestinationExperienceModel,
  hasDestinationExperience,
} from '@/lib/discover/destination-experience-registry';
import type { DestinationExperienceModel } from '@/lib/discover/destination-experience-types';
import { getDiscoverDestinationById } from '@/lib/discover/discover-pool';
import type { Metadata } from 'next';

type PageProps = {
  params: { destinationId: string };
};

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function generateMetadata({ params }: PageProps): Metadata {
  const dest = getDiscoverDestinationById(params.destinationId);
  if (!dest) return { title: 'Ontdekking | VacationWeb' };
  return {
    title: `${dest.name} | Vandaag ontdekt | VacationWeb`,
    description: dest.teaser,
  };
}

function DestinationExperiencePage({ model }: { model: DestinationExperienceModel }) {
  const {
    destination,
    heroSrc,
    essenceTitle,
    essence,
    why,
    chapters,
    wow,
    wowCaption,
    desire,
    practical,
    budget,
    resultsHref,
    earlyBridgeLabel,
  } = model;

  return (
    <div className="min-h-screen overflow-x-clip bg-[#FBF6F0]">
      <ResultsSiteHeader />
      <main>
        <DestinationHero name={destination.name} teaser={destination.teaser} imageSrc={heroSrc} />

        <div className="mx-auto w-[86.8vw] px-4 py-8 sm:px-6 lg:px-0 lg:py-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/#ontdekt"
              className="text-[13px] font-medium text-[#0A2D62] hover:underline"
            >
              ← Terug naar ontdekkingen
            </Link>
            <DestinationCompareCta
              href={resultsHref}
              destinationName={destination.name}
              size="sm"
            />
          </div>

          <DestinationEssence
            title={essenceTitle}
            essence={essence}
            why={why}
            earlyBridgeHref={resultsHref}
            earlyBridgeLabel={earlyBridgeLabel}
          />

          <DestinationChapterNav
            items={chapters.map((c) => ({ id: c.id, title: c.title }))}
          />

          {chapters.map((chapter) => (
            <DestinationChapter
              key={chapter.id}
              chapter={chapter}
              resultsHref={resultsHref}
            />
          ))}

          {wow ? <DestinationWowInterrupt media={wow} caption={wowCaption} /> : null}

          <DestinationDesire title={desire.title} body={desire.body} media={desire.media} />

          <DestinationPractical title={practical.title} items={practical.items} />

          <DestinationBudget title={budget.title} body={budget.body} />

          <div className="mt-10 flex justify-center pb-4">
            <DestinationCompareCta href={resultsHref} destinationName={destination.name} />
          </div>
        </div>
      </main>
    </div>
  );
}

/**
 * Destination Page — C2 experience for Albania (P10) + Sicily (P11) + Crete (P12) + Sardinia (P13).
 */
export default function DiscoverDestinationPage({ params }: PageProps) {
  const id = params.destinationId?.toLowerCase?.() ?? params.destinationId;

  if (hasDestinationExperience(id)) {
    const model = buildDestinationExperienceModel(id);
    if (!model) notFound();
    return <DestinationExperiencePage model={model} />;
  }

  const model = buildDestinationPageModel(params.destinationId);
  if (!model) notFound();

  const { destination, heroSrc, intro, highlights, places, gallery, resultsHref } = model;

  return (
    <div className="min-h-screen bg-[#FBF6F0]">
      <ResultsSiteHeader />
      <main>
        <DestinationHero name={destination.name} teaser={destination.teaser} imageSrc={heroSrc} />

        <div className="mx-auto w-[86.8vw] px-4 py-8 sm:px-6 lg:px-0 lg:py-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/#ontdekt"
              className="text-[13px] font-medium text-[#0A2D62] hover:underline"
            >
              ← Terug naar ontdekkingen
            </Link>
            <DestinationCompareCta
              href={resultsHref}
              destinationName={destination.name}
              size="sm"
            />
          </div>

          <DestinationHighlights items={highlights} />
          <DestinationPlaces destinationName={destination.name} places={places} />
          <DestinationGallery
            destinationName={destination.name}
            intro={intro}
            items={gallery.map((g) => ({
              assetId: g.assetId,
              src: g.src,
              placeLabel: g.placeLabel,
            }))}
          />

          <div className="mt-10 flex justify-center">
            <DestinationCompareCta href={resultsHref} destinationName={destination.name} />
          </div>
        </div>
      </main>
    </div>
  );
}