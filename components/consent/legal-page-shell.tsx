import Link from 'next/link';
import type { ReactNode } from 'react';

const nav = [
  { href: '/privacy', label: 'Privacybeleid' },
  { href: '/cookies', label: 'Cookiebeleid' },
  { href: '/cookie-settings', label: 'Cookie-instellingen' },
] as const;

export function LegalPageShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#FBF6F0] text-[#0A2D62]">
      <header className="border-b border-[#0A2D62]/10 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="text-[15px] font-bold tracking-tight text-[#0A2D62]">
            VacationWeb
          </Link>
          <nav className="flex flex-wrap gap-3 text-[12.5px]" aria-label="Privacy navigatie">
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
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <h1 className="text-[28px] font-bold tracking-tight text-[#0A2D62]">{title}</h1>
        <div className="mt-6 space-y-5 text-[14.5px] leading-relaxed text-slate-700">{children}</div>
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
