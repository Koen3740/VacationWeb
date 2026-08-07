import {
  RESULTS_BORDER,
  RESULTS_CTA,
  RESULTS_PANEL_BG,
  RESULTS_PANEL_SHADOW,
} from '@/components/results-v2/results-design-tokens';

const POINTS = [
  'Vergelijk meerdere reispartners',
  'Meer vakantie voor jouw budget',
  'Transparante prijzen',
  'Geen verborgen kosten',
  'Onafhankelijke vergelijking',
] as const;

export function ResultsWhyCard() {
  return (
    <div
      className="mt-4 rounded-[16px] border p-5"
      style={{
        backgroundColor: RESULTS_PANEL_BG,
        borderColor: RESULTS_BORDER,
        boxShadow: RESULTS_PANEL_SHADOW,
      }}
    >
      <h2 className="text-[17px] font-bold text-[#0A2D62]">Waarom VacationWeb?</h2>
      <ul className="mt-3 space-y-2.5">
        {POINTS.map((point) => (
          <li key={point} className="flex items-start gap-2.5 text-[13.5px] leading-snug text-[#334155]">
            <span className="mt-0.5 text-[14px] font-bold" style={{ color: RESULTS_CTA }} aria-hidden>
              ✓
            </span>
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
