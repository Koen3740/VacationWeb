import type { ReactNode } from 'react';
import { DestinationCountryOption } from '@/components/search/destination-popup/destination-popup-utils';

type DestinationCountryRowProps = {
  country: DestinationCountryOption;
  selected: boolean;
  onToggle: (name: string) => void;
  /** Small flag (DestinationPopupFlag), passed in by the popup. */
  flag?: ReactNode;
};

export function DestinationCountryRow({ country, selected, onToggle, flag }: DestinationCountryRowProps) {
  return (
    <label className="relative flex cursor-pointer items-center gap-2.5 rounded px-0.5 py-2.5 transition-colors hover:bg-[#F8FAFC] sm:py-2">
      <span
        className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] text-[12px] ${
          selected
            ? 'border-[1.5px] border-[#1E40AF] bg-[#1E40AF] text-white'
            : 'border-[1.5px] border-[#CBD5E1] bg-white text-transparent'
        }`}
        aria-hidden="true"
      >
        ✓
      </span>
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onToggle(country.name)}
        className="sr-only"
      />
      {flag}
      <span className="min-w-0 flex-1 truncate text-[15px] text-[#111827] sm:text-[14px]">{country.name}</span>
    </label>
  );
}
