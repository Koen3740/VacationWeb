'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

type NavLink = {
  label: string;
  href: string;
};

type HomeMobileNavProps = {
  links: readonly NavLink[];
};

function MenuIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function HomeMobileNav({ links }: HomeMobileNavProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const closeMenu = () => {
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="home-mobile-nav-panel"
        aria-label="Menu openen"
        className="flex h-10 w-10 items-center justify-center rounded-full text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <MenuIcon />
      </button>

      {mounted && open
        ? createPortal(
            <div className="fixed inset-0 z-50 lg:hidden">
              <button
                type="button"
                className="absolute inset-0 bg-[rgba(0,0,0,0.4)]"
                aria-label="Menu sluiten"
                onClick={closeMenu}
              />

              <nav
                id="home-mobile-nav-panel"
                role="dialog"
                aria-modal="true"
                aria-label="Hoofdnavigatie"
                className="absolute right-0 top-0 flex h-full w-[min(100%,20rem)] flex-col bg-[#0A2D62] px-6 pb-8 pt-6 shadow-xl"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold uppercase tracking-wide text-white/70">Menu</span>
                  <button
                    type="button"
                    onClick={closeMenu}
                    aria-label="Menu sluiten"
                    className="flex h-10 w-10 items-center justify-center rounded-full text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    <CloseIcon />
                  </button>
                </div>

                <ul className="mt-8 flex flex-col gap-1">
                  {links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        onClick={closeMenu}
                        className="block rounded-lg px-3 py-3 text-[17px] font-medium text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
