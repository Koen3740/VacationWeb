"use client";

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { DestinationPopup } from '@/components/search/destination-popup/destination-popup';
import { formatSelectedCountriesLabel } from '@/components/search/destination-popup/destination-popup-utils';
import { DURATION_MAX, DURATION_MIN } from '@/components/search/duration-popup/duration-popup-utils';
import { canonicalizeCountryName } from '@/lib/offers/canonical-country';
import { FilterOptions } from '@/types/travel';

const BUDGET_MIN_BOUND = 500;
const BUDGET_MAX_BOUND = 2000;

function parseFilters(searchParams: URLSearchParams) {
  const country = (searchParams.get('country') || '')
    .split(',')
    .map((entry) => canonicalizeCountryName(entry.trim()))
    .filter(Boolean)
    .join(',');

  return {
    country,
    region: searchParams.get('region') || '',
    // Wanneer geen budget-/reisduurfilter in de URL staat, wordt er door filterOffers()
    // objectief geen beperking toegepast. De sliders tonen daarom de volledige
    // slider-range (= "geen filter actief") in plaats van een misleidende sub-range.
    budgetMin: Number(searchParams.get('budgetMin') || BUDGET_MIN_BOUND),
    budgetMax: Number(searchParams.get('budgetMax') || BUDGET_MAX_BOUND),
    nightsMin: Number(searchParams.get('nightsMin') || DURATION_MIN),
    nightsMax: Number(searchParams.get('nightsMax') || DURATION_MAX),
    departureAirport: searchParams.get('departureAirport') || '',
    stars: Number(searchParams.get('stars') || 0),
    boardTypes: searchParams.get('boardTypes')?.split(',').filter(Boolean) || [],
  };
}

type FilterSidebarProps = FilterOptions & {
  countryCounts: Record<string, number>;
  totalOffersLabel: string;
};

