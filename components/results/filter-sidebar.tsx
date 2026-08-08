'use client';

import {
  RESULTS_BORDER,
  RESULTS_NAVY,
  RESULTS_PANEL_BG,
  RESULTS_PANEL_SHADOW,
  RESULTS_STAR_GOLD,
} from '@/components/results-v2/results-design-tokens';
import { ResultsWhyCard } from '@/components/results-v2/results-why-card';
import { DestinationPopup } from '@/components/search/destination-popup/destination-popup';
import { formatSelectedCountriesLabel } from '@/components/search/destination-popup/destination-popup-utils';
import {
  canonicalizeBoardType,
  canonicalizeBoardTypes,
  type CanonicalBoardType,
} from '@/lib/offers/canonicalize-board-type';
import { canonicalizeCountryName } from '@/lib/offers/canonical-country';
import {
  ACCOMMODATION_TYPE_FILTER_VALUES,
  parseAccommodationTypesParam,
  serializeAccommodationTypesParam,
  type AccommodationTypeFilter,
} from '@/lib/search/accommodation-type-filter';
import {
  AMENITY_GROUPS,
  AMENITY_LABELS,
  parseAmenitiesParam,
  serializeAmenitiesParam,
  type AmenityValue,
} from '@/lib/search/amenity-filters';
import {
  BEACH_LOCATION_LABELS,
  BEACH_LOCATION_VALUES,
  CENTER_LOCATION_LABELS,
  CENTER_LOCATION_VALUES,
  parseBeachLocationParam,
  parseCenterLocationParam,
  parseSeaViewParam,
  type BeachLocation,
  type CenterLocation,
} from '@/lib/search/location-filters';
import {
  STAR_FILTER_VALUES,
  parseStarsParam,
  serializeStarsParam,
} from '@/lib/search/stars-param';
import {
  VACATION_TYPE_VALUES,
  parseVacationTypesParam,
  serializeVacationTypesParam,
  type VacationType,
} from '@/lib/search/vacation-type';
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
    city: searchParams.get('city') || '',
    budgetMin: Number(searchParams.get('budgetMin') || BUDGET_FILTER_MIN),
    budgetMax: Number(searchParams.get('budgetMax') || BUDGET_FILTER_MAX),
    departureAirport: searchParams.get('departureAirport') || '',
    stars: parseStarsParam(searchParams.get('stars')),
    boardTypes: canonicalizeBoardTypes(
      searchParams.get('boardTypes')?.split(',').filter(Boolean) || [],
    ),
    accommodationTypes: parseAccommodationTypesParam(searchParams.get('accommodationTypes')),
    vacationTypes: parseVacationTypesParam(searchParams.get('vacationTypes')),
    beachLocation: parseBeachLocationParam(searchParams.get('beachLocation')) || '',
    centerLocation: parseCenterLocationParam(searchParams.get('centerLocation')) || '',
    seaView: parseSeaViewParam(searchParams.get('seaView')),
    amenities: parseAmenitiesParam(searchParams.get('amenities')),
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

function SectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.05em] text-[#8A93A3] first:pt-2">
      {children}
    </p>
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

function NestedDisclosure({
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
    <div className="rounded-[10px] border border-[#E6EAF1] bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
        aria-expanded={open}
      >
        <span className="text-[13.5px] font-semibold text-[#0A2D62]">{title}</span>
        <Chevron open={open} />
      </button>
      {open && children ? <div className="space-y-2 border-t border-[#EDE8E0] px-3 py-2.5">{children}</div> : null}
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

function StarRow({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden>
      {Array.from({ length: count }, (_, index) => (
        <span key={index} className="text-[15px] leading-none" style={{ color: RESULTS_STAR_GOLD }}>
          ★
        </span>
      ))}
    </span>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#8A93A3]">
      {children}
    </p>
  );
}

export function FilterSidebar({
  regionsByCountry,
  citiesByCountry = {},
  boardTypes,
  accommodationTypes = [],
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
    destination: true,
    budget: true,
    stay: true,
    vacation: true,
    location: true,
    extras: true,
  });
  const [openAmenityGroups, setOpenAmenityGroups] = useState<Record<string, boolean>>({
    pool: false,
    wellness: false,
    sport: false,
    services: false,
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

  const availableCities = useMemo(() => {
    const merged = new Set<string>();
    for (const country of selectedCountries) {
      for (const city of citiesByCountry[country] ?? []) {
        merged.add(city);
      }
    }
    return [...merged].sort((left, right) => left.localeCompare(right, 'nl'));
  }, [citiesByCountry, selectedCountries]);

  const visibleAccommodationTypes = useMemo(() => {
    const available = new Set(accommodationTypes.map((type) => type.toLowerCase()));
    return ACCOMMODATION_TYPE_FILTER_VALUES.filter((type) => available.has(type.toLowerCase()));
  }, [accommodationTypes]);

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

    if (next.city) {
      params.set('city', next.city);
    } else {
      params.delete('city');
    }

    params.set('budgetMin', String(next.budgetMin));
    params.set('budgetMax', String(next.budgetMax));
    params.delete('nightsMin');
    params.delete('nightsMax');

    const starsParam = serializeStarsParam(next.stars);
    if (starsParam) {
      params.set('stars', starsParam);
    } else {
      params.delete('stars');
    }

    if (next.departureAirport) {
      params.set('departureAirport', next.departureAirport);
    } else {
      params.delete('departureAirport');
    }

    if (next.boardTypes.length > 0) {
      params.set('boardTypes', next.boardTypes.join(','));
    } else {
      params.delete('boardTypes');
    }

    const accommodationParam = serializeAccommodationTypesParam(next.accommodationTypes);
    if (accommodationParam) {
      params.set('accommodationTypes', accommodationParam);
    } else {
      params.delete('accommodationTypes');
    }

    const vacationTypesParam = serializeVacationTypesParam(next.vacationTypes);
    if (vacationTypesParam) {
      params.set('vacationTypes', vacationTypesParam);
    } else {
      params.delete('vacationTypes');
    }

    if (next.beachLocation) {
      params.set('beachLocation', next.beachLocation);
    } else {
      params.delete('beachLocation');
    }

    if (next.centerLocation) {
      params.set('centerLocation', next.centerLocation);
    } else {
      params.delete('centerLocation');
    }

    if (next.seaView) {
      params.set('seaView', '1');
    } else {
      params.delete('seaView');
    }

    const amenitiesParam = serializeAmenitiesParam(next.amenities);
    if (amenitiesParam) {
      params.set('amenities', amenitiesParam);
    } else {
      params.delete('amenities');
    }

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const toggleBoardType = (value: CanonicalBoardType) => {
    updateFilters({
      ...filters,
      boardTypes: filters.boardTypes.includes(value)
        ? filters.boardTypes.filter((item) => item !== value)
        : [...filters.boardTypes, value],
    });
  };

  const toggleAccommodationType = (value: AccommodationTypeFilter) => {
    updateFilters({
      ...filters,
      accommodationTypes: filters.accommodationTypes.includes(value)
        ? filters.accommodationTypes.filter((item) => item !== value)
        : [...filters.accommodationTypes, value],
    });
  };

  const toggleStars = (value: number) => {
    updateFilters({
      ...filters,
      stars: filters.stars.includes(value)
        ? filters.stars.filter((item) => item !== value)
        : [...filters.stars, value],
    });
  };

  const toggleVacationType = (value: VacationType) => {
    updateFilters({
      ...filters,
      vacationTypes: filters.vacationTypes.includes(value)
        ? filters.vacationTypes.filter((item) => item !== value)
        : [...filters.vacationTypes, value],
    });
  };

  const toggleAmenity = (value: AmenityValue) => {
    updateFilters({
      ...filters,
      amenities: filters.amenities.includes(value)
        ? filters.amenities.filter((item) => item !== value)
        : [...filters.amenities, value],
    });
  };

  const toggleSection = (id: string) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleAmenityGroup = (id: string) => {
    setOpenAmenityGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const clearAllFilters = () => {
    const params = new URLSearchParams(searchParams.toString());
    for (const key of [
      'country',
      'region',
      'city',
      'budgetMin',
      'budgetMax',
      'nightsMin',
      'nightsMax',
      'stars',
      'boardTypes',
      'accommodationTypes',
      'vacationTypes',
      'beachLocation',
      'centerLocation',
      'seaView',
      'amenities',
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

  const selectClassName =
    'h-11 w-full rounded-[10px] border border-[#D9E0EA] bg-white px-3 text-[14px] text-[#0A2D62] outline-none';

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
        <SectionEyebrow>Waar wil ik naartoe?</SectionEyebrow>
        <Accordion
          title="Bestemming"
          open={!!openSections.destination}
          onToggle={() => toggleSection('destination')}
        >
          <div className="space-y-3">
            <div>
              <FieldLabel>Land</FieldLabel>
              <SelectLike onClick={() => setDestinationPopupOpen(true)}>
                {selectedCountries.length > 0
                  ? formatSelectedCountriesLabel(selectedCountries)
                  : 'Alle landen'}
              </SelectLike>
            </div>
            <div>
              <FieldLabel>Regio</FieldLabel>
              <select
                value={filters.region}
                onChange={(event) =>
                  updateFilters({ ...filters, region: event.target.value, city: '' })
                }
                className={selectClassName}
              >
                <option value="">Alle regio&apos;s</option>
                {availableRegions.map((region) => (
                  <option key={region} value={region}>
                    {region}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel>Plaats</FieldLabel>
              <select
                value={filters.city}
                onChange={(event) => updateFilters({ ...filters, city: event.target.value })}
                className={selectClassName}
                disabled={selectedCountries.length === 0}
              >
                <option value="">Alle plaatsen</option>
                {availableCities.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Accordion>

        <SectionEyebrow>Wat mag het kosten?</SectionEyebrow>
        <Accordion title="Budget" open={!!openSections.budget} onToggle={() => toggleSection('budget')}>
          <div className="space-y-4 pt-1">
            <FieldLabel>Prijs per persoon</FieldLabel>
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

        <SectionEyebrow>Hoe wil ik verblijven?</SectionEyebrow>
        <Accordion title="Verblijf" open={!!openSections.stay} onToggle={() => toggleSection('stay')}>
          <div className="space-y-4">
            <div>
              <FieldLabel>Accommodatietype</FieldLabel>
              <div className="space-y-2">
                {visibleAccommodationTypes.map((type) => {
                  const active = filters.accommodationTypes.includes(type);
                  return (
                    <label key={type} className="flex cursor-pointer items-center gap-2.5 text-[14px] text-[#334155]">
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => toggleAccommodationType(type)}
                        className="h-4 w-4 rounded border-[#CBD5E1] accent-[#89ACD3]"
                      />
                      {type}
                    </label>
                  );
                })}
              </div>
            </div>
            <div>
              <FieldLabel>Sterren</FieldLabel>
              <div className="space-y-2">
                {STAR_FILTER_VALUES.map((value) => {
                  const active = filters.stars.includes(value);
                  return (
                    <label
                      key={value}
                      className="flex cursor-pointer items-center gap-2.5 text-[14px] text-[#334155]"
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => toggleStars(value)}
                        className="h-4 w-4 rounded border-[#CBD5E1] accent-[#89ACD3]"
                        aria-label={`${value} sterren`}
                      />
                      <StarRow count={value} />
                    </label>
                  );
                })}
              </div>
            </div>
            <div>
              <FieldLabel>Verzorging</FieldLabel>
              <div className="space-y-2">
                {boardTypes.map((type) => {
                  const canonical = canonicalizeBoardType(type);
                  if (!canonical) {
                    return null;
                  }
                  const active = filters.boardTypes.includes(canonical);
                  return (
                    <label
                      key={canonical}
                      className="flex cursor-pointer items-center gap-2.5 text-[14px] text-[#334155]"
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => toggleBoardType(canonical)}
                        className="h-4 w-4 rounded border-[#CBD5E1] accent-[#89ACD3]"
                      />
                      {canonical}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </Accordion>

        <SectionEyebrow>Wat zoek ik?</SectionEyebrow>
        <Accordion
          title="Vakantietype"
          open={!!openSections.vacation}
          onToggle={() => toggleSection('vacation')}
        >
          <div className="space-y-2">
            {VACATION_TYPE_VALUES.map((type) => {
              const active = filters.vacationTypes.includes(type);
              return (
                <label key={type} className="flex cursor-pointer items-center gap-2.5 text-[14px] text-[#334155]">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggleVacationType(type)}
                    className="h-4 w-4 rounded border-[#CBD5E1] accent-[#89ACD3]"
                  />
                  {type}
                </label>
              );
            })}
          </div>
        </Accordion>

        <SectionEyebrow>Waar moet het liggen?</SectionEyebrow>
        <Accordion title="Ligging" open={!!openSections.location} onToggle={() => toggleSection('location')}>
          <div className="space-y-3">
            <div>
              <FieldLabel>Strand</FieldLabel>
              <select
                value={filters.beachLocation}
                onChange={(event) =>
                  updateFilters({
                    ...filters,
                    beachLocation: (event.target.value || '') as BeachLocation | '',
                  })
                }
                className={selectClassName}
              >
                <option value="">Maak een keuze</option>
                {BEACH_LOCATION_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {BEACH_LOCATION_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel>Centrum</FieldLabel>
              <select
                value={filters.centerLocation}
                onChange={(event) =>
                  updateFilters({
                    ...filters,
                    centerLocation: (event.target.value || '') as CenterLocation | '',
                  })
                }
                className={selectClassName}
              >
                <option value="">Maak een keuze</option>
                {CENTER_LOCATION_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {CENTER_LOCATION_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel>Zeezicht</FieldLabel>
              <select
                value={filters.seaView ? '1' : ''}
                onChange={(event) =>
                  updateFilters({
                    ...filters,
                    seaView: event.target.value === '1',
                  })
                }
                className={selectClassName}
              >
                <option value="">Maak een keuze</option>
                <option value="1">Zeezicht</option>
              </select>
            </div>
          </div>
        </Accordion>

        <SectionEyebrow>Welke extra&apos;s wil ik?</SectionEyebrow>
        <Accordion title="Extra&apos;s" open={!!openSections.extras} onToggle={() => toggleSection('extras')}>
          <div className="space-y-2">
            {AMENITY_GROUPS.map((group) => (
              <NestedDisclosure
                key={group.id}
                title={group.label}
                open={!!openAmenityGroups[group.id]}
                onToggle={() => toggleAmenityGroup(group.id)}
              >
                {group.items.map((item) => {
                  const active = filters.amenities.includes(item);
                  return (
                    <label
                      key={item}
                      className="flex cursor-pointer items-center gap-2.5 text-[14px] text-[#334155]"
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => toggleAmenity(item)}
                        className="h-4 w-4 rounded border-[#CBD5E1] accent-[#89ACD3]"
                      />
                      {AMENITY_LABELS[item]}
                    </label>
                  );
                })}
              </NestedDisclosure>
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
            city: '',
          });
        }}
      />
    </aside>
  );
}
