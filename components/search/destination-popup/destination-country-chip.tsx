import { DestinationCountryFlagIcon } from '@/components/search/destination-popup/destination-country-flag-icon';

type DestinationCountryChipProps = {
  country: string;
  onRemove: (country: string) => void;
};

export function DestinationCountryChip({ country, onRemove }: DestinationCountryChipProps) {
  return (
    <span className="inline-flex h-8 items-center gap-1.5 rounded-2xl bg-[#1E88E5] px-3 text-sm font-medium text-white">
      <DestinationCountryFlagIcon country={country} />
      <span>{country}</span>
      <button
        type="button"
        onClick={() => onRemove(country)}
        className="flex h-3.5 w-3.5 items-center justify-center text-white transition hover:opacity-80"
        aria-label={`Verwijder ${country}`}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M3 3l8 8M11 3L3 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </span>
  );
}
