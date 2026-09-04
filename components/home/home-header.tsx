import { FavoritesNavLink } from '@/components/favorites/favorites-nav-link';
import { HomeMobileNav } from '@/components/home/home-mobile-nav';
import Image from 'next/image';
import Link from 'next/link';

/** Same IA + chrome as ResultsSiteHeader (width 1600). */
const navLinks = [
  { label: 'Zo werkt het', href: '/search' },
  { label: 'Inspiratie', href: '/search' },
  { label: 'Bestemmingen', href: '/results', hasChevron: true },
  { label: 'Aanbiedingen', href: '/results' },
  { label: 'Over ons', href: '/search' },
] as const;

function NavChevron() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className="ml-0.5 shrink-0 opacity-70"
    >
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function HomeHeader() {
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

        <nav className="hidden items-center gap-7 lg:flex" aria-label="Hoofdnavigatie">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="inline-flex items-center text-[14px] font-medium text-[#334155] transition hover:text-[#0A2D62]"
            >
              {link.label}
              {'hasChevron' in link && link.hasChevron ? <NavChevron /> : null}
            </Link>
          ))}
          <FavoritesNavLink />
        </nav>

        <div className="lg:hidden">
          <HomeMobileNav links={navLinks.map(({ label, href }) => ({ label, href }))} />
        </div>
      </div>
    </header>
  );
}
