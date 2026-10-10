import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { OfferDetailContent } from '@/components/offers/offer-detail-content';
import { collectThemeLabels } from '@/lib/offers/offer-detail-view';
import {
  hotelLabImages,
  hotelLabOffer,
  hotelLabRooms,
  LAB_GALLERY_NOTE,
  LAB_PARAMS,
  rondreisLabImages,
  rondreisLabOffer,
} from './fixtures';
import type { TravelOffer } from '@/types/travel';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Detailweergave (voorbeeld)',
  robots: { index: false, follow: false },
};

/**
 * Local visual harness for the detail redesign.
 * Returns 404 in production so fixture offers are not a public route.
 */
export default function DetailLabPage({
  searchParams,
}: {
  searchParams: { variant?: string };
}) {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  const rondreis = searchParams.variant === 'rondreis';
  const sunwebCopy = searchParams.variant === 'sunweb';
  const sunwebOffer: TravelOffer = {
    ...hotelLabOffer,
    hotelName: 'SOL Puerto Marina',
    accommodationType: 'Hotel',
    accommodation: '40348',
    descriptionShort:
      'Direct aan de haven van Benalmádena.<br />Het zwembad ligt in de tuin.<br /><br />De kamers hebben een balkon.',
    subcategories: 'Familie, [object Object], Zwembad',
    categories: [{ label: 'Adults only' }, { id: 40348 }] as unknown as string[],
  };
  const offer = rondreis ? rondreisLabOffer : sunwebCopy ? sunwebOffer : hotelLabOffer;
  const images = rondreis ? rondreisLabImages : hotelLabImages;
  const selectedRoom = rondreis ? null : hotelLabRooms[0];

  return (
    <OfferDetailContent
      offer={offer}
      params={LAB_PARAMS}
      resultsHref="/results"
      galleryImages={images}
      rooms={rondreis ? [] : hotelLabRooms}
      selectedRoom={selectedRoom}
      sections={
        sunwebCopy
          ? [{ title: 'Ligging', items: ['Aan de jachthaven<br />Rustige omgeving'] }]
          : []
      }
      intro={sunwebCopy ? 'Eerste indruk van het hotel.&lt;br /&gt;Tweede indruk.' : undefined}
      presentable
      themes={
        sunwebCopy
          ? collectThemeLabels(offer)
          : rondreis
            ? ['Cultuur & steden', 'Rondreis']
            : ['Strandvakantie', 'Familie', 'Zwembad']
      }
      isLastMinute={!rondreis}
      galleryNote={LAB_GALLERY_NOTE}
    />
  );
}
