'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useApplyUiLanguage } from '@/components/i18n/use-apply-ui-language';
import { useChromeCopy, useUiLanguage } from '@/components/i18n/ui-language-provider';
import { UI_LANGUAGE_NAMES, type UiLanguage } from '@/lib/i18n/ui-language';

/**
 * vacationweb.be first visit: "Kies je taal / Choisissez votre langue" (t66u).
 * Rendered by the root layout only while no choice is remembered on .be. No flags, no country
 * choice, no IP/browser-locale guess. The choice is stored in the `vacationweb-lang` cookie.
 */
export function LanguageChoiceDialog() {
  const titleId = useId();
  const { needsChoice, supportedLanguages } = useUiLanguage();
  const copy = useChromeCopy();
  const applyLanguage = useApplyUiLanguage();
  const [open, setOpen] = useState(needsChoice);
  const firstButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setOpen(needsChoice);
  }, [needsChoice]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    firstButtonRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open || supportedLanguages.length < 2) {
    return null;
  }

  const choose = (language: UiLanguage) => {
    setOpen(false);
    applyLanguage(language);
  };

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-[rgba(10,45,98,0.38)] p-4"
      data-testid="language-choice-dialog"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-[22rem] rounded-[16px] bg-white p-6 text-center shadow-[0_12px_32px_rgba(10,45,98,0.18)] ring-1 ring-black/[0.06]"
      >
        <GlobeIcon className="mx-auto h-7 w-7 text-[#0A2D62]" />
        <h2 id={titleId} className="mt-3 text-[17px] font-semibold leading-snug text-[#0A2D62]">
          {copy.languageDialog.title}
        </h2>
        <div className="mt-5 grid gap-2.5">
          {supportedLanguages.map((language, index) => (
            <button
              key={language}
              ref={index === 0 ? firstButtonRef : undefined}
              type="button"
              lang={language}
              data-language={language}
              onClick={() => choose(language)}
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-[11px] border border-[#D9E0EA] bg-white px-4 text-[14.5px] font-semibold text-[#0A2D62] transition hover:border-[#89ACD3] hover:bg-[#F3F7FB] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A2D62]"
            >
              {UI_LANGUAGE_NAMES[language]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Globe icon (not a flag). */
export function GlobeIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M3.5 12h17M12 3.5c2.3 2.4 3.5 5.3 3.5 8.5s-1.2 6.1-3.5 8.5c-2.3-2.4-3.5-5.3-3.5-8.5S9.7 5.9 12 3.5z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
