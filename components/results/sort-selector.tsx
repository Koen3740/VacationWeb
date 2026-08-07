'use client';

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
    <label className="inline-flex items-center gap-2 text-[13px] text-[#64748B]">
      <span>Sorteren op:</span>
      <select
        value={currentSort}
        onChange={handleChange}
        className="h-10 rounded-[10px] border border-[#D9E0EA] bg-white px-3 text-[13px] font-semibold text-[#0A2D62] outline-none"
      >
        <option value="value">Beste prijs/kwaliteit</option>
        <option value="price-per-day">Prijs per dag</option>
        <option value="price">Totaalprijs</option>
      </select>
    </label>
  );
}
