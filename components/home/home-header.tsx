'use client';

import { HomeMobileNav } from '@/components/home/home-mobile-nav';
import { LanguageSwitcher } from '@/components/i18n/language-switcher';
import { useChromeCopy } from '@/components/i18n/ui-language-provider';
import { SITE_NAV_ITEMS } from '@/lib/site/site-nav';
import Link from 'next/link';

function ProfileIcon() {
  return (
    <span
      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#D6D0C4] bg-white/80 text-[#0A2D62]"
      aria-hidden
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M5 19c1.5-3.5 4-5 7-5s5.5 1.5 7 5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

function HeartIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * WOW header — logo W + tagline, shared main nav (no "Zoeken": the search module is the
 * primary search entry), Opgeslagen, profile, language indicator (globe, never a flag; t66u).
 */
export function HomeHeader() {
  const copy = useChromeCopy();
  const navLinks = SITE_NAV_ITEMS.map((item) => ({ label: copy.nav[item.key], href: item.href }));
  return (
    <header className="relative z-50 bg-[#E8EDF4]">
      <div className="mx-auto flex h-[56px] w-[86.8vw] items-center justify-between gap-3 px-4 sm:h-[70px] sm:px-6 lg:px-0">
        <Link href="/" className="inline-flex min-w-0 items-center gap-2">
          <span
            className="text-[52px] font-bold leading-none text-[#0A2D62] drop-shadow-sm"
            style={{ fontFamily: 'var(--font-vw-serif), Georgia, serif' }}
          >
            W
          </span>
          <span className="min-w-0">
            <span className="block text-[22px] font-bold leading-none tracking-tight text-[#0A2D62]">
              VacationWeb
            </span>
            <span className="mt-0.5 hidden text-[9.5px] leading-tight text-[#334155]/90 min-[900px]:block">
              Discover more. Travel smarter.
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-5 xl:flex" aria-label={copy.nav.ariaLabel}>
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-[13.5px] font-medium text-[#1E293B] transition hover:text-[#0A2D62]"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2.5 sm:gap-3.5">
          <Link
            href="/favorieten"
            className="hidden items-center gap-1.5 text-[13px] font-medium text-[#1E293B] transition hover:text-[#0A2D62] sm:inline-flex"
          >
            <HeartIcon />
            {copy.header.saved}
          </Link>
          <span className="hidden lg:inline-flex" title={copy.header.account}>
            <ProfileIcon />
          </span>
          <LanguageSwitcher />
          <div className="xl:hidden">
            <HomeMobileNav
              links={[...navLinks, { label: copy.header.saved, href: '/favorieten' }]}
              labels={{ ...copy.mobileNav, navigation: copy.nav.ariaLabel }}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
