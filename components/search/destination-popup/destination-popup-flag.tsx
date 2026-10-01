import { DestinationCountryFlagIcon } from '@/components/search/destination-popup/destination-country-flag-icon';
import { COUNTRY_FLAG_SOURCES } from '@/components/search/destination-popup/destination-popup-flag-sources';
import { getCountryFlagCode } from '@/components/search/destination-popup/destination-popup-utils';

type DestinationPopupFlagProps = {
  country: string;
};

/**
 * Popup-only flag: the shared country flag when one exists, otherwise a small neutral globe in
 * the same 16×12 box (subtle border, rounded) instead of an empty grey square. Kept separate from
 * DestinationCountryFlagIcon so other pages (e.g. /bestemmingen) are not affected.
 */
export function DestinationPopupFlag({ country }: DestinationPopupFlagProps) {
  const code = getCountryFlagCode(country);
  if (code && COUNTRY_FLAG_SOURCES[code]) {
    return <DestinationCountryFlagIcon country={country} />;
  }

  return (
    <span
      aria-hidden="true"
      data-flag-fallback=""
      className="inline-flex h-3 w-4 shrink-0 items-center justify-center rounded-[2px] border border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B]"
    >
      <svg width="9" height="9" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M1.5 8h13M8 1.5c1.9 1.9 2.7 4.1 2.7 6.5S9.9 12.6 8 14.5M8 1.5C6.1 3.4 5.3 5.6 5.3 8S6.1 12.6 8 14.5"
          stroke="currentColor"
          strokeWidth="1.3"
        />
      </svg>
    </span>
  );
}
