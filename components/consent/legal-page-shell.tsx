'use client';

import { useChromeCopy } from '@/components/i18n/ui-language-provider';
import { ResultsSiteHeader } from '@/components/results-v2/results-site-header';
import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Legal pages (/privacy, /cookies, /cookie-settings): Vacation Next site header (t66u: same
 * main nav + language indicator as the rest of the site) with the privacy sub-navigation below.
 * Legal content stays Dutch-only; in French the page says so instead of pretending otherwise.
 */
export function LegalPageShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const copy = useChromeCopy();
  const nav = [
    { href: '/privacy', label: copy.footer.privacy },
    { href: '/cookies', label: copy.footer.cookies },
    { href: '/cookie-settings', label: copy.footer.cookieSettings },
  ] as const;
  return (
    <div className="min-h-screen bg-[#FBF6F0] text-[#0A2D62]">
      <ResultsSiteHeader />
      <div className="border-b border-[#0A2D62]/10 bg-white">
        <nav
          className="mx-auto flex max-w-3xl flex-wrap gap-3 px-4 py-3 text-[12.5px] sm:px-6"
          aria-label={copy.legal.subnavAriaLabel}
        >
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-[#0A2D62]/80 underline-offset-2 hover:underline"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        {copy.legal.dutchOnlyNotice ? (
          <p
            lang="fr"
            className="mb-5 rounded-[10px] border border-[#D9E0EA] bg-white px-3 py-2 text-[13px] text-[#334155]"
            data-testid="dutch-only-notice"
          >
            {copy.legal.dutchOnlyNotice}
          </p>
        ) : null}
        <h1 lang="nl" className="text-[28px] font-bold tracking-tight text-[#0A2D62]">
          {title}
        </h1>
        <div lang="nl" className="mt-6 space-y-5 text-[14.5px] leading-relaxed text-slate-700">
          {children}
        </div>
      </main>
    </div>
  );
}

/** Placeholder for fields that require OWNER/LEGAL INPUT — never invent values. */
export function OwnerLegalInput({ label }: { label: string }) {
  return (
    <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[12px] font-medium text-amber-900 ring-1 ring-amber-200">
      OWNER/LEGAL INPUT OPEN — {label}
    </span>
  );
}
