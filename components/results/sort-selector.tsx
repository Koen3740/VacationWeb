"use client";

import { useRouter, useSearchParams } from 'next/navigation';

export function SortSelector({ currentSort }: { currentSort: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('sort', event.target.value);
    params.delete('page');
    router.push(`/results?${params.toString()}`);
  };

  return (
    <select
      value={currentSort}
      onChange={handleChange}
      className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 outline-none"
    >
      <option value="value">Beste waarde</option>
      <option value="price-per-day">Prijs per dag</option>
      <option value="price">Totaalprijs</option>
    </select>
  );
}
