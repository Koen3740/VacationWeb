import {
  RESULTS_BORDER,
  RESULTS_CTA,
  RESULTS_MUTED,
  RESULTS_NAVY,
  RESULTS_PANEL_BG,
  RESULTS_PANEL_SHADOW,
} from '@/components/results-v2/results-design-tokens';

const KEY_POINTS = [
  'Onafhankelijke vergelijking',
  'Meerdere reispartners vergelijken',
  'Meer vakantie voor jouw budget',
  'Boeken doe je rechtstreeks bij de reispartner',
] as const;

export function HomeWhyVacationWeb() {
  return (
    <section className="mx-auto max-w-[1200px] px-6 py-12 lg:px-8 lg:py-14">
      <div
        className="rounded-[16px] border px-6 py-8 sm:px-8 sm:py-9 lg:px-10"
        style={{
          backgroundColor: RESULTS_PANEL_BG,
          borderColor: RESULTS_BORDER,
          boxShadow: RESULTS_PANEL_SHADOW,
        }}
      >
        <h2 className="text-[22px] font-bold tracking-tight sm:text-[26px]" style={{ color: RESULTS_NAVY }}>
          Waarom VacationWeb
        </h2>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed sm:text-[16px]" style={{ color: RESULTS_MUTED }}>
          VacationWeb is een onafhankelijke vakantievergelijker. Je doorzoekt één overzicht en
          kiest daarna een aanbod dat bij je past.
        </p>

        <ul className="mt-7 grid gap-3 sm:grid-cols-2 sm:gap-x-8 sm:gap-y-3.5">
          {KEY_POINTS.map((point) => (
            <li key={point} className="flex items-start gap-2.5">
              <span
                className="mt-0.5 text-[14px] font-bold leading-none"
                style={{ color: RESULTS_CTA }}
                aria-hidden="true"
              >
                ✓
              </span>
              <span className="text-[14px] leading-snug text-[#334155] sm:text-[15px]">{point}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
