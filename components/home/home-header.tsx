import Image from 'next/image';
import Link from 'next/link';

const navLinks = [
  { label: 'Bestemmingen', href: '/results' },
  { label: "Thema's", href: '/search' },
  { label: 'Deals', href: '/results' },
  { label: 'Inspiratie', href: '/search' },
  { label: 'Over ons', href: '/search' },
];

export function HomeHeader() {
  return (
    <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 pt-2">
      <Link href="/" className="justify-self-start">
        <Image
          src="/images/logo.png"
          alt="VacationWeb"
          width={180}
          height={48}
          priority
          className="h-10 w-auto"
        />
      </Link>

      <nav className="hidden items-center gap-9 lg:flex">
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

      <div aria-hidden="true" className="hidden lg:block" />
    </header>
  );
}
