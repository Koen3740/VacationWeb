'use client';

import { useRouter, useSearchParams } from 'next/navigation';

const SORT_OPTIONS = [
  { value: 'value', label: 'Aanbevolen' },
  { value: 'price', label: 'Prijs (laag → hoog)' },
  { value: 'price-desc', label: 'Prijs (hoog → laag)' },
  { value: 'price-per-day', label: 'Prijs per vakantiedag' },
  { value: 'rating', label: 'Beoordeling' },
  { value: 'stars', label: 'Sterren' },
  { value: 'departure', label: 'Vertrekdatum' },
  { value: 'duration', label: 'Reisduur' },
] as const;

export function SortSelector({ currentSort }: { currentSort: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('sort', event.target.value);
    params.delete('page');
    router.push(`/results?${params.toString()}`);
  };

  const knownValues = SORT_OPTIONS.map((option) => option.value);
  const selectValue = knownValues.includes(currentSort as (typeof SORT_OPTIONS)[number]['value'])
    ? currentSort
    : 'value';

  return (
    <label className="inline-flex items-center gap-2 text-[13px] text-[#64748B]">
      <span>Sorteren op:</span>
      <select
        value={selectValue}
        onChange={handleChange}
        className="h-10 max-w-full rounded-[10px] border border-[#D9E0EA] bg-white px-3 text-[13px] font-semibold text-[#0A2D62] outline-none"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
