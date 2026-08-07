'use client';

import {
  RESULTS_BORDER,
  RESULTS_NAVY,
  RESULTS_PANEL_BG,
  RESULTS_PANEL_SHADOW,
} from '@/components/results-v2/results-design-tokens';
import { ResultsWhyCard } from '@/components/results-v2/results-why-card';
import { DestinationPopup } from '@/components/search/destination-popup/destination-popup';
import { formatSelectedCountriesLabel } from '@/components/search/destination-popup/destination-popup-utils';
import { DURATION_MAX, DURATION_MIN } from '@/components/search/duration-popup/duration-popup-utils';
import { canonicalizeCountryName } from '@/lib/offers/canonical-country';
import { FilterOptions } from '@/types/travel';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

const BUDGET_MIN_BOUND = 0;
const BUDGET_MAX_BOUND = 2000;
const BUDGET_FILTER_MIN = 500;
const BUDGET_FILTER_MAX = 2000;

function parseFilters(searchParams: URLSearchParams) {
  const country = (searchParams.get('country') || '')
    .split(',')
    .map((entry) => canonicalizeCountryName(entry.trim()))
    .filter(Boolean)
    .join(',');

  return {
    country,
    region: searchParams.get('region') || '',
    budgetMin: Number(searchParams.get('budgetMin') || BUDGET_FILTER_MIN),
    budgetMax: Number(searchParams.get('budgetMax') || BUDGET_FILTER_MAX),
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

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className={`shrink-0 text-[#64748B] transition-transform ${open ? 'rotate-180' : ''}`}
    >
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Accordion({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="border-b border-[#EDE8E0]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 py-[15px] text-left"
        aria-expanded={open}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <span
            className="h-3.5 w-[3px] shrink-0 rounded-full"
            style={{ backgroundColor: RESULTS_NAVY, opacity: open ? 0.9 : 0.35 }}
            aria-hidden
          />
          <span className="text-[14.5px] font-semibold tracking-[-0.01em] text-[#0A2D62]">{title}</span>
        </span>
        <Chevron open={open} />
      </button>
      {open && children ? <div className="pb-4 pl-[13px]">{children}</div> : null}
    </div>
  );
}

function SelectLike({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  const className =
    'flex h-11 w-full items-center justify-between rounded-[10px] border border-[#D9E0EA] bg-white px-3 text-left text-[14px] text-[#0A2D62]';
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        <span className="truncate">{children}</span>
        <Chevron open={false} />
      </button>
    );
  }
  return (
    <div className={className}>
      <span className="truncate">{children}</span>
      <Chevron open={false} />
    </div>
  );
}

export function FilterSidebar({
  regionsByCountry,
  boardTypes,
  departureAirports: _departureAirports,
  countryCounts,
  totalOffersLabel,
}: FilterSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState(() => parseFilters(new URLSearchParams(searchParams.toString())));
  const [destinationPopupOpen, setDestinationPopupOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    destinations: true,
    budget: true,
    stay: false,
    board: false,
    stars: false,
    rating: false,
    type: false,
    departure: false,
    bedrooms: false,
  });

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

  const toggleSection = (id: string) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const clearAllFilters = () => {
    const params = new URLSearchParams(searchParams.toString());
    for (const key of [
      'country',
      'region',
      'budgetMin',
      'budgetMax',
      'nightsMin',
      'nightsMax',
      'stars',
      'boardTypes',
      'departureAirport',
      'page',
    ]) {
      params.delete(key);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const budgetMinPct = ((filters.budgetMin - BUDGET_MIN_BOUND) / (BUDGET_MAX_BOUND - BUDGET_MIN_BOUND)) * 100;
  const budgetMaxPct = ((filters.budgetMax - BUDGET_MIN_BOUND) / (BUDGET_MAX_BOUND - BUDGET_MIN_BOUND)) * 100;

  const budgetMinLabel =
    filters.budgetMin === BUDGET_FILTER_MIN
      ? '€ 0'
      : `€ ${filters.budgetMin.toLocaleString('nl-NL')}`;
  const budgetMaxLabel =
    filters.budgetMax >= BUDGET_FILTER_MAX
      ? '€ 2.000+'
      : `€ ${filters.budgetMax.toLocaleString('nl-NL')}`;

  return (
    <aside>
      <div
        className="rounded-[16px] border px-4"
        style={{
          backgroundColor: RESULTS_PANEL_BG,
          borderColor: RESULTS_BORDER,
          boxShadow: RESULTS_PANEL_SHADOW,
        }}
      >
        <Accordion
          title="Bestemmingen"
          open={!!openSections.destinations}
          onToggle={() => toggleSection('destinations')}
        >
          <div className="space-y-3">
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#8A93A3]">
                Land
              </p>
              <SelectLike onClick={() => setDestinationPopupOpen(true)}>
                {selectedCountries.length > 0
                  ? formatSelectedCountriesLabel(selectedCountries)
                  : 'Alle landen'}
              </SelectLike>
            </div>
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#8A93A3]">
                Streek / Regio
              </p>
              <select
                value={filters.region}
                onChange={(event) => updateFilters({ ...filters, region: event.target.value })}
                className="h-11 w-full rounded-[10px] border border-[#D9E0EA] bg-white px-3 text-[14px] text-[#0A2D62] outline-none"
              >
                <option value="">Alle streken</option>
                {availableRegions.map((region) => (
                  <option key={region} value={region}>
                    {region}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#8A93A3]">
                Plaats
              </p>
              <SelectLike>Alle plaatsen</SelectLike>
            </div>
          </div>
        </Accordion>

        <Accordion title="Prijs per persoon" open={!!openSections.budget} onToggle={() => toggleSection('budget')}>
          <div className="space-y-4 pt-1">
            <div className="relative h-8">
              <div className="absolute left-0 right-0 top-1/2 h-[6px] -translate-y-1/2 rounded-full bg-[#E6EAF1]" />
              <div
                className="absolute top-1/2 h-[6px] -translate-y-1/2 rounded-full"
                style={{
                  left: `${budgetMinPct}%`,
                  right: `${100 - budgetMaxPct}%`,
                  background: `linear-gradient(90deg, ${RESULTS_NAVY} 0%, #89ACD3 100%)`,
                }}
              />
              <input
                type="range"
                min={BUDGET_FILTER_MIN}
                max={BUDGET_FILTER_MAX}
                value={filters.budgetMin}
                aria-label="Minimumprijs per persoon"
                onChange={(event) => {
                  const nextBudgetMin = Number(event.target.value);
                  updateFilters({
                    ...filters,
                    budgetMin: nextBudgetMin,
                    budgetMax: Math.max(filters.budgetMax, nextBudgetMin),
                  });
                }}
                className="vw-budget-range z-[2]"
              />
              <input
                type="range"
                min={BUDGET_FILTER_MIN}
                max={BUDGET_FILTER_MAX}
                value={filters.budgetMax}
                aria-label="Maximumprijs per persoon"
                onChange={(event) => {
                  const nextBudgetMax = Number(event.target.value);
                  updateFilters({
                    ...filters,
                    budgetMax: nextBudgetMax,
                    budgetMin: Math.min(filters.budgetMin, nextBudgetMax),
                  });
                }}
                className="vw-budget-range z-[3]"
              />
            </div>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-[#8A93A3]">Van</p>
                <p className="mt-0.5 text-[13px] font-semibold tabular-nums text-[#0A2D62]">{budgetMinLabel}</p>
              </div>
              <div className="mb-1.5 h-px flex-1 bg-[#E8E4DC]" aria-hidden />
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-[#8A93A3]">Tot</p>
                <p className="mt-0.5 text-[13px] font-semibold tabular-nums text-[#0A2D62]">{budgetMaxLabel}</p>
              </div>
            </div>
          </div>
        </Accordion>

        <Accordion title="Verblijf" open={!!openSections.stay} onToggle={() => toggleSection('stay')}>
          <div className="space-y-2 text-[14px] text-[#334155]">
            {['Hotel', 'Appartement', 'Resort'].map((item) => (
              <label key={item} className="flex items-center gap-2.5">
                <input type="checkbox" disabled className="h-4 w-4 rounded border-[#CBD5E1]" />
                {item}
              </label>
            ))}
          </div>
        </Accordion>

        <Accordion title="Verzorging" open={!!openSections.board} onToggle={() => toggleSection('board')}>
          <div className="space-y-2">
            {boardTypes.map((type) => {
              const active = filters.boardTypes.includes(type);
              return (
                <label key={type} className="flex cursor-pointer items-center gap-2.5 text-[14px] text-[#334155]">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggleBoardType(type)}
                    className="h-4 w-4 rounded border-[#CBD5E1] accent-[#89ACD3]"
                  />
                  {type}
                </label>
              );
            })}
          </div>
        </Accordion>

        <Accordion title="Aantal sterren" open={!!openSections.stars} onToggle={() => toggleSection('stars')}>
          <select
            value={filters.stars}
            onChange={(event) => updateFilters({ ...filters, stars: Number(event.target.value) })}
            className="h-11 w-full rounded-[10px] border border-[#D9E0EA] bg-white px-3 text-[14px] text-[#0A2D62] outline-none"
          >
            <option value={0}>Alle hotels</option>
            <option value={3}>3 sterren en hoger</option>
            <option value={4}>4 sterren en hoger</option>
            <option value={5}>5 sterren</option>
          </select>
        </Accordion>

        <Accordion title="Beoordeling" open={!!openSections.rating} onToggle={() => toggleSection('rating')}>
          <div className="space-y-2 text-[14px] text-[#334155]">
            {['9+', '8+', '7+'].map((item) => (
              <label key={item} className="flex items-center gap-2.5">
                <input type="checkbox" disabled className="h-4 w-4 rounded border-[#CBD5E1]" />
                {item}
              </label>
            ))}
          </div>
        </Accordion>

        <Accordion title="Type vakantie" open={!!openSections.type} onToggle={() => toggleSection('type')}>
          <div className="space-y-2 text-[14px] text-[#334155]">
            {['Strand', 'Stad', 'Natuur'].map((item) => (
              <label key={item} className="flex items-center gap-2.5">
                <input type="checkbox" disabled className="h-4 w-4 rounded border-[#CBD5E1]" />
                {item}
              </label>
            ))}
          </div>
        </Accordion>

        <Accordion title="Vertrekdatum" open={!!openSections.departure} onToggle={() => toggleSection('departure')}>
          <p className="text-[13px] leading-relaxed text-[#64748B]">
            Stel de vertrekperiode in via Wanneer in de zoekbalk.
          </p>
        </Accordion>

        <Accordion
          title="Aantal slaapkamers"
          open={!!openSections.bedrooms}
          onToggle={() => toggleSection('bedrooms')}
        >
          <div className="space-y-2 text-[14px] text-[#334155]">
            {['1+', '2+', '3+'].map((item) => (
              <label key={item} className="flex items-center gap-2.5">
                <input type="checkbox" disabled className="h-4 w-4 rounded border-[#CBD5E1]" />
                {item}
              </label>
            ))}
          </div>
        </Accordion>

        <div className="py-4">
          <button
            type="button"
            onClick={clearAllFilters}
            className="w-full rounded-[10px] border border-[#D9E0EA] bg-white px-3 py-2.5 text-[14px] font-medium text-[#0A2D62] transition hover:bg-[#F8FAFC]"
          >
            Wis alle filters
          </button>
        </div>
      </div>

      <ResultsWhyCard />

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
