import { HomeFooterCookieLink } from '@/components/home/home-footer-cookie-link';
import Link from 'next/link';

const brandLinks = [
  { label: 'Over VacationWeb', href: '/search' },
  { label: 'Hoe werkt VacationWeb', href: '/search' },
  { label: 'FAQ', href: '/search' },
] as const;

const discoverLinks = [
  { label: 'Bestemmingen', href: '/results' },
  { label: 'Vakantietypes', href: '/search' },
  { label: 'Deals', href: '/results' },
  { label: 'Inspiratie', href: '/search' },
] as const;

const aboutLinks = [
  { label: 'Contact', href: '/search' },
  { label: 'Over ons', href: '/search' },
] as const;

const legalLinks = [
  { label: 'Privacybeleid', href: '/search' },
  { label: 'Cookiebeleid', href: null },
  { label: 'Algemene voorwaarden', href: '/search' },
  { label: 'Disclaimer', href: '/search' },
] as const;

const bottomBarLinks = [
  { label: 'Privacybeleid', href: '/search' },
  { label: 'Cookiebeleid', href: null },
  { label: 'Algemene voorwaarden', href: '/search' },
  { label: 'Disclaimer', href: '/search' },
  { label: 'Sitemap', href: '/search' },
] as const;

const footerLinkClassName =
  'text-[15px] text-white/75 transition hover:text-white sm:text-base';
const footerHeadingClassName =
  'text-[15px] font-semibold tracking-[-0.01em] text-white sm:text-base';

export function HomeFooter() {
  return (
    <footer className="border-t border-[#0A2D62] bg-[#0A2D62]">
      <div className="mx-auto max-w-[1200px] px-4 py-14 sm:px-5 lg:px-8 lg:py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          <div>
            <p className="text-xl font-bold tracking-[-0.02em] text-white sm:text-2xl">
              VacationWeb
            </p>
            <ul className="mt-5 space-y-3">
              {brandLinks.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className={footerLinkClassName}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className={footerHeadingClassName}>Ontdekken</p>
            <ul className="mt-4 space-y-3">
              {discoverLinks.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className={footerLinkClassName}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className={footerHeadingClassName}>Over VacationWeb</p>
            <ul className="mt-4 space-y-3">
              {aboutLinks.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className={footerLinkClassName}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className={footerHeadingClassName}>Juridisch</p>
            <ul className="mt-4 space-y-3">
              {legalLinks.map((link) => (
                <li key={link.label}>
                  {link.href ? (
                    <Link href={link.href} className={footerLinkClassName}>
                      {link.label}
                    </Link>
                  ) : (
                    <HomeFooterCookieLink className={`${footerLinkClassName} text-left`} />
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-white/15 bg-[#081f45]">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-5 lg:px-8">
          <p className="text-sm text-white/60">© VacationWeb 2026</p>
          <nav aria-label="Footer juridische links">
            <ul className="flex flex-wrap gap-x-5 gap-y-2">
              {bottomBarLinks.map((link) => (
                <li key={link.label}>
                  {link.href ? (
                    <Link
                      href={link.href}
                      className="text-sm text-white/60 transition hover:text-white"
                    >
                      {link.label}
                    </Link>
                  ) : (
                    <HomeFooterCookieLink className="text-sm text-white/60 transition hover:text-white" />
                  )}
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}
