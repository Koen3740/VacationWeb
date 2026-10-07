'use client';

import { FavoritesNavLink } from '@/components/favorites/favorites-nav-link';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

export type MobileNavLink = { label: string; href: string };

const PANEL_ID = 'results-mobile-nav-panel';

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {open ? (
        <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      ) : (
        <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      )}
    </svg>
  );
}

/**
 * Mobile navigation for the shared Results-style site header (below `lg`, where the
 * desktop navigation is hidden). A plain disclosure: the button toggles a panel directly
 * below the header; the panel follows the button in the DOM, so Tab continues into the
 * links. Escape and an outside click close it (Escape returns focus to the button).
 * Links are the same as the desktop navigation, plus Favorieten.
 */
export function ResultsMobileNav({ links }: { links: readonly MobileNavLink[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (rootRef.current && event.target instanceof Node && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [open]);

  const itemClass =
    'flex min-h-[48px] items-center px-6 text-[16px] font-medium text-[#0A2D62] transition hover:bg-[#F3F5F8] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#0A2D62]';

  return (
    <div ref={rootRef} className="lg:hidden">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={PANEL_ID}
        aria-label="Menu"
        className="flex h-11 w-11 items-center justify-center rounded-full text-[#334155] transition hover:bg-[#F3F5F8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A2D62]"
      >
        <MenuIcon open={open} />
      </button>

      {open ? (
        <nav
          id={PANEL_ID}
          aria-label="Hoofdnavigatie"
          className="absolute inset-x-0 top-full z-40 border-b border-[#E8ECF2] bg-white py-2 shadow-[0_10px_24px_rgba(10,45,98,0.08)]"
        >
          <ul>
            {links.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  aria-current={pathname === link.href ? 'page' : undefined}
                  className={itemClass}
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <FavoritesNavLink className={`${itemClass} gap-2`} />
            </li>
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
