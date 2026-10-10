'use client';

import { HomeFooterCookieLink } from '@/components/home/home-footer-cookie-link';
import { useChromeCopy } from '@/components/i18n/ui-language-provider';
import type { ChromeCopy } from '@/lib/i18n/chrome-copy';
import { SITE_NAV_ITEMS, type SiteNavKey } from '@/lib/site/site-nav';
import Link from 'next/link';

const ONTDEK_KEYS: readonly SiteNavKey[] = ['destinations', 'inspiration', 'offers'];

/** Footer link targets unchanged (t66u); labels from the chrome dictionary. */
function footerLinks(copy: ChromeCopy) {
  const navHref = (key: SiteNavKey) => SITE_NAV_ITEMS.find((item) => item.key === key)?.href ?? '/';
  return {
    ontdek: ONTDEK_KEYS.map((key) => ({ label: copy.nav[key], href: navHref(key) })),
    over: [
      { label: copy.footer.mission, href: '/#value' },
      { label: copy.footer.howItWorks, href: '/#value' },
      { label: copy.footer.faq, href: '/#value' },
    ],
    service: [
      { label: copy.footer.contact, href: '/#value' },
      { label: copy.footer.blog, href: '/#inspiratie' },
      { label: copy.footer.travelInfo, href: '/#value' },
    ],
    legal: [
      { label: copy.footer.privacy, href: '/privacy' },
      { label: copy.footer.cookies, href: '/cookies' },
      { label: copy.footer.cookieSettings, href: '/cookie-settings' },
    ],
  };
}

const linkCls = 'text-[12.5px] text-white/75 transition hover:text-white';

const attributionLinkCls = 'underline decoration-white/30 underline-offset-2 hover:text-white/80';

/** LIG-006: source and licence text from HotelGeo data contract v1.0 section 7 (DEC-015). */
function GeoAttribution() {
  return (
    <p
      data-testid="geo-attribution"
      className="mt-5 border-t border-white/10 pt-3 text-[11px] leading-relaxed text-white/50"
    >
      Liggingsgegevens: GHS-SMOD R2023A © Europese Unie, 1995–2026 (Europese Commissie, JRC, GHSL), licentie{' '}
      <a href="https://creativecommons.org/licenses/by/4.0" className={attributionLinkCls} target="_blank" rel="noopener noreferrer">
        CC BY 4.0
      </a>
      ; gewijzigd: per accommodatie ingedeeld als stedelijk of landelijk. Kustlijn: ©{' '}
      <a href="https://www.openstreetmap.org/copyright" className={attributionLinkCls} target="_blank" rel="noopener noreferrer">
        OpenStreetMap-bijdragers
      </a>{' '}
      (ODbL). Plaatsgegevens:{' '}
      <a href="https://www.geonames.org" className={attributionLinkCls} target="_blank" rel="noopener noreferrer">
        GeoNames
      </a>{' '}
      (CC BY 4.0).
    </p>
  );
}
/** WOW footer — dark navy, columns, socials, copyright, back-to-top. Compact ~198. */
export function HomeFooter() {
  const copy = useChromeCopy();
  const { ontdek: ontdekLinks, over: overLinks, service: serviceLinks, legal: legalLinks } = footerLinks(copy);
  return (
    <footer className="relative bg-[#0d1622] text-[#e9edf2]">
      <div className="mx-auto w-full max-w-[1180px] px-[18px] py-16 sm:px-[clamp(20px,4vw,56px)] sm:py-[72px]">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-3">
            <p className="font-vw-serif text-[24px] font-medium leading-none">
              Vacation<span className="opacity-75">Web</span>
            </p>
            <p className="mt-3 max-w-[34ch] text-[14.5px] leading-relaxed text-white/70">{copy.footer.about}</p>
          </div>
          <div className="lg:col-span-2">
            <p className="text-[13px] font-semibold">{copy.footer.discoverHeading}</p>
            <ul className="mt-2 space-y-1.5">
              {ontdekLinks.map((l) => (
                <li key={l.href + l.label}>
                  <Link href={l.href} className={linkCls}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="lg:col-span-2">
            <p className="text-[13px] font-semibold">{copy.footer.aboutHeading}</p>
            <ul className="mt-2 space-y-1.5">
              {overLinks.map((l) => (
                <li key={l.href + l.label}>
                  <Link href={l.href} className={linkCls}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="lg:col-span-2">
            <p className="text-[13px] font-semibold">{copy.footer.serviceHeading}</p>
            <ul className="mt-2 space-y-1.5">
              {serviceLinks.map((l) => (
                <li key={l.href + l.label}>
                  <Link href={l.href} className={linkCls}>
                    {l.label}
                  </Link>
                </li>
              ))}
              {legalLinks.map((l) => (
                <li key={l.href + l.label}>
                  <Link href={l.href} className={linkCls}>
                    {l.label}
                  </Link>
                </li>
              ))}
              <li>
                <HomeFooterCookieLink className={`${linkCls} text-left`}>
                  {copy.footer.cookiePreferences}
                </HomeFooterCookieLink>
              </li>
            </ul>
          </div>
          <div className="flex flex-col items-start gap-3 lg:col-span-3 lg:items-end">
            <div className="flex gap-2.5 text-[13px] text-white/80" aria-label={copy.footer.socialAriaLabel}>
              <span title="Instagram">IG</span>
              <span title="Facebook">FB</span>
              <span title="YouTube">YT</span>
              <span title="Pinterest">PI</span>
              <span title="TikTok">TT</span>
            </div>
            <div className="flex w-full items-center justify-between gap-3 lg:w-auto lg:flex-col lg:items-end">
              <div className="text-[11.5px] text-white/55">
                <p>© {new Date().getFullYear()} VacationWeb</p>
                <p className="mt-0.5">{copy.footer.tagline}</p>
              </div>
              <a
                href="#hero"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/25 text-sm text-white/80 transition hover:bg-white/10"
                aria-label={copy.footer.backToTop}
              >
                ↑
              </a>
            </div>
          </div>
        </div>
        <GeoAttribution />
      </div>
    </footer>
  );
}
