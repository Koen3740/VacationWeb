'use client';

import { HomeMobileNav } from '@/components/home/home-mobile-nav';
import { LanguageSwitcher } from '@/components/i18n/language-switcher';
import { useChromeCopy } from '@/components/i18n/ui-language-provider';
import { SITE_NAV_ITEMS } from '@/lib/site/site-nav';
import Link from 'next/link';

function ProfileIcon() {
  return (
    <span
      className="inline-flex h-7 w-7 items-center justify-center text-white"
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
    <header className="absolute inset-x-0 top-0 z-40 bg-transparent text-white">
      <div className="mx-auto flex h-[64px] w-full max-w-[1180px] items-center justify-between gap-3 px-[18px] sm:h-[76px] sm:px-[clamp(20px,4vw,56px)]">
        <Link href="/" className="inline-flex min-w-0 items-center gap-2 [text-shadow:0_1px_12px_rgba(0,0,0,0.25)]">
          <span className="font-vw-serif text-[26px] font-medium leading-none">W</span>
          <span className="font-vw-serif text-[22px] font-medium leading-none tracking-[-0.01em] sm:text-[24px]">
            VacationWeb
          </span>
        </Link>

        <nav className="hidden items-center gap-7 xl:flex" aria-label={copy.nav.ariaLabel}>
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-[14.5px] font-medium text-white/90 transition hover:text-white [text-shadow:0_1px_10px_rgba(0,0,0,0.3)]"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/favorieten"
            className="vw-glass-chip hidden gap-1.5 text-[13px] font-medium text-white transition hover:bg-white/20 sm:inline-flex"
            aria-label={copy.header.saved}
          >
            <HeartIcon />
            <span className="hidden lg:inline">{copy.header.saved}</span>
          </Link>
          <span className="vw-glass-chip hidden h-9 w-9 p-0 lg:inline-flex" title={copy.header.account}>
            <ProfileIcon />
          </span>
          <LanguageSwitcher tone="onPhoto" />
          <div className="xl:hidden">
            <HomeMobileNav
              links={[...navLinks, { label: copy.header.saved, href: '/favorieten' }]}
              labels={{ ...copy.mobileNav, navigation: copy.nav.ariaLabel }}
              buttonClassName="vw-glass-chip inline-flex h-9 w-9 p-0 text-white hover:bg-white/20"
            />
          </div>
        </div>
      </div>
    </header>
  );
}
