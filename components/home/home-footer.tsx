import { HomeFooterCookieLink } from '@/components/home/home-footer-cookie-link';
import { RESULTS_MUTED, RESULTS_NAVY, RESULTS_PAGE_BG } from '@/components/results-v2/results-design-tokens';
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

/**
 * Results has no multi-column footer (ends on USP). Homepage keeps legal/IA links
 * in the same light chrome language: white surface, cool `#E8ECF2` borders, muted links.
 */
const footerLinkClassName =
  'text-[14px] text-[#64748B] transition hover:text-[#0A2D62]';
const footerHeadingClassName =
  'text-[14px] font-semibold tracking-tight text-[#0A2D62]';

export function HomeFooter() {
  return (
    <footer className="mt-2 border-t border-[#E8ECF2] bg-white">
      <div className="mx-auto max-w-[1600px] px-6 py-10 lg:px-8 lg:py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          <div>
            <p className="text-[18px] font-bold tracking-tight" style={{ color: RESULTS_NAVY }}>
              VacationWeb
            </p>
            <ul className="mt-4 space-y-2.5">
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
            <ul className="mt-4 space-y-2.5">
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
            <ul className="mt-4 space-y-2.5">
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
            <ul className="mt-4 space-y-2.5">
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

      <div className="border-t border-[#DCE4EE]" style={{ backgroundColor: RESULTS_PAGE_BG }}>
        <div className="mx-auto flex max-w-[1600px] flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <p className="text-[13px]" style={{ color: RESULTS_MUTED }}>
            © VacationWeb 2026
          </p>
          <nav aria-label="Footer juridische links">
            <ul className="flex flex-wrap gap-x-5 gap-y-2">
              {bottomBarLinks.map((link) => (
                <li key={link.label}>
                  {link.href ? (
                    <Link
                      href={link.href}
                      className="text-[13px] transition hover:text-[#0A2D62]"
                      style={{ color: RESULTS_MUTED }}
                    >
                      {link.label}
                    </Link>
                  ) : (
                    <HomeFooterCookieLink className="text-[13px] text-[#64748B] transition hover:text-[#0A2D62]" />
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
