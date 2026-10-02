import { DestinationPopupFlag } from '@/components/search/destination-popup/destination-popup-flag';

type DestinationCountryChipProps = {
  country: string;
  /** Shown name when it differs from the country (a region/place chip keeps the parent flag). */
  label?: string;
  onRemove: (country: string) => void;
};

/** Selected destination (prototype A): light-blue pill with a small flag and a remove button. */
export function DestinationCountryChip({ country, label, onRemove }: DestinationCountryChipProps) {
  const name = label ?? country;
  return (
    <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[#DBEAFE] pl-2.5 pr-1 text-[13px] font-medium text-[#1E40AF] sm:h-7 sm:pl-2 sm:text-[12px]">
      <DestinationPopupFlag country={country} />
      <span>{name}</span>
      <button
        type="button"
        onClick={() => onRemove(country)}
        className="-ml-0.5 flex h-7 w-7 items-center justify-center rounded-full text-[#1E40AF] transition hover:bg-[#BFDBFE] sm:h-6 sm:w-6"
        aria-label={`Verwijder ${name}`}
      >
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M3 3l8 8M11 3L3 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
    </span>
  );
}
