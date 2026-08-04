import Image from 'next/image';
import Link from 'next/link';
import { TravelOffer } from '@/types/travel';

export function TravelCard({ offer }: { offer: TravelOffer }) {
  return (
    <article className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
      <div className="relative h-56 w-full">
        <Image
          src={offer.imageUrl}
          alt={offer.hotelName}
          fill
          className="object-cover"
        />
      </div>

      <div className="p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-brand-700">
              {offer.provider}
            </p>

            <h3 className="mt-1 text-xl font-semibold text-slate-950">
              {offer.hotelName}
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              {offer.destinationCity &&
                `${offer.destinationCity}, `}
              {offer.destinationRegion}
              {offer.destinationRegion ? ', ' : ''}
              {offer.destinationCountry}
            </p>
          </div>

          <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
            ⭐ {offer.stars ?? '-'}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-sm text-slate-600">
          {offer.accommodationType && (
            <span className="rounded-full bg-slate-100 px-3 py-1">
              {offer.accommodationType}
            </span>
          )}

          {offer.boardType && (
            <span className="rounded-full bg-slate-100 px-3 py-1">
              {offer.boardType}
            </span>
          )}

          <span className="rounded-full bg-slate-100 px-3 py-1">
            {offer.nights} nachten
          </span>

          {offer.departureDate && (
            <span className="rounded-full bg-slate-100 px-3 py-1">
              {offer.departureDate}
            </span>
          )}
        </div>

        {offer.descriptionShort && (
          <p className="mt-4 line-clamp-2 text-sm leading-6 text-slate-600">
            {offer.descriptionShort}
          </p>
        )}

        <div className="mt-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">
              Beoordeling
            </p>

            <p className="text-lg font-semibold text-slate-950">
              {offer.rating ?? '-'}
            </p>

            <p className="text-sm text-slate-500">
              €{offer.pricePerDay} / dag
            </p>
          </div>

          <div className="text-right">
            <p className="text-sm text-slate-500">
              Vanaf
            </p>

            <p className="text-2xl font-semibold text-slate-950">
              €{offer.price}
            </p>
          </div>
        </div>

        <Link
          href={`/offers/${offer.id}`}
          className="mt-6 inline-flex rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          Bekijk aanbieding
        </Link>
      </div>
    </article>
  );
}