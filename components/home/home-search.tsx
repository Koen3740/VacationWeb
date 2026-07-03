'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

type HomeSearchProps = {
  countries: string[];
};

export function HomeSearch({ countries }: HomeSearchProps) {
  const [country, setCountry] = useState(countries[0] ?? '');
  const [departureStart, setDepartureStart] = useState('2026-07-10');
  const [departureEnd, setDepartureEnd] = useState('2026-08-15');
  const [adults, setAdults] = useState(2);

  const searchHref = useMemo(() => {
    const params = new URLSearchParams({
      country,
      departureStart,
      departureEnd,
      adults: adults.toString(),
    });

    return `/results?${params.toString()}`;
  }, [adults, country, departureEnd, departureStart]);

  return (
    <div className="w-full max-w-4xl rounded-2xl border border-white/20 bg-white/95 p-2 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.45)] backdrop-blur-md">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-stretch">
        <label className="flex min-w-0 flex-1 flex-col justify-center rounded-xl px-4 py-3 transition hover:bg-stone-50">
          <span className="text-xs font-medium text-stone-500">Bestemming</span>
          <div className="mt-1 flex items-center gap-2">
            <span aria-hidden="true" className="text-base">📍</span>
            <select
              value={country}
              onChange={(event) => setCountry(event.target.value)}
              className="w-full cursor-pointer bg-transparent text-sm font-medium text-stone-900 outline-none"
            >
              {countries.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </select>
          </div>
        </label>

        <div className="hidden w-px self-stretch bg-stone-200 lg:block" aria-hidden="true" />

        <div className="flex min-w-0 flex-1 flex-col justify-center rounded-xl px-4 py-3 transition hover:bg-stone-50">
          <span className="text-xs font-medium text-stone-500">Vertrekperiode</span>
          <div className="mt-1 flex items-center gap-2">
            <span aria-hidden="true" className="text-base">📅</span>
            <div className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium text-stone-900">
              <input
                type="date"
                value={departureStart}
                onChange={(event) => setDepartureStart(event.target.value)}
                className="min-w-0 flex-1 cursor-pointer bg-transparent outline-none"
              />
              <span className="text-stone-400">–</span>
              <input
                type="date"
                value={departureEnd}
                onChange={(event) => setDepartureEnd(event.target.value)}
                className="min-w-0 flex-1 cursor-pointer bg-transparent outline-none"
              />
            </div>
          </div>
        </div>

        <div className="hidden w-px self-stretch bg-stone-200 lg:block" aria-hidden="true" />

        <label className="flex min-w-[140px] flex-col justify-center rounded-xl px-4 py-3 transition hover:bg-stone-50">
          <span className="text-xs font-medium text-stone-500">Reizigers</span>
          <div className="mt-1 flex items-center gap-2">
            <span aria-hidden="true" className="text-base">👥</span>
            <input
              type="number"
              min={1}
              max={9}
              value={adults}
              onChange={(event) => setAdults(Number(event.target.value))}
              className="w-full bg-transparent text-sm font-medium text-stone-900 outline-none"
            />
          </div>
        </label>

        <Link
          href={searchHref}
          className="inline-flex items-center justify-center rounded-xl bg-stone-900 px-8 py-4 text-sm font-medium text-white transition hover:bg-stone-800 lg:px-10"
        >
          Zoeken
        </Link>
      </div>
    </div>
  );
}
