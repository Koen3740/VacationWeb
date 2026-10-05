import { AanbiedingenExperience } from '@/components/promotions/aanbiedingen-experience';
import { ResultsSiteHeader } from '@/components/results-v2/results-site-header';
import { ResultsUspBar } from '@/components/results-v2/results-usp-bar';
import { loadAanbiedingenByMarkets } from '@/lib/tradetracker/promotions/load-aanbiedingen';
import { presentAanbiedingenOffers } from '@/lib/tradetracker/promotions/present-aanbiedingen';
import { resolveSiteMarketFromHost } from '@/lib/search/site-market';
import type { VacationWebPromotionMarket } from '@/lib/tradetracker/promotions/select-displayable';
import type { Metadata } from 'next';
import { DM_Sans, Playfair_Display } from 'next/font/google';
import { headers } from 'next/headers';
import Link from 'next/link';

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-vw-serif',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-vw-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Aanbiedingen | VacationWeb',
  description: 'Extra voordeel op een selectie vakanties.',
};

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function marketsForHost(host: string | null): VacationWebPromotionMarket[] {
  const market = resolveSiteMarketFromHost(host);
  if (market === 'be') {
    return ['be'];
  }
  if (market === 'nl') {
    return ['nl'];
  }
  return ['nl', 'be'];
}

export default async function AanbiedingenPage() {
  const host = headers().get('host');
  const markets = marketsForHost(host);
  const loaded = await loadAanbiedingenByMarkets(markets);
  const sections = loaded.map((section) => {
    return {
      market: section.market,
      offers: presentAanbiedingenOffers(section.market, section.error ? [] : section.cards),
      error: false,
    };
  });

  return (
    <div
      className={`${playfair.variable} ${dmSans.variable} min-h-screen bg-[#FBF6F0] text-[#0A2D62] antialiased`}
      style={{
        fontFamily: 'var(--font-vw-sans), system-ui, sans-serif',
        backgroundImage: 'linear-gradient(180deg, #E5F4FC 0%, #FBF6F0 320px)',
      }}
    >
      <ResultsSiteHeader />
      <main className="mx-auto max-w-[1180px] px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-6 sm:mb-12">
          <div className="max-w-[40rem]">
            <p className="text-[12px] font-semibold uppercase tracking-[0.32em] text-[#8A6A32]">Aanbiedingen</p>
            <span className="mt-4 block h-[3px] w-12 rounded-full bg-[#E8C547]" aria-hidden />
            <h1
              className="mt-4 max-w-[14ch] text-[2.7rem] font-semibold leading-[1.02] tracking-[-0.035em] text-[#0A2D62] sm:text-[3.5rem]"
              style={{ fontFamily: 'var(--font-vw-serif), Georgia, serif' }}
            >
              Zin in je volgende vakantie?
            </h1>
            <p className="mt-4 max-w-[34rem] text-[17px] leading-relaxed text-[#243E68]">
              Extra voordeel bij onze reispartners. Kies een actie en plan je reis.
            </p>
          </div>
          <Link href="/" className="text-[14px] font-medium text-[#0A2D62] underline decoration-[#E4D8C4] underline-offset-4">
            Terug naar home
          </Link>
        </div>
        <AanbiedingenExperience sections={sections} showMarketTitles={markets.length > 1} />
      </main>
      <ResultsUspBar />
    </div>
  );
}
