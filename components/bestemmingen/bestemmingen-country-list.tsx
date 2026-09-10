import { DestinationCountryFlagIcon } from '@/components/search/destination-popup/destination-country-flag-icon';
import { buildPopularDestinationHref } from '@/components/home/home-popular-destination-href';
import {
  groupCountriesByContinent,
  type DestinationContinentGroup,
} from '@/lib/offers/destination-continent';
import Link from 'next/link';

type BestemmingenCountryListProps = {
  countries: string[];
};

function ContinentSection({ group }: { group: DestinationContinentGroup }) {
  return (
    <section aria-labelledby={`continent-${group.continent}`}>
      <h2
        id={`continent-${group.continent}`}
        className="mb-4 text-[18px] font-semibold tracking-tight text-[#0A2D62]"
      >
        {group.continent}
      </h2>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {group.countries.map((country) => (
          <li key={country}>
            <Link
              href={buildPopularDestinationHref(country)}
              className="group flex items-center gap-3 rounded-xl border border-[#E8ECF2] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-[#CBD5E1] hover:shadow-[0_4px_12px_rgba(15,23,42,0.06)]"
            >
              <span className="flex h-8 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[#F1F5F9] [&_img]:h-5 [&_img]:w-7 [&_img]:rounded-[2px] [&_span]:h-5 [&_span]:w-7 [&_span]:rounded-[2px]">
                <DestinationCountryFlagIcon country={country} />
              </span>
              <span className="text-[15px] font-medium text-[#0A2D62] transition group-hover:underline">
                {country}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function BestemmingenCountryList({ countries }: BestemmingenCountryListProps) {
  if (countries.length === 0) {
    return (
      <p className="rounded-xl border border-[#E8ECF2] bg-white px-5 py-4 text-[14px] text-[#64748B]">
        Momenteel geen bestemmingen met actuele pakketvakanties.
      </p>
    );
  }

  const groups = groupCountriesByContinent(countries);

  return (
    <div className="space-y-10">
      {groups.map((group) => (
        <ContinentSection key={group.continent} group={group} />
      ))}
    </div>
  );
}
