import { RESULTS_MUTED, RESULTS_NAVY } from '@/components/results-v2/results-design-tokens';

export function HomeSeoContent() {
  return (
    <section id="seo-content" className="mx-auto max-w-[1600px] px-6 py-10 lg:px-8 lg:py-12">
      <div className="max-w-3xl">
        <h2 className="text-[22px] font-bold tracking-tight" style={{ color: RESULTS_NAVY }}>
          Vakantie vergelijken en inspiratie
        </h2>
        <div className="mt-3 space-y-3 text-[14px] leading-relaxed" style={{ color: RESULTS_MUTED }}>
          <p>
            Op VacationWeb vergelijk je vakanties van meerdere reisaanbieders in één zoekopdracht.
            Zo zie je sneller welke bestemming, reisduur en aanbieder het beste bij jouw plannen
            passen — zonder bij elke site opnieuw te beginnen.
          </p>
          <p>
            Laat je inspireren door populaire bestemmingen en redactionele tips, of start direct
            met zoeken op land, regio of plaats. Na je vergelijking boek je rechtstreeks bij de
            reisorganisatie die jij kiest.
          </p>
        </div>
      </div>
    </section>
  );
}
