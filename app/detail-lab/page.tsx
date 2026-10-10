import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { OfferDetailContent } from '@/components/offers/offer-detail-content';
import { collectThemeLabels } from '@/lib/offers/offer-detail-view';
import { parseSearchParams } from '@/lib/search/parse-search-params';
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
  searchParams: Record<string, string | string[] | undefined> & {
    variant?: string;
    room?: string;
    composition?: string;
    tripDate?: string;
  };
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
  const rooms = rondreis ? [] : hotelLabRooms;
  const parsed = parseSearchParams(searchParams);
  const params = {
    ...LAB_PARAMS,
    adults: parsed.adults ?? LAB_PARAMS.adults,
    children: parsed.children,
    babies: parsed.babies,
    rooms: parsed.rooms ?? LAB_PARAMS.rooms,
    childAges: parsed.childAges,
    party: parsed.party ?? LAB_PARAMS.party,
    selectedRoom: parsed.selectedRoom,
  };
  const selectedRoom = rooms.find((room) => room.included) ?? rooms[0] ?? null;
  // Fixture total is the 2-adult price. Another composition has no fixture total.
  const fixtureParty =
    (params.adults ?? 2) === 2
    && !(params.childAges && params.childAges.length > 0)
    && (params.rooms ?? 1) <= 1;
  const unavailable = searchParams.composition === 'unavailable' || !fixtureParty;

  return (
    <OfferDetailContent
      offer={unavailable ? { ...offer, liveTotalPrice: undefined, livePriceStatus: 'unavailable' } : offer}
      params={params}
      resultsHref="/results"
      galleryImages={images}
      rooms={rooms}
      selectedRoom={selectedRoom}
      sections={
        sunwebCopy
          ? [{ title: 'Ligging', items: ['Aan de jachthaven<br />Rustige omgeving'] }]
          : []
      }
      intro={sunwebCopy ? 'Eerste indruk van het hotel.&lt;br /&gt;Tweede indruk.' : undefined}
      themes={
        sunwebCopy
          ? collectThemeLabels(offer)
          : rondreis
            ? ['Cultuur & steden', 'Rondreis']
            : ['Strandvakantie', 'Familie', 'Zwembad']
      }
      isLastMinute={!rondreis}
      galleryNote={LAB_GALLERY_NOTE}
      adjustPath="/detail-lab"
      compositionFailed={unavailable}
      presentable={unavailable ? false : !selectedRoom || selectedRoom.included}
    />
  );
}
