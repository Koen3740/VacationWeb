"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { DURATION_MAX, DURATION_MIN } from '@/components/search/duration-popup/duration-popup-utils';
import {
  loadSharedSearchState,
  mergeSharedStateIntoSearchForm,
  saveSharedSearchState,
  sharedStateFromSearchForm,
} from '@/components/search/shared-search-state';
import { FilterOptions } from '@/types/travel';

type IncomingSearchParams = Record<string, string | string[] | undefined>;

function getParamString(params: IncomingSearchParams | undefined, key: string): string | undefined {
  const value = params?.[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function getParamNumber(params: IncomingSearchParams | undefined, key: string): number | undefined {
  const raw = getParamString(params, key);
  const parsed = raw !== undefined ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}

function defaultDepartureWindow(): { departureStart: string; departureEnd: string } {
  const toIsoDate = (date: Date) => date.toISOString().slice(0, 10);
  const start = new Date();
  start.setDate(start.getDate() + 14);
  const end = new Date(start);
  end.setDate(end.getDate() + 35);

  return { departureStart: toIsoDate(start), departureEnd: toIsoDate(end) };
}

function createInitialFormState(
  { countries, regionsByCountry }: FilterOptions,
  urlParams?: IncomingSearchParams,
) {
  const country = countries[0] ?? '';
  const region = regionsByCountry[country]?.[0] ?? '';

  const base = {
    country,
    region,
    budgetMin: 500,
    budgetMax: 1500,
    nightsMin: 7,
    nightsMax: 12,
    boardTypes: [] as string[],
    adults: 2,
    children: 0,
    rooms: 1,
    ...defaultDepartureWindow(),
    departureAirport: '',
    stars: 0,
  };

  const shared = loadSharedSearchState();
  const merged = shared ? mergeSharedStateIntoSearchForm(base, shared, regionsByCountry) : base;

  if (!urlParams) {
    return merged;
  }

  const urlCountry = getParamString(urlParams, 'country')?.split(',')[0]?.trim();
  const urlRegion = getParamString(urlParams, 'region');
  const nextCountry = urlCountry || merged.country;

  return {
    ...merged,
    country: nextCountry,
    region: urlRegion || regionsByCountry[nextCountry]?.[0] || merged.region,
    budgetMin: getParamNumber(urlParams, 'budgetMin') ?? merged.budgetMin,
    budgetMax: getParamNumber(urlParams, 'budgetMax') ?? merged.budgetMax,
    nightsMin: getParamNumber(urlParams, 'nightsMin') ?? merged.nightsMin,
    nightsMax: getParamNumber(urlParams, 'nightsMax') ?? merged.nightsMax,
    boardTypes: getParamString(urlParams, 'boardTypes')?.split(',').filter(Boolean) ?? merged.boardTypes,
    adults: getParamNumber(urlParams, 'adults') ?? merged.adults,
    children: getParamNumber(urlParams, 'children') ?? merged.children,
    rooms: getParamNumber(urlParams, 'rooms') ?? merged.rooms,
    departureStart: getParamString(urlParams, 'departureStart') || merged.departureStart,
    departureEnd: getParamString(urlParams, 'departureEnd') || merged.departureEnd,
    departureAirport: getParamString(urlParams, 'departureAirport') ?? merged.departureAirport,
    stars: getParamNumber(urlParams, 'stars') ?? merged.stars,
  };
}

function findOriginalCountrySelection(urlParams: IncomingSearchParams | undefined): string[] {
  const urlCountry = getParamString(urlParams, 'country');
  if (urlCountry) {
    const list = urlCountry.split(',').map((value) => value.trim()).filter(Boolean);
    return list.length > 1 ? list : [];
  }

  const shared = loadSharedSearchState();
  return shared && shared.selectedCountries.length > 1 ? shared.selectedCountries : [];
}

type SearchFormProps = FilterOptions & {
  searchParams?: IncomingSearchParams;
};

export function SearchForm({ countries, regionsByCountry, boardTypes, departureAirports, searchParams }: SearchFormProps) {
  const [form, setForm] = useState(() =>
    createInitialFormState({ countries, regionsByCountry, boardTypes, departureAirports }, searchParams),
  );
  const [originalCountrySelection] = useState(() => findOriginalCountrySelection(searchParams));
  const availableRegions = useMemo(() => regionsByCountry[form.country] || [], [form.country, regionsByCountry]);

  useEffect(() => {
    saveSharedSearchState(sharedStateFromSearchForm(form));
  }, [form]);

  const toggleBoardType = (value: string) => {
    setForm((current) => ({
      ...current,
      boardTypes: current.boardTypes.includes(value)
        ? current.boardTypes.filter((item) => item !== value)
        : [...current.boardTypes, value],
    }));
  };

  const buildQuery = () => {
    const params = new URLSearchParams({
      country: form.country,
      region: form.region,
      budgetMin: form.budgetMin.toString(),
      budgetMax: form.budgetMax.toString(),
      nightsMin: form.nightsMin.toString(),
      nightsMax: form.nightsMax.toString(),
      adults: form.adults.toString(),
      children: form.children.toString(),
      rooms: form.rooms.toString(),
      departureStart: form.departureStart,
      departureEnd: form.departureEnd,
      departureAirport: form.departureAirport,
      stars: form.stars.toString(),
    });

    if (form.boardTypes.length > 0) {
      params.set('boardTypes', form.boardTypes.join(','));
    }

    return params.toString();
  };

  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_25px_80px_-30px_rgba(15,23,42,0.35)] sm:p-8">
      <div className="grid gap-6 xl:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">Bestemming</label>
          <div className="grid gap-4 sm:grid-cols-2">
            <select
              value={form.country}
              onChange={(event) => setForm({ ...form, country: event.target.value, region: regionsByCountry[event.target.value]?.[0] || '' })}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
            >
              {countries.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </select>
            <select
              value={form.region}
              onChange={(event) => setForm({ ...form, region: event.target.value })}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
            >
              {availableRegions.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>
          </div>
          {originalCountrySelection.length > 1 && (
            <p className="mt-2 text-xs text-amber-700">
              Er waren meerdere bestemmingen geselecteerd ({originalCountrySelection.join(', ')}). Dit zoekformulier ondersteunt
              voorlopig één bestemming tegelijk. Controleer of &quot;{form.country}&quot; de juiste bestemming is voordat je
              opnieuw zoekt.
            </p>
          )}
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">Reisvenster</label>
          <div className="grid gap-4 sm:grid-cols-2">
            <input
              type="date"
              value={form.departureStart}
              onChange={(event) => setForm({ ...form, departureStart: event.target.value })}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
            />
            <input
              type="date"
              value={form.departureEnd}
              onChange={(event) => setForm({ ...form, departureEnd: event.target.value })}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
            />
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <div>
          <label className="mb-3 block text-sm font-semibold text-slate-700">Budget</label>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>€{form.budgetMin}</span>
              <span>€{form.budgetMax}</span>
            </div>
            <input type="range" min="500" max="2000" value={form.budgetMin} onChange={(event) => setForm({ ...form, budgetMin: Number(event.target.value) })} className="mt-3 w-full" />
            <input type="range" min="500" max="2000" value={form.budgetMax} onChange={(event) => setForm({ ...form, budgetMax: Number(event.target.value) })} className="mt-2 w-full" />
          </div>
        </div>

        <div>
          <label className="mb-3 block text-sm font-semibold text-slate-700">Reisduur</label>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>{form.nightsMin} dagen</span>
              <span>{form.nightsMax} dagen</span>
            </div>
            <input type="range" min={DURATION_MIN} max={DURATION_MAX} value={form.nightsMin} onChange={(event) => setForm({ ...form, nightsMin: Number(event.target.value) })} className="mt-3 w-full" />
            <input type="range" min={DURATION_MIN} max={DURATION_MAX} value={form.nightsMax} onChange={(event) => setForm({ ...form, nightsMax: Number(event.target.value) })} className="mt-2 w-full" />
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <div>
          <label className="mb-3 block text-sm font-semibold text-slate-700">Reizigers</label>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ['Volwassenen', 'adults', form.adults],
              ['Kinderen', 'children', form.children],
              ['Kamers', 'rooms', form.rooms],
            ].map(([label, key, value]) => (
              <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm text-slate-600">{label}</p>
                <input
                  type="number"
                  min="1"
                  value={value}
                  onChange={(event) => setForm({ ...form, [key]: Number(event.target.value) })}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Vertrekluchthaven</label>
            <select value={form.departureAirport} onChange={(event) => setForm({ ...form, departureAirport: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none">
              <option value="">Elke luchthaven</option>
              {departureAirports.map((airport) => (
                <option key={airport} value={airport}>
                  {airport}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Minimum sterren</label>
            <select value={form.stars} onChange={(event) => setForm({ ...form, stars: Number(event.target.value) })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none">
              <option value={0}>Alle hotels</option>
              <option value={3}>3 sterren en hoger</option>
              <option value={4}>4 sterren en hoger</option>
              <option value={5}>5 sterren</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Verzorging</label>
            <div className="flex flex-wrap gap-2">
              {boardTypes.map((type) => {
                const active = form.boardTypes.includes(type);
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleBoardType(type)}
                    className={`rounded-full border px-3 py-2 text-sm ${active ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-200 bg-white text-slate-700'}`}
                  >
                    {type}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 flex justify-end">
        <Link href={`/results?${buildQuery()}`} className="rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700">
          Zoek vakanties
        </Link>
      </div>
    </div>
  );
}
