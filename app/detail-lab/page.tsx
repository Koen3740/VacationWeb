import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { OfferDetailContent } from '@/components/offers/offer-detail-content';
import {
  hotelLabImages,
  hotelLabOffer,
  hotelLabRooms,
  LAB_GALLERY_NOTE,
  LAB_PARAMS,
  rondreisLabImages,
  rondreisLabOffer,
} from './fixtures';

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
  const offer = rondreis ? rondreisLabOffer : hotelLabOffer;
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
      sections={[]}
      intro={undefined}
      presentable
      themes={rondreis ? ['Cultuur & steden', 'Rondreis'] : ['Strandvakantie', 'Familie', 'Zwembad']}
      isLastMinute={!rondreis}
      galleryNote={LAB_GALLERY_NOTE}
    />
  );
}
