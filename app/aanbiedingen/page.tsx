import { AanbiedingenPromotionList } from '@/components/promotions/aanbiedingen-promotion-list';
import { ResultsSiteHeader } from '@/components/results-v2/results-site-header';
import { resolveSiteMarketFromHost } from '@/lib/search/site-market';
import { loadDisplayablePromotionsByMarkets } from '@/lib/tradetracker/promotions/load-for-page';
import type { VacationWebPromotionMarket } from '@/lib/tradetracker/promotions/select-displayable';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Aanbiedingen | VacationWeb',
  description: 'Actuele aanbiedingen van de reispartners van VacationWeb.',
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
  // Preview / localhost: show both markets separately (never mixed without labels).
  return ['nl', 'be'];
}

function marketTitle(market: VacationWebPromotionMarket): string {
  return market === 'be' ? 'België' : 'Nederland';
}

export default async function AanbiedingenPage() {
  const host = headers().get('host');
  const markets = marketsForHost(host);
  const sections = await loadDisplayablePromotionsByMarkets(markets);
  const total = sections.reduce((sum, section) => sum + section.promotions.length, 0);

  return (
    <div className="min-h-screen bg-[#F7F5F1]">
      <ResultsSiteHeader />
      <main className="mx-auto max-w-[800px] px-6 py-8 lg:px-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-bold tracking-tight text-[#0A2D62]">Aanbiedingen</h1>
            <p className="mt-1 max-w-[36rem] text-[14px] text-[#64748B]">
              Actuele acties van onze reispartners. Geen volledige vakantielijst — alleen echte
              promoties.
            </p>
          </div>
          <Link href="/" className="text-[13px] font-medium text-[#0A2D62] hover:underline">
            Terug naar home
          </Link>
        </div>

        <p className="mb-6 text-[13px] text-[#64748B]">
          {total === 0
            ? 'Momenteel geen actuele aanbiedingen'
            : total === 1
              ? '1 actuele aanbieding'
              : `${total} actuele aanbiedingen`}
        </p>

        <div className="space-y-10">
          {sections.map((section) => (
            <section key={section.market} aria-labelledby={`promotions-${section.market}`}>
              {markets.length > 1 ? (
                <h2
                  id={`promotions-${section.market}`}
                  className="mb-4 text-[18px] font-semibold tracking-tight text-[#0A2D62]"
                >
                  {marketTitle(section.market)}
                </h2>
              ) : (
                <h2 id={`promotions-${section.market}`} className="sr-only">
                  {marketTitle(section.market)}
                </h2>
              )}

              {section.error ? (
                <p className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-[14px] text-[#991B1B]">
                  Aanbiedingen konden nu niet worden geladen. Probeer het later opnieuw.
                </p>
              ) : (
                <AanbiedingenPromotionList
                  promotions={section.promotions}
                  emptyMessage={`Geen actuele aanbiedingen voor ${marketTitle(section.market)}.`}
                />
              )}
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
