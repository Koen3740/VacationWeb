import {
  RESULTS_BORDER,
  RESULTS_CTA,
  RESULTS_NAVY,
  RESULTS_PANEL_BG,
  RESULTS_PANEL_SHADOW,
} from '@/components/results-v2/results-design-tokens';

/** Exact SSOT points (Blueprint §7). */
const KEY_POINTS = [
  'Eén keer zoeken, meerdere aanbieders vergelijken — vul je wensen één keer in en vergelijk passend aanbod.',
  'Ontdek ook wat je zelf niet had gevonden — meerdere aanbieders naast elkaar kunnen vakanties, bestemmingen en mogelijkheden tonen die je anders mist.',
  'Haal meer uit je budget — vergelijk vakanties, prijzen en mogelijkheden.',
  'Echt onafhankelijk vergelijken — geen voorkeur voor één aanbieder.',
  'Rechtstreeks boeken — na je keuze boek je rechtstreeks bij de aanbieder.',
] as const;

export function HomeWhyVacationWeb() {
  return (
    <section id="waarom-vacationweb" className="mx-auto max-w-[1600px] px-6 py-10 lg:px-8 lg:py-12">
      <div className="max-w-2xl">
        <h2 className="text-[22px] font-bold tracking-tight" style={{ color: RESULTS_NAVY }}>
          Waarom VacationWeb?
        </h2>
        <p className="mt-1.5 text-[16px] font-semibold text-[#0A2D62]">Vergelijk meer. Kies beter.</p>
      </div>

      <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:gap-4">
        {KEY_POINTS.map((point) => (
          <li
            key={point}
            className="flex items-start gap-3 rounded-[16px] border p-4"
            style={{
              backgroundColor: RESULTS_PANEL_BG,
              borderColor: RESULTS_BORDER,
              boxShadow: RESULTS_PANEL_SHADOW,
            }}
          >
            <span className="mt-0.5 text-[15px] font-bold" style={{ color: RESULTS_CTA }} aria-hidden>
              ✓
            </span>
            <span className="min-w-0 text-[13.5px] leading-snug text-[#334155]">{point}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
