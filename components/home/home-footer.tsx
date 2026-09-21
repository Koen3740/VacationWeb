import { HomeFooterCookieLink } from '@/components/home/home-footer-cookie-link';
import Link from 'next/link';

const ontdekLinks = [
  { label: 'Bestemmingen', href: '/bestemmingen' },
  { label: 'Inspiratie', href: '/#inspiratie' },
  { label: 'Aanbod', href: '/aanbiedingen' },
] as const;

const overLinks = [
  { label: 'Onze missie', href: '/#value' },
  { label: 'Zo werkt het', href: '/#value' },
  { label: 'Veelgestelde vragen', href: '/#value' },
] as const;

const serviceLinks = [
  { label: 'Contact', href: '/#value' },
  { label: 'Blog', href: '/#inspiratie' },
  { label: 'Reisinformatie', href: '/#value' },
] as const;

const linkCls = 'text-[12.5px] text-white/75 transition hover:text-white';

/** WOW footer — dark navy, columns, socials, copyright, back-to-top. Compact ~198. */
export function HomeFooter() {
  return (
    <footer className="bg-[#01213A] text-white">
      <div className="mx-auto w-[86.8vw] px-4 py-6 sm:px-6 lg:px-0 lg:py-7">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-12 lg:gap-6">
          <div className="lg:col-span-3">
            <p className="inline-flex items-baseline gap-2">
              <span
                className="text-[28px] font-semibold leading-none"
                style={{ fontFamily: 'var(--font-vw-serif), Georgia, serif' }}
              >
                W
              </span>
              <span className="text-[17px] font-bold tracking-tight">VacationWeb</span>
            </p>
            <p className="mt-2 text-[12px] text-white/70">Discover more. Travel smarter.</p>
          </div>
          <div className="lg:col-span-2">
            <p className="text-[13px] font-semibold">Ontdek</p>
            <ul className="mt-2 space-y-1.5">
              {ontdekLinks.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className={linkCls}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="lg:col-span-2">
            <p className="text-[13px] font-semibold">Over ons</p>
            <ul className="mt-2 space-y-1.5">
              {overLinks.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className={linkCls}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="lg:col-span-2">
            <p className="text-[13px] font-semibold">Service</p>
            <ul className="mt-2 space-y-1.5">
              {serviceLinks.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className={linkCls}>
                    {l.label}
                  </Link>
                </li>
              ))}
              <li>
                <HomeFooterCookieLink className={`${linkCls} text-left`} />
              </li>
            </ul>
          </div>
          <div className="flex flex-col items-start gap-3 lg:col-span-3 lg:items-end">
            <div className="flex gap-2.5 text-[13px] text-white/80" aria-label="Sociale media">
              <span title="Instagram">IG</span>
              <span title="Facebook">FB</span>
              <span title="YouTube">YT</span>
              <span title="Pinterest">PI</span>
              <span title="TikTok">TT</span>
            </div>
            <div className="flex w-full items-center justify-between gap-3 lg:w-auto lg:flex-col lg:items-end">
              <div className="text-[11.5px] text-white/55">
                <p>© {new Date().getFullYear()} VacationWeb</p>
                <p className="mt-0.5">Reis verder.</p>
              </div>
              <a
                href="#hero"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/25 text-sm text-white/80 transition hover:bg-white/10"
                aria-label="Terug naar boven"
              >
                ↑
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
