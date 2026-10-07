import { AanbiedingenPromotionList } from '@/components/promotions/aanbiedingen-promotion-list';
import { AanbiedingenStateMessage } from '@/components/promotions/aanbiedingen-state-message';
import { ResultsSiteHeader } from '@/components/results-v2/results-site-header';
import { loadDisplayablePromotions } from '@/lib/tradetracker/promotions/load-for-page';
import {
  joinProviderNames,
  providerFilterOptions,
  toPromotionCards,
} from '@/lib/tradetracker/promotions/present-promotions';
import type { Metadata } from 'next';

const PAGE_TITLE = 'Vakantie-aanbiedingen en acties | VacationWeb';
const PAGE_DESCRIPTION =
  'Actuele vakantieacties en kortingen van reisaanbieders, overzichtelijk bij elkaar. Bekijk de actie en boek rechtstreeks bij de aanbieder.';

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  openGraph: { title: PAGE_TITLE, description: PAGE_DESCRIPTION, type: 'website' },
};

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SERIF = { fontFamily: 'var(--font-vw-serif), Georgia, serif' } as const;

export default async function AanbiedingenPage() {
  const { promotions, error } = await loadDisplayablePromotions();
  const cards = error ? [] : toPromotionCards(promotions);
  const providers = providerFilterOptions(cards);

  return (
    <div className="min-h-screen bg-[#F7F5F1]">
      <ResultsSiteHeader />
      <main>
        <section
          aria-labelledby="aanbiedingen-title"
          className="mx-auto max-w-[1120px] px-6 pb-10 pt-12 sm:pt-16 lg:px-8 lg:pb-12 lg:pt-20"
        >
          <span aria-hidden className="block h-[3px] w-12 rounded-full bg-[#89ACD3]" />
          <h1
            id="aanbiedingen-title"
            style={SERIF}
            className="mt-5 text-[38px] font-semibold leading-[1.1] tracking-tight text-[#0A2D62] sm:text-[48px]"
          >
            Aanbiedingen
          </h1>
          <p className="mt-4 max-w-[34rem] text-[17px] leading-relaxed text-[#475569]">
            Actuele vakantieacties en kortingen van reisaanbieders.
          </p>
        </section>

        <section
          aria-labelledby="aanbiedingen-list-title"
          className="mx-auto max-w-[1120px] px-6 pb-16 lg:px-8 lg:pb-24"
        >
          <div className="mb-6 flex flex-col gap-1">
            <h2
              id="aanbiedingen-list-title"
              style={SERIF}
              className="text-[24px] font-semibold tracking-tight text-[#0A2D62]"
            >
              Actuele aanbiedingen
            </h2>
            {cards.length > 0 ? (
              <p className="text-[14px] text-[#475569]">
                {cards.length === 1 ? '1 actie' : `${cards.length} acties`} van{' '}
                {joinProviderNames(providers.map((provider) => provider.name))}
              </p>
            ) : null}
          </div>

          {error ? (
            <AanbiedingenStateMessage
              title="Aanbiedingen zijn tijdelijk niet beschikbaar."
              body="We kunnen de acties nu niet laden. Probeer het later opnieuw."
            />
          ) : cards.length === 0 ? (
            <AanbiedingenStateMessage
              title="Op dit moment hebben we geen actieve aanbiedingen."
              body="Kom binnenkort terug, of ontdek alvast waar je naartoe kunt reizen."
            />
          ) : (
            <>
              <AanbiedingenPromotionList cards={cards} providers={providers} />
              <p className="mt-10 max-w-[44rem] text-[13px] leading-relaxed text-[#475569]">
                De acties, voorwaarden en prijzen worden bepaald door de reisaanbieder en kunnen
                wijzigen. Je boekt rechtstreeks bij de reisaanbieder.
              </p>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
