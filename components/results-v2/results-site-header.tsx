'use client';

import { FavoritesNavLink } from '@/components/favorites/favorites-nav-link';
import { LanguageSwitcher } from '@/components/i18n/language-switcher';
import { useChromeCopy } from '@/components/i18n/ui-language-provider';
import { SITE_NAV_ITEMS } from '@/lib/site/site-nav';
import Image from 'next/image';
import Link from 'next/link';

function NavChevron() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden className="ml-0.5 shrink-0 opacity-70">
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Vacation Next site header (Results, detail, Bestemmingen, Aanbiedingen, Favorieten, Ontdekt,
 * legal pages). Same main nav as the homepage header (`SITE_NAV_ITEMS`; t66u: no "Zoeken", no
 * legacy `/search` links) plus the language indicator (globe, never a flag).
 */
export function ResultsSiteHeader() {
  const copy = useChromeCopy();
  return (
    <header className="border-b border-[#E8ECF2] bg-white">
      <div className="mx-auto flex h-[64px] max-w-[1600px] items-center justify-between gap-6 px-6 lg:px-8">
        <Link href="/" className="inline-flex shrink-0 items-center">
          <Image
            src="/images/logo.png"
            alt="VacationWeb"
            width={119}
            height={40}
            priority
            className="h-[36px] w-auto"
          />
        </Link>

        <div className="flex items-center gap-7">
          <nav className="hidden items-center gap-7 lg:flex" aria-label={copy.nav.ariaLabel}>
            {SITE_NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex items-center text-[14px] font-medium text-[#334155] transition hover:text-[#0A2D62]"
              >
                {copy.nav[item.key]}
                {item.key === 'destinations' ? <NavChevron /> : null}
              </Link>
            ))}
            <FavoritesNavLink label={copy.header.favorites} />
          </nav>
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
