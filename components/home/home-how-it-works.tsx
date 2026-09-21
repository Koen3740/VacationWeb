import {
  RESULTS_BORDER,
  RESULTS_CTA,
  RESULTS_MUTED,
  RESULTS_NAVY,
  RESULTS_PANEL_BG,
  RESULTS_PANEL_SHADOW,
} from '@/components/results-v2/results-design-tokens';

const STEPS = [
  {
    title: 'Kies een bestemming',
    body: 'Blader door landen, steden en reistypes voor inspiratie.',
  },
  {
    title: 'Vergelijk reizen',
    body: 'Bekijk de aanbieders en aanbiedingen die bij jouw reis passen.',
  },
  {
    title: 'Boek bij de aanbieder',
    body: 'Klik door en boek rechtstreeks bij de reisorganisatie.',
  },
  {
    title: 'Geniet van je reis',
    body: 'Pak je koffers en vertrek met een gerust hart.',
  },
] as const;

export function HomeHowItWorks() {
  return (
    <section id="zo-werkt" className="mx-auto max-w-[1600px] px-6 py-10 lg:px-8 lg:py-12">
      <h2 className="text-[22px] font-bold tracking-tight" style={{ color: RESULTS_NAVY }}>
        Zo werkt VacationWeb
      </h2>

      <ol className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
        {STEPS.map((step, index) => (
          <li
            key={step.title}
            className="rounded-[16px] border p-4 sm:p-5"
            style={{
              backgroundColor: RESULTS_PANEL_BG,
              borderColor: RESULTS_BORDER,
              boxShadow: RESULTS_PANEL_SHADOW,
            }}
          >
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-bold text-white"
              style={{ backgroundColor: RESULTS_CTA }}
              aria-hidden="true"
            >
              {index + 1}
            </span>
            <h3 className="mt-3 text-[15px] font-bold text-[#0A2D62]">{step.title}</h3>
            <p className="mt-1.5 text-[13.5px] leading-relaxed" style={{ color: RESULTS_MUTED }}>
              {step.body}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
