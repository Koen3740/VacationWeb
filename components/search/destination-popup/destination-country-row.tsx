import { DestinationCountryOption } from '@/components/search/destination-popup/destination-popup-utils';

type DestinationCountryRowProps = {
  country: DestinationCountryOption;
  selected: boolean;
  onToggle: (name: string) => void;
};

export function DestinationCountryRow({ country, selected, onToggle }: DestinationCountryRowProps) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded py-2.5 transition-colors hover:bg-[#F3F4F6]">
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] text-xs ${
          selected
            ? 'bg-[#1E88E5] text-white'
            : 'border-2 border-[#D1D5DB] bg-white text-transparent'
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
      <span className="min-w-0 flex-1 truncate text-[15px] text-[#1F2937]">{country.name}</span>
    </label>
  );
}
