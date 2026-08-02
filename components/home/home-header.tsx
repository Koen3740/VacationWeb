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

export function HomeHeader() {
  return (
    <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 pt-2">
      <Link
        href="/"
        className="inline-flex items-center justify-self-start rounded-2xl bg-white px-6 py-3 shadow-[0_2px_6px_rgba(0,0,0,0.05)]"
      >
        <Image
          src="/images/logo.png"
          alt="VacationWeb"
          width={119}
          height={40}
          priority
          className="h-10 w-auto"
        />
      </Link>

      <nav className="hidden items-center gap-9 lg:flex" aria-label="Hoofdnavigatie">
        {navLinks.map((link) => (
          <Link
            key={link.label}
            href={link.href}
            className="text-[15px] font-medium text-white transition hover:text-white/80"
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="justify-self-end lg:hidden">
        <HomeMobileNav links={navLinks} />
      </div>

      <div aria-hidden="true" className="hidden lg:block" />
    </header>
  );
}
