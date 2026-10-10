'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { GlobeIcon } from '@/components/i18n/language-choice-dialog';
import { useApplyUiLanguage } from '@/components/i18n/use-apply-ui-language';
import { useChromeCopy, useUiLanguage } from '@/components/i18n/ui-language-provider';
import { UI_LANGUAGE_CODES, UI_LANGUAGE_NAMES, type UiLanguage } from '@/lib/i18n/ui-language';

/**
 * Header language indicator (t66u): globe icon + current language code, never a flag.
 * vacationweb.be: button with Nederlands / Français (instant switch, remembered).
 * vacationweb.nl (and hosts without market): static "NL" indicator, no FR option.
 */
const BASE_CLASS = 'inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[#0A2D62]';
const ON_PHOTO_CLASS = 'vw-glass-chip inline-flex h-9 gap-1.5 px-3 text-[13px] font-semibold text-white';

function LanguageIndicator({ language }: { language: UiLanguage }) {
  return (
    <>
      <GlobeIcon className="h-4 w-4 shrink-0" />
      <span>{UI_LANGUAGE_CODES[language]}</span>
    </>
  );
}

export function LanguageSwitcher({
  className = '',
  initialOpen = false,
  tone = 'default',
}: {
  className?: string;
  /** Menu initially open (tests / static render only). */
  initialOpen?: boolean;
  /** Homepage photo: glass chip. The menu itself stays a solid panel. */
  tone?: 'default' | 'onPhoto';
}) {
  const { language, supportedLanguages } = useUiLanguage();
  const copy = useChromeCopy();
  const toneClass = tone === 'onPhoto' ? ON_PHOTO_CLASS : BASE_CLASS;

  if (supportedLanguages.length < 2) {
    // Static indicator: no router / cookie logic, so it renders anywhere (also outside the app router).
    return (
      <span
        className={`${toneClass} ${className}`}
        title={UI_LANGUAGE_NAMES[language]}
        aria-label={`${copy.switcher.label}: ${UI_LANGUAGE_NAMES[language]}`}
        data-testid="language-indicator"
      >
        <LanguageIndicator language={language} />
      </span>
    );
  }

  return <LanguageSwitcherMenu className={className} initialOpen={initialOpen} tone={tone} />;
}

function LanguageSwitcherMenu({
  className,
  initialOpen,
  tone,
}: {
  className: string;
  initialOpen: boolean;
  tone: 'default' | 'onPhoto';
}) {
  const menuId = useId();
  const { language, supportedLanguages } = useUiLanguage();
  const copy = useChromeCopy();
  const applyLanguage = useApplyUiLanguage();
  const [open, setOpen] = useState(initialOpen);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const choose = (next: UiLanguage) => {
    setOpen(false);
    if (next !== language) {
      applyLanguage(next);
    }
  };

  return (
    <div ref={rootRef} className={`relative ${className}`} data-testid="language-switcher">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`${copy.switcher.label}: ${UI_LANGUAGE_NAMES[language]}. ${copy.switcher.change}`}
        className={`${tone === 'onPhoto' ? ON_PHOTO_CLASS : `${BASE_CLASS} rounded-full px-1.5 py-1 hover:text-[#082452]`} transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white`}
      >
        <LanguageIndicator language={language} />
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden className={tone === 'onPhoto' ? 'text-white/80' : 'text-[#64748B]'}>
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open ? (
        <ul
          id={menuId}
          role="menu"
          aria-label={copy.switcher.change}
          className="absolute right-0 top-full z-50 mt-1.5 min-w-[9.5rem] rounded-[11px] border border-[#E8ECF2] bg-white p-1 shadow-[0_10px_28px_rgba(10,45,98,0.12)]"
        >
          {supportedLanguages.map((option) => (
            <li key={option} role="none">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={option === language}
                lang={option}
                data-language={option}
                onClick={() => choose(option)}
                className={`flex w-full items-center justify-between gap-3 rounded-[8px] px-3 py-2 text-left text-[13.5px] text-[#0A2D62] transition hover:bg-[#F3F5F8] ${
                  option === language ? 'font-semibold' : 'font-medium'
                }`}
              >
                {UI_LANGUAGE_NAMES[option]}
                <span className="text-[11.5px] font-semibold text-[#64748B]">{UI_LANGUAGE_CODES[option]}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
