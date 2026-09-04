import { FavoritesNavLink } from '@/components/favorites/favorites-nav-link';
import { HomeMobileNav } from '@/components/home/home-mobile-nav';
import Image from 'next/image';
import Link from 'next/link';

const navLinks = [
  { label: 'Bestemmingen', href: '/results' },
  { label: "Thema's", href: '/search' },
  { label: 'Deals', href: '/results' },
  { label: 'Inspiratie', href: '/search' },
  { label: 'Over ons', href: '/search' },
] as const;

function AccountPlaceholderIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M5 20c1.5-3.5 4.5-5.5 7-5.5s5.5 2 7 5.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function HomeHeader() {
  return (
    <header className="flex h-[64px] items-center gap-6">
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

      <nav className="hidden flex-1 items-center justify-center gap-7 lg:flex" aria-label="Hoofdnavigatie">
        {navLinks.map((link) => (
          <Link
            key={link.label}
            href={link.href}
            className="text-[14px] font-medium text-[#334155] transition hover:text-[#0A2D62]"
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-1 sm:gap-2 lg:gap-3">
        <span
          aria-hidden="true"
          className="hidden items-center gap-1.5 px-2 py-2 text-[14px] font-medium text-[#334155] sm:inline-flex"
        >
          <AccountPlaceholderIcon />
          Account
        </span>
        <FavoritesNavLink className="hidden items-center gap-1.5 px-2 py-2 text-[14px] font-medium text-[#334155] transition hover:text-[#0A2D62] md:inline-flex" />
        <div className="lg:hidden">
          <HomeMobileNav links={navLinks} />
        </div>
      </div>
    </header>
  );
}
