'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

/**
 * Desktop: sticky filter column. Mobile (≤900px): bottom sheet, as in Layout A.
 * One filter tree — it is not mounted twice.
 */
export function ResultsFilterSheet({
  open,
  onClose,
  onClear,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onClear: () => void;
  children: ReactNode;
}) {
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 900px)');
    const sync = () => setMobile(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (!mobile || !open) {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [mobile, open, onClose]);

  const sheetOpen = mobile && open;

  return (
    <>
      <button
        type="button"
        aria-label="Filters sluiten"
        onClick={onClose}
        tabIndex={sheetOpen ? 0 : -1}
        className={`fixed inset-0 z-[70] bg-[rgba(10,20,40,0.45)] transition-opacity min-[901px]:hidden ${
          sheetOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />
      <div
        className={`min-[901px]:sticky min-[901px]:top-4 min-[901px]:max-h-[calc(100vh-2rem)] min-[901px]:overflow-auto max-[900px]:fixed max-[900px]:inset-x-0 max-[900px]:bottom-0 max-[900px]:z-[80] max-[900px]:flex max-[900px]:h-[88vh] max-[900px]:max-h-[88vh] max-[900px]:flex-col max-[900px]:overflow-hidden max-[900px]:rounded-t-[20px] max-[900px]:bg-vw-panel max-[900px]:shadow-[0_-12px_40px_rgba(10,20,40,0.25)] max-[900px]:transition-transform max-[900px]:duration-300 ${
          sheetOpen ? 'max-[900px]:translate-y-0' : 'max-[900px]:invisible max-[900px]:translate-y-[105%]'
        }`}
        role={mobile ? 'dialog' : undefined}
        aria-modal={sheetOpen ? true : undefined}
        aria-label="Filters"
        inert={mobile && !open ? true : undefined}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-vw-line px-[18px] py-3.5 font-vw-serif text-[19px] font-semibold text-vw-navy min-[901px]:hidden">
          <span>Filters</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Sluiten"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-vw-usp text-[20px] leading-none"
          >
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-4 pb-3 pt-1 min-[901px]:overflow-visible min-[901px]:p-0">
          {children}
        </div>
        <div className="flex shrink-0 gap-2.5 border-t border-vw-line bg-vw-panel px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] min-[901px]:hidden">
          <button type="button" onClick={onClear} className="px-1.5 text-[14px] text-vw-muted">
            Wis alles
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-12 flex-1 items-center justify-center rounded-vw-control bg-vw-navy text-[15px] font-semibold text-white"
          >
            Toon vakanties
          </button>
        </div>
      </div>
    </>
  );
}
