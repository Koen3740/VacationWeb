import {
  RESULTS_BORDER,
  RESULTS_CARD_BG,
  RESULTS_CARD_SHADOW,
} from '@/components/results-v2/results-design-tokens';

/** Compact card-shaped fallback while a page-1 Prijsvrij Receipt slot resolves. */
export function TravelCardReceiptFallback() {
  return (
    <article
      aria-busy="true"
      aria-live="polite"
      className="overflow-hidden rounded-[16px] border"
      style={{
        backgroundColor: RESULTS_CARD_BG,
        borderColor: RESULTS_BORDER,
        boxShadow: RESULTS_CARD_SHADOW,
      }}
    >
      <div className="flex min-h-[190px] flex-col md:flex-row">
        <div className="w-full shrink-0 bg-[#EEF2F6] md:h-auto md:w-[320px] lg:w-[340px]" />
        <div className="flex flex-1 items-center justify-center p-4">
          <span
            className="h-7 w-7 animate-spin rounded-full border-2 border-[#89ACD3] border-t-[#0A2D62]"
            aria-hidden="true"
          />
        </div>
      </div>
    </article>
  );
}
