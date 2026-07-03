import { COUNTRY_FLAG_SOURCES } from '@/components/search/destination-popup/destination-popup-flag-sources';
import { getCountryFlagCode } from '@/components/search/destination-popup/destination-popup-utils';

type DestinationCountryFlagIconProps = {
  country: string;
};

import type { StaticImageData } from 'next/image';

type FlagSource = string | StaticImageData;

function resolveFlagSource(source: FlagSource): string {
  return typeof source === 'string' ? source : source.src;
}

export function DestinationCountryFlagIcon({ country }: DestinationCountryFlagIconProps) {
  const code = getCountryFlagCode(country);
  const src = code && COUNTRY_FLAG_SOURCES[code]
    ? resolveFlagSource(COUNTRY_FLAG_SOURCES[code])
    : undefined;

  if (!src) {
    return (
      <span
        aria-hidden="true"
        className="inline-block h-3 w-4 shrink-0 rounded-[1px] bg-[#CBD5E1]"
      />
    );
  }

  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      width={16}
      height={12}
      className="inline-block h-3 w-4 shrink-0 object-cover"
    />
  );
}
