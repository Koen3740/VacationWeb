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

export function ResultsWhyCard({
  tone = 'default',
}: {
  /** `results` follows Layout A and is hidden inside the mobile filter sheet. */
  tone?: 'default' | 'results';
}) {
  return (
    <div
      className={`mt-4 rounded-vw-panel border p-4 min-[901px]:px-[18px] min-[901px]:py-4 ${
        tone === 'results' ? 'max-[900px]:hidden' : ''
      }`}
      style={{
        backgroundColor: tone === 'results' ? 'var(--vw-panel)' : RESULTS_PANEL_BG,
        borderColor: tone === 'results' ? 'var(--vw-line)' : RESULTS_BORDER,
        boxShadow: tone === 'results' ? 'var(--vw-shadow-panel)' : RESULTS_PANEL_SHADOW,
      }}
    >
      <h2
        className={`text-[#0A2D62] ${
          tone === 'results'
            ? 'font-vw-serif text-[16px] font-semibold'
            : 'text-[17px] font-bold'
        }`}
      >
        Waarom VacationWeb?
      </h2>
      <ul className="mt-2 space-y-1">
        {POINTS.map((point) => (
          <li key={point} className="flex items-start gap-2 text-[13.5px] leading-snug text-[#334155]">
            <span
              className="mt-0.5 text-[14px] font-bold"
              style={{ color: tone === 'results' ? 'var(--vw-green)' : RESULTS_CTA }}
              aria-hidden
            >
              ✓
            </span>
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
