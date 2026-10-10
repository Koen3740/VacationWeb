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
function labRoomHref(roomId: string, variant: string | undefined): string {
  const query = new URLSearchParams();
  if (variant) {
    query.set('variant', variant);
  }
  query.set('room', roomId);
  return `/detail-lab?${query.toString()}`;
}

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
  const tripDate = typeof searchParams.tripDate === 'string' ? searchParams.tripDate : undefined;
  const selectedRoom = rooms.find((room) => room.id === (params.selectedRoom ?? searchParams.room))
    ?? rooms.find((room) => room.included)
    ?? rooms[0]
    ?? null;
  // Fixture totals are for 2 adults, 1 room, the offer date. Another composition has no fixture total.
  const fixtureParty =
    (params.adults ?? 2) === 2
    && !(params.childAges && params.childAges.length > 0)
    && (params.rooms ?? 1) <= 1
    && !(tripDate && tripDate !== offer.departureDate);
  const unavailable = searchParams.composition === 'unavailable' || !fixtureParty;

  return (
    <OfferDetailContent
      offer={unavailable ? { ...offer, liveTotalPrice: undefined, livePriceStatus: 'unavailable' } : offer}
      params={params}
      resultsHref="/results"
      galleryImages={images}
      rooms={rooms}
      selectedRoom={selectedRoom}
      roomHref={rondreis ? undefined : (roomId) => labRoomHref(roomId, searchParams.variant)}
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
      tripDate={tripDate}
      roomQuotes={
        rondreis || unavailable
          ? null
          : [
              {
                id: 'DZZ',
                name: 'Tweepersoonskamer Zeezicht',
                capacityText: 'geschikt voor 2 personen',
                totalPrice: 2215.5,
              },
              {
                id: 'JS2',
                name: 'Junior Suite',
                capacityText: 'geschikt voor 2 tot 3 personen max. 2 volwassenen en 1 kind t/m 12 jaar',
                totalPrice: 2480,
              },
              {
                id: 'FK4',
                name: 'Familiekamer',
              },
            ]
      }
      compositionFailed={unavailable}
      presentable={unavailable ? false : !selectedRoom || selectedRoom.included}
    />
  );
}
