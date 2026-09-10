import { BestemmingenCountryList } from '@/components/bestemmingen/bestemmingen-country-list';
import { ResultsSiteHeader } from '@/components/results-v2/results-site-header';
import { loadActiveDestinationCountries } from '@/lib/offers/list-active-destination-countries';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Bestemmingen | VacationWeb',
  description: 'Alle landen met actuele pakketvakanties bij VacationWeb.',
};

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export default async function BestemmingenPage() {
  const countries = await loadActiveDestinationCountries();

  return (
    <div className="min-h-screen bg-[#F7F5F1]">
      <ResultsSiteHeader />
      <main className="mx-auto max-w-[960px] px-6 py-8 lg:px-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-bold tracking-tight text-[#0A2D62]">Bestemmingen</h1>
            <p className="mt-1 max-w-[36rem] text-[14px] text-[#64748B]">
              Landen waar je nu een pakketvakantie kunt boeken via VacationWeb. Klik op een land om
              de actuele aanbiedingen te bekijken.
            </p>
          </div>
          <Link href="/" className="text-[13px] font-medium text-[#0A2D62] hover:underline">
            Terug naar home
          </Link>
        </div>

        <p className="mb-6 text-[13px] text-[#64748B]">
          {countries.length === 0
            ? 'Geen bestemmingen beschikbaar'
            : countries.length === 1
              ? '1 bestemming'
              : `${countries.length} bestemmingen`}
        </p>

        <BestemmingenCountryList countries={countries} />
      </main>
    </div>
  );
}
