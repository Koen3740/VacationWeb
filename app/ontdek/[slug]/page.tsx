import { DestinationLongread } from '@/components/discovery/destination-longread';
import { DESTINATIONS, getDestination, listLongreads } from '@/content/destinations';
import { buildDestinationView } from '@/lib/discovery/model';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

type PageProps = {
  params: { slug: string };
};

export function generateStaticParams() {
  return listLongreads().map((destination) => ({ slug: destination.slug }));
}

export function generateMetadata({ params }: PageProps): Metadata {
  const destination = getDestination(params.slug);
  if (!destination?.longread) return { title: 'Bestemming | VacationWeb' };
  return {
    title: `${destination.name} | Ontdek | VacationWeb`,
    description: destination.hero?.intro,
  };
}

export default function DestinationPage({ params }: PageProps) {
  const destination = getDestination(params.slug);
  if (!destination) notFound();
  const view = buildDestinationView(destination, DESTINATIONS);
  if (!view) notFound();
  return <DestinationLongread view={view} />;
}
