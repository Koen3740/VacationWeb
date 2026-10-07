import {
  RESULTS_BORDER,
  RESULTS_CARD_BG,
  RESULTS_MUTED,
  RESULTS_NAVY,
  RESULTS_PAGE_BG,
} from '@/components/results-v2/results-design-tokens';

type HomeSectionPlaceholderProps = {
  id: string;
  eyebrow: string;
  title: string;
  note: string;
  /** Taller editorial block for image-first sections */
  tall?: boolean;
};

/**
 * Phase-1 shell only: visual rhythm placeholder for upcoming homepage sections.
 * No Discover/Results funnel simulation.
 */
export function HomeSectionPlaceholder({
  id,
  eyebrow,
  title,
  note,
  tall = false,
}: HomeSectionPlaceholderProps) {
  return (
    <section
      id={id}
      className="mx-auto max-w-[1600px] px-6 py-12 lg:px-8 lg:py-16"
      style={{ backgroundColor: RESULTS_PAGE_BG }}
    >
      <div
        className={`flex flex-col justify-end overflow-hidden rounded-[16px] border px-6 py-8 sm:px-8 sm:py-10 ${
          tall ? 'min-h-[280px] sm:min-h-[340px]' : 'min-h-[200px] sm:min-h-[240px]'
        }`}
        style={{
          backgroundColor: RESULTS_CARD_BG,
          borderColor: RESULTS_BORDER,
          backgroundImage:
            'linear-gradient(135deg, rgba(10,45,98,0.06) 0%, rgba(137,172,211,0.18) 55%, rgba(251,249,246,0.9) 100%)',
        }}
      >
        <p
          className="text-[11px] font-semibold uppercase tracking-[0.14em]"
          style={{ color: RESULTS_MUTED }}
        >
          {eyebrow}
        </p>
        <h2
          className="mt-2 max-w-xl text-[22px] font-bold tracking-tight sm:text-[26px]"
          style={{ color: RESULTS_NAVY }}
        >
          {title}
        </h2>
        <p className="mt-2 max-w-lg text-[14px] leading-relaxed" style={{ color: RESULTS_MUTED }}>
          {note}
        </p>
      </div>
    </section>
  );
}