export function FilterSidebar({
  regionsByCountry,
  boardTypes,
  departureAirports,
  countryCounts,
  totalOffersLabel,
}: FilterSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState(() => parseFilters(new URLSearchParams(searchParams.toString())));
  const [destinationPopupOpen, setDestinationPopupOpen] = useState(false);

  useEffect(() => {
    setFilters(parseFilters(new URLSearchParams(searchParams.toString())));
  }, [searchParams]);

  const selectedCountries = useMemo(
    () => filters.country.split(',').map((country) => country.trim()).filter(Boolean),
    [filters.country],
  );

  const availableRegions = useMemo(() => {
    const merged = new Set<string>();
    for (const country of selectedCountries) {
      for (const region of regionsByCountry[country] ?? []) {
        merged.add(region);
      }
    }
    return [...merged].sort((left, right) => left.localeCompare(right, 'nl'));
  }, [regionsByCountry, selectedCountries]);

  const updateFilters = (next: typeof filters) => {
    setFilters(next);

    const params = new URLSearchParams(searchParams.toString());
    params.delete('page');

    if (next.country) {
      params.set('country', next.country);
    } else {
      params.delete('country');
    }

    if (next.region) {
      params.set('region', next.region);
    } else {
      params.delete('region');
    }

    params.set('budgetMin', String(next.budgetMin));
    params.set('budgetMax', String(next.budgetMax));
    params.set('nightsMin', String(next.nightsMin));
    params.set('nightsMax', String(next.nightsMax));
    params.set('stars', String(next.stars));
    params.set('departureAirport', next.departureAirport);

    if (next.boardTypes.length > 0) {
      params.set('boardTypes', next.boardTypes.join(','));
    } else {
      params.delete('boardTypes');
    }

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const toggleBoardType = (value: string) => {
    const next = {
      ...filters,
      boardTypes: filters.boardTypes.includes(value)
        ? filters.boardTypes.filter((item) => item !== value)
        : [...filters.boardTypes, value],
    };
    updateFilters(next);
  };

  return (
    <aside className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-950">Filters</h2>
      <p className="mt-2 text-sm text-slate-600">Pas je zoekopdracht direct aan zonder terug te gaan.</p>

      <div className="mt-6 space-y-5 text-sm text-slate-700">
        <div>
          <label className="mb-2 block font-semibold">Bestemming</label>
          <div className="grid gap-3">
            <button
              type="button"
              onClick={() => setDestinationPopupOpen(true)}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-left outline-none"
            >
              {selectedCountries.length > 0
                ? formatSelectedCountriesLabel(selectedCountries)
                : 'Alle landen'}
            </button>
            <select
              value={filters.region}
              onChange={(event) => updateFilters({ ...filters, region: event.target.value })}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none"
            >
              <option value="">Alle regio&apos;s</option>
              {availableRegions.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-2 block font-semibold">Budget</label>
          <div className="grid gap-3">
            <input
              type="range"
              min={BUDGET_MIN_BOUND}
              max={BUDGET_MAX_BOUND}
              value={filters.budgetMin}
              onChange={(event) => {
                const nextBudgetMin = Number(event.target.value);
                const next = { ...filters, budgetMin: nextBudgetMin, budgetMax: Math.max(filters.budgetMax, nextBudgetMin) };
                updateFilters(next);
              }}
            />
            <input
              type="range"
              min={BUDGET_MIN_BOUND}
              max={BUDGET_MAX_BOUND}
              value={filters.budgetMax}
              onChange={(event) => {
                const nextBudgetMax = Number(event.target.value);
                const next = { ...filters, budgetMax: nextBudgetMax, budgetMin: Math.min(filters.budgetMin, nextBudgetMax) };
                updateFilters(next);
              }}
            />
            <div className="flex justify-between text-xs text-slate-500">
              <span>€{filters.budgetMin}</span>
              <span>€{filters.budgetMax}</span>
            </div>
          </div>
        </div>

        <div>
          <label className="mb-2 block font-semibold">Reisduur</label>
          <div className="grid gap-3">
            <input
              type="range"
              min={DURATION_MIN}
              max={DURATION_MAX}
              value={filters.nightsMin}
              onChange={(event) => {
                const nextNightsMin = Number(event.target.value);
                const next = { ...filters, nightsMin: nextNightsMin, nightsMax: Math.max(filters.nightsMax, nextNightsMin) };
                updateFilters(next);
              }}
            />
            <input
              type="range"
              min={DURATION_MIN}
              max={DURATION_MAX}
              value={filters.nightsMax}
              onChange={(event) => {
                const nextNightsMax = Number(event.target.value);
                const next = { ...filters, nightsMax: nextNightsMax, nightsMin: Math.min(filters.nightsMin, nextNightsMax) };
                updateFilters(next);
              }}
            />
            <div className="flex justify-between text-xs text-slate-500">
              <span>{filters.nightsMin} dagen</span>
              <span>{filters.nightsMax} dagen</span>
            </div>
          </div>
        </div>

        <div>
          <label className="mb-2 block font-semibold">Vertrekluchthaven</label>
          <select
            value={filters.departureAirport}
            onChange={(event) => updateFilters({ ...filters, departureAirport: event.target.value })}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none"
          >
            <option value="">Alle luchthavens</option>
            {departureAirports.map((airport) => (
              <option key={airport} value={airport}>
                {airport}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block font-semibold">Minimum sterren</label>
          <select
            value={filters.stars}
            onChange={(event) => updateFilters({ ...filters, stars: Number(event.target.value) })}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none"
          >
            <option value={0}>Alle hotels</option>
            <option value={3}>3 sterren en hoger</option>
            <option value={4}>4 sterren en hoger</option>
            <option value={5}>5 sterren</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block font-semibold">Verzorging</label>
          <div className="flex flex-wrap gap-2">
            {boardTypes.map((type) => {
              const active = filters.boardTypes.includes(type);
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

      <DestinationPopup
        open={destinationPopupOpen}
        appliedCountries={selectedCountries}
        countryCounts={countryCounts}
        totalOffersLabel={totalOffersLabel}
        onClose={() => setDestinationPopupOpen(false)}
        onApply={(nextCountries) => {
          setDestinationPopupOpen(false);
          updateFilters({
            ...filters,
            country: nextCountries.join(','),
            region: '',
          });
        }}
      />
    </aside>
  );
}
