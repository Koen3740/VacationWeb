import { HomeMobileNav } from '@/components/home/home-mobile-nav';
import Link from 'next/link';

const navLinks = [
  { label: 'Discover', href: '/#ontdekt' },
  { label: 'Zoeken', href: '/#hero' },
  { label: 'Bestemmingen', href: '/bestemmingen' },
  { label: 'Inspiratie', href: '/#inspiratie' },
  { label: 'Aanbod', href: '/aanbiedingen' },
  { label: 'Over ons', href: '/#value' },
] as const;

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

/** WOW header — logo W + tagline, nav, Opgeslagen, profile, NL. */
export function HomeHeader() {
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

        <nav className="hidden items-center gap-5 xl:flex" aria-label="Hoofdnavigatie">
          {navLinks.map((link) => (
            <Link
              key={link.label}
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
            Opgeslagen
          </Link>
          <span className="hidden lg:inline-flex" title="Account">
            <ProfileIcon />
          </span>
          <span className="hidden items-center gap-1.5 text-[12px] font-semibold text-[#0A2D62] lg:inline-flex">
            <span className="inline-block h-3.5 w-5 overflow-hidden rounded-[2px] ring-1 ring-black/10" aria-hidden>
              <span className="block h-[5px] w-full bg-[#AE1C28]" />
              <span className="block h-[4px] w-full bg-white" />
              <span className="block h-[5px] w-full bg-[#21468B]" />
            </span>
            NL
            <span aria-hidden className="text-[10px] text-[#64748B]">
              ▾
            </span>
          </span>
          <div className="xl:hidden">
            <HomeMobileNav
              links={[
                ...navLinks.map(({ label, href }) => ({ label, href })),
                { label: 'Opgeslagen', href: '/favorieten' },
              ]}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
