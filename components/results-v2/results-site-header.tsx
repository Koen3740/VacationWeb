import Image from 'next/image';
import Link from 'next/link';

const NAV_LINKS = [
  { label: 'Zo werkt het', href: '/search' },
  { label: 'Inspiratie', href: '/search' },
  { label: 'Bestemmingen', href: '/results', hasChevron: true },
  { label: 'Aanbiedingen', href: '/results' },
  { label: 'Over ons', href: '/search' },
] as const;

function HeartIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
      <path
        d="M12 20.5 5.5 13.8a4.7 4.7 0 0 1 0-6.6 4.5 4.5 0 0 1 6.4 0L12 7.1l.1-.1a4.5 4.5 0 0 1 6.4 0 4.7 4.7 0 0 1 0 6.6L12 20.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function NavChevron() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden className="ml-0.5 shrink-0 opacity-70">
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ResultsSiteHeader() {
  return (
    <header className="border-b border-[#E8ECF2] bg-white">
      <div className="mx-auto flex h-[64px] max-w-[1280px] items-center justify-between gap-6 px-6 lg:px-8">
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
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="inline-flex items-center text-[14px] font-medium text-[#334155] transition hover:text-[#0A2D62]"
            >
              {link.label}
              {'hasChevron' in link && link.hasChevron ? <NavChevron /> : null}
            </Link>
          ))}
          <span className="inline-flex items-center gap-1.5 text-[14px] font-medium text-[#334155]">
            <HeartIcon />
            Favorieten
          </span>
        </nav>
      </div>
    </header>
  );
}
