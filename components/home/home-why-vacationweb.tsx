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
    <section className="mx-auto max-w-[1200px] px-6 py-10 lg:px-8 lg:py-12">
      <div
        className="rounded-[16px] border px-5 py-6 sm:px-7 sm:py-7 lg:px-8"
        style={{
          backgroundColor: RESULTS_PANEL_BG,
          borderColor: RESULTS_BORDER,
          boxShadow: RESULTS_PANEL_SHADOW,
        }}
      >
        <h2 className="text-[22px] font-bold tracking-tight" style={{ color: RESULTS_NAVY }}>
          Waarom VacationWeb
        </h2>
        <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed sm:text-[14px]" style={{ color: RESULTS_MUTED }}>
          VacationWeb is een onafhankelijke vakantievergelijker. Je doorzoekt één overzicht en
          kiest daarna een aanbod dat bij je past.
        </p>

        <ul className="mt-5 grid gap-2.5 sm:grid-cols-2 sm:gap-x-8 sm:gap-y-3">
          {KEY_POINTS.map((point) => (
            <li key={point} className="flex items-start gap-2.5">
              <span
                className="mt-0.5 text-[14px] font-bold leading-none"
                style={{ color: RESULTS_CTA }}
                aria-hidden="true"
              >
                ✓
              </span>
              <span className="text-[13.5px] leading-snug text-[#334155]">{point}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
