import {
  RESULTS_BORDER,
  RESULTS_MUTED,
  RESULTS_NAVY,
  RESULTS_PANEL_BG,
  RESULTS_PANEL_SHADOW,
} from '@/components/results-v2/results-design-tokens';

export function HomeSafeBooking() {
  return (
    <section id="veilig-boeken" className="mx-auto max-w-[1600px] px-6 py-10 lg:px-8 lg:py-12">
      <div
        className="max-w-3xl rounded-[16px] border p-5 sm:p-6"
        style={{
          backgroundColor: RESULTS_PANEL_BG,
          borderColor: RESULTS_BORDER,
          boxShadow: RESULTS_PANEL_SHADOW,
        }}
      >
        <h2 className="text-[22px] font-bold tracking-tight" style={{ color: RESULTS_NAVY }}>
          Veilig boeken
        </h2>
        <p className="mt-3 text-[15px] font-semibold leading-snug text-[#0A2D62]">
          Wij werken alleen met reisorganisaties met de nodige bescherming.
        </p>
        <p className="mt-2.5 text-[13.5px] leading-relaxed" style={{ color: RESULTS_MUTED }}>
          Welke bescherming van toepassing is kan verschillen per land, juridische entiteit en type
          reis. Waar relevant tonen we de betreffende bescherming, bijvoorbeeld SGR of het
          Calamiteitenfonds.
        </p>
      </div>
    </section>
  );
}
