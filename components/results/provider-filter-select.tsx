'use client';

import {
  RESULTS_NAVY,
} from '@/components/results-v2/results-design-tokens';
import { applyFilterNavigationPaging } from '@/lib/search/filter-navigation';
import { PROVIDER_FILTER_PARAM } from '@/lib/search/provider-filter';
import { useReportResultsNavigationBusy } from '@/components/results/results-navigation-busy';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition, type ReactNode } from 'react';

/** `count` is optional: matchset-based options carry no (misleading, momentary) B count. */
export type ProviderFilterOption = { provider: string; count?: number };

export type ProviderFilterSelectProps = {
  total: number;
  providers: ProviderFilterOption[];
  selectedProvider?: string;
};

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className={`shrink-0 text-[#64748B] transition-transform ${open ? 'rotate-180' : ''}`}
    >
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AccordionShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="border-b border-[#EDE8E0]">
      <div className="flex w-full items-center justify-between gap-3 py-[15px] text-left">
        <span className="flex min-w-0 items-center gap-2.5">
          <span
            className="h-3.5 w-[3px] shrink-0 rounded-full"
            style={{ backgroundColor: RESULTS_NAVY, opacity: 0.9 }}
            aria-hidden
          />
          <span className="text-[14.5px] font-semibold tracking-[-0.01em] text-[#0A2D62]">
            {title}
          </span>
        </span>
        <Chevron open />
      </div>
      <div className="pb-4 pl-[13px]">{children}</div>
    </div>
  );
}

const selectClassName =
  'h-11 w-full rounded-[10px] border border-[#D9E0EA] bg-white px-3 text-[14px] text-[#0A2D62] outline-none';

/**
 * Sidebar "Vakantieaanbieder" select. Writes `?provider=` and clears page/page1Ids
 * so a previous provider's freeze cannot leak into the next selection.
 */
export function ProviderFilterSelect({
  total: _total,
  providers,
  selectedProvider,
}: ProviderFilterSelectProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [optimisticProvider, setOptimisticProvider] = useState<string | undefined>(undefined);

  useReportResultsNavigationBusy(isPending);

  const selected = optimisticProvider ?? selectedProvider ?? '';
  const optionProviders =
    selected && !providers.some((entry) => entry.provider === selected)
      ? [...providers, { provider: selected }]
      : providers;

  useEffect(() => {
    setOptimisticProvider(undefined);
  }, [selectedProvider]);

  const onChange = (nextProvider: string) => {
    const params = new URLSearchParams(searchParams.toString());
    // Provider switch must not keep prior page1Ids (can pin wrong-provider cards).
    applyFilterNavigationPaging(params, {
      preservePage1Ids: false,
      liveQuery: typeof window === 'undefined' ? undefined : window.location.search,
    });
    if (nextProvider) {
      params.set(PROVIDER_FILTER_PARAM, nextProvider);
    } else {
      params.delete(PROVIDER_FILTER_PARAM);
    }
    const query = params.toString();
    setOptimisticProvider(nextProvider);
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  };

  return (
    <AccordionShell title="Vakantieaanbieder">
      <select
        value={selected}
        aria-label="Vakantieaanbieder"
        onChange={(event) => onChange(event.target.value)}
        className={selectClassName}
      >
        <option value="">Alle aanbieders</option>
        {optionProviders.map((entry) => (
          <option key={entry.provider} value={entry.provider}>
            {typeof entry.count === 'number' ? `${entry.provider} (${entry.count})` : entry.provider}
          </option>
        ))}
      </select>
    </AccordionShell>
  );
}

/** Shell fallback while effective-pool counts load. */
export function ProviderFilterSelectFallback({
  selectedProvider,
}: {
  selectedProvider?: string;
}) {
  return (
    <AccordionShell title="Vakantieaanbieder">
      <select
        value={selectedProvider ?? ''}
        disabled
        aria-label="Vakantieaanbieder"
        className={selectClassName}
      >
        <option value="">
          {selectedProvider ? `${selectedProvider} (…)` : 'Alle aanbieders'}
        </option>
      </select>
    </AccordionShell>
  );
}
