import Link from 'next/link';

const navLinks = [
  { label: 'Bestemmingen', href: '/results' },
  { label: "Thema's", href: '/search' },
  { label: 'Deals', href: '/results' },
  { label: 'Inspiratie', href: '/search' },
  { label: 'Over ons', href: '/search' },
];

function SunLogoIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <circle cx="14" cy="14" r="7" fill="#F5B301" />
      <path
        stroke="#F5B301"
        strokeWidth="2"
        strokeLinecap="round"
        d="M14 3v2M14 23v2M3 14h2M23 14h2M6.5 6.5l1.4 1.4M20.1 20.1l1.4 1.4M6.5 21.5l1.4-1.4M20.1 7.9l1.4-1.4"
      />
    </svg>
  );
}

export function HomeHeader() {
  return (
    <header className="flex items-center justify-between gap-6 py-4">
      <Link href="/" className="flex items-center gap-2.5">
        <SunLogoIcon />
        <span className="text-lg font-semibold text-white">VacationWeb</span>
      </Link>

      <nav className="hidden items-center gap-8 lg:flex">
        {navLinks.map((link) => (
          <Link
            key={link.label}
            href={link.href}
            className="text-sm font-medium text-white/90 transition hover:text-white"
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <Link
        href="/search"
        className="inline-flex rounded-lg border border-white/80 px-5 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
      >
        Inloggen
      </Link>
    </header>
  );
}
