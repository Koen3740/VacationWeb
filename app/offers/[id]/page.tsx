import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadOffers } from '@/lib/offers/load-offers';

export const dynamic = 'force-dynamic';

export default function OfferDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const offer = loadOffers().find((item) => item.id === params.id);

  if (!offer) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8">
        <Link
          href="/results"
          className="text-sm font-semibold text-brand-700"
        >
          ← Terug naar resultaten
        </Link>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
            <div className="relative h-[420px] w-full">
              <Image
                src={offer.imageUrl}
                alt={offer.hotelName}
                fill
                className="object-cover"
              />
            </div>

            <div className="p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-brand-700">
                    {offer.provider}
                  </p>

                  <h1 className="mt-2 text-3xl font-semibold text-slate-950">
                    {offer.hotelName}
                  </h1>

                  <p className="mt-2 text-slate-600">
                    {offer.destinationCity && `${offer.destinationCity}, `}
                    {offer.destinationRegion}
                    {offer.destinationRegion ? ', ' : ''}
                    {offer.destinationCountry}
                  </p>
                </div>

                <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                  ⭐ {offer.stars ?? '-'}
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-2 text-sm text-slate-600">
                <span className="rounded-full bg-slate-100 px-3 py-1">
                  {offer.accommodationType || offer.accommodation || 'Hotel'}
                </span>

                <span className="rounded-full bg-slate-100 px-3 py-1">
                  {offer.boardType || '-'}
                </span>

                <span className="rounded-full bg-slate-100 px-3 py-1">
                  {offer.nights} nachten
                </span>

                {offer.departureDate && (
                  <span className="rounded-full bg-slate-100 px-3 py-1">
                    Vertrek: {offer.departureDate}
                  </span>
                )}

                {offer.rating && (
                  <span className="rounded-full bg-slate-100 px-3 py-1">
                    Score {offer.rating}
                  </span>
                )}
              </div>

              {(offer.descriptionShort || offer.descriptionLong) && (
                <div className="mt-8 space-y-4">
                  {offer.descriptionShort && (
                    <p className="text-base leading-7 text-slate-700">
                      {offer.descriptionShort}
                    </p>
                  )}

                  {offer.descriptionLong && (
                    <p className="text-base leading-7 text-slate-600">
                      {offer.descriptionLong}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-700">
                Prijsoverzicht
              </p>

              <div className="mt-6 flex items-end justify-between">
                <div>
                  <p className="text-sm text-slate-500">
                    Totaalprijs
                  </p>

                  <p className="text-4xl font-semibold text-slate-950">
                    €{offer.price}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-sm text-slate-500">
                    Prijs per dag
                  </p>

                  <p className="text-2xl font-semibold text-brand-700">
                    €{offer.pricePerDay}
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-3 text-sm">
                <div className="flex justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <span>Vertrek</span>
                  <span className="font-semibold">
                    {offer.departureAirport || '-'}
                  </span>
                </div>

                <div className="flex justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <span>Vertrekdatum</span>
                  <span className="font-semibold">
                    {offer.departureDate || '-'}
                  </span>
                </div>

                <div className="flex justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <span>Bestemming</span>
                  <span className="font-semibold">
                    {offer.destinationCity || offer.destinationRegion}
                  </span>
                </div>

                <div className="flex justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <span>Verzorging</span>
                  <span className="font-semibold">
                    {offer.boardType || '-'}
                  </span>
                </div>

                <div className="flex justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <span>Type accommodatie</span>
                  <span className="font-semibold">
                    {offer.accommodationType || '-'}
                  </span>
                </div>

                <div className="flex justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <span>Beoordeling</span>
                  <span className="font-semibold">
                    {offer.rating ?? '-'}
                  </span>
                </div>
              </div>

              <a
                href={offer.deepLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-8 inline-flex w-full justify-center rounded-full bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
              >
                Bekijk aanbieding bij {offer.provider}
              </a>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}