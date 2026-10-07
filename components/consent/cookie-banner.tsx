'use client';

import {
  getCookieConsent,
  hasCookieConsent,
  OPEN_COOKIE_PREFERENCES_EVENT,
  setCookieConsent,
  setCookiePreferences,
  type CookiePreferences,
} from '@/lib/cookie-consent';
import { UI_LANGUAGE_CHOSEN_EVENT } from '@/lib/i18n/ui-language';
import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';

const DEFAULT_PREFERENCES: CookiePreferences = {
  analytics: false,
  marketing: false,
};

/**
 * Site-wide cookie consent banner (Sub 25).
 * Blocking on first visit; reopenable via preferences event / cookie-settings.
 */
export function CookieBanner({
  deferUntilLanguageChosen = false,
}: {
  /** t66u: on a first .be visit the language popup comes first; the banner follows the choice. */
  deferUntilLanguageChosen?: boolean;
} = {}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);
  const [marketingEnabled, setMarketingEnabled] = useState(false);

  const [languageChosen, setLanguageChosen] = useState(false);

  useEffect(() => {
    if (!deferUntilLanguageChosen) {
      return undefined;
    }
    const onLanguageChosen = () => setLanguageChosen(true);
    window.addEventListener(UI_LANGUAGE_CHOSEN_EVENT, onLanguageChosen);
    return () => window.removeEventListener(UI_LANGUAGE_CHOSEN_EVENT, onLanguageChosen);
  }, [deferUntilLanguageChosen]);

  const waitingForLanguage = deferUntilLanguageChosen && !languageChosen;

  useEffect(() => {
    if (waitingForLanguage) {
      return;
    }
    if (!hasCookieConsent()) {
      setVisible(true);
      setIsBlocking(true);
    }
  }, [waitingForLanguage]);

  useEffect(() => {
    const handleOpenPreferences = () => {
      const storedConsent = getCookieConsent();
      if (storedConsent) {
        setAnalyticsEnabled(storedConsent.analytics);
        setMarketingEnabled(storedConsent.marketing);
        setIsBlocking(false);
      } else {
        setAnalyticsEnabled(DEFAULT_PREFERENCES.analytics);
        setMarketingEnabled(DEFAULT_PREFERENCES.marketing);
        setIsBlocking(true);
      }
      setShowPreferences(true);
      setVisible(true);
    };

    window.addEventListener(OPEN_COOKIE_PREFERENCES_EVENT, handleOpenPreferences);
    return () => {
      window.removeEventListener(OPEN_COOKIE_PREFERENCES_EVENT, handleOpenPreferences);
    };
  }, []);

  useEffect(() => {
    if (!visible || !isBlocking) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [visible, isBlocking]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    const node = dialogRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusables = () =>
      node
        ? Array.from(
            node.querySelectorAll<HTMLElement>(
              'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
            ),
          ).filter((el) => !el.hasAttribute('disabled'))
        : [];

    const first = focusables()[0];
    first?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isBlocking) {
        setVisible(false);
        setShowPreferences(false);
        return;
      }
      if (event.key !== 'Tab' || !node) {
        return;
      }
      const items = focusables();
      if (items.length === 0) {
        return;
      }
      const firstEl = items[0]!;
      const lastEl = items[items.length - 1]!;
      if (event.shiftKey && document.activeElement === firstEl) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && document.activeElement === lastEl) {
        event.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [visible, showPreferences, isBlocking]);

  function closeModal() {
    setVisible(false);
    setShowPreferences(false);
    setIsBlocking(false);
  }

  function acceptAll() {
    setCookieConsent('all');
    closeModal();
  }

  function acceptNecessaryOnly() {
    setCookieConsent('necessary');
    closeModal();
  }

  function savePreferences() {
    setCookiePreferences({
      analytics: analyticsEnabled,
      marketing: marketingEnabled,
    });
    closeModal();
  }

  function openPreferences() {
    const storedConsent = getCookieConsent();
    if (storedConsent) {
      setAnalyticsEnabled(storedConsent.analytics);
      setMarketingEnabled(storedConsent.marketing);
    }
    setShowPreferences(true);
  }

  if (!visible) {
    return null;
  }

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 ${
        isBlocking ? 'pointer-events-auto' : 'pointer-events-none'
      }`}
    >
      <div
        className={`absolute inset-0 bg-[#0A2D62]/60 ${
          isBlocking ? 'pointer-events-auto' : 'pointer-events-none'
        }`}
        aria-hidden="true"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl sm:p-8 pointer-events-auto"
      >
        {showPreferences ? (
          <div>
            <h2 id={titleId} className="text-xl font-bold tracking-[-0.02em] text-[#0A2D62]">
              Cookievoorkeuren
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-[15px]">
              Kies per categorie wat je wilt toestaan. Noodzakelijke technologie is altijd actief.
              Analytics en marketing staan standaard uit en worden pas gebruikt als je daarvoor
              toestemming geeft en wanneer die technologie daadwerkelijk is geactiveerd.
            </p>

            <div className="mt-6 space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-slate-900">Noodzakelijk</p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">
                      Vereist om de website te laten werken (bijvoorbeeld zoek- en
                      voorkeursinstellingen).
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[#0A2D62]/10 px-3 py-1 text-xs font-semibold text-[#0A2D62]">
                    Altijd actief
                  </span>
                </div>
              </div>

              <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-slate-200 px-4 py-4">
                <div>
                  <p className="font-semibold text-slate-900">Analytisch</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">
                    Helpt VacationWeb te verbeteren. Momenteel is er geen analyticsprovider
                    actief; jouw keuze wordt bewaard voor later.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={analyticsEnabled}
                  onChange={(event) => setAnalyticsEnabled(event.target.checked)}
                  className="mt-1 h-5 w-5 shrink-0 accent-[#0A2D62]"
                />
              </label>

              <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-slate-200 px-4 py-4">
                <div>
                  <p className="font-semibold text-slate-900">Marketing</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">
                    Voor relevante content of aanbiedingen. Momenteel is er geen
                    marketingprovider actief; jouw keuze wordt bewaard voor later.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={marketingEnabled}
                  onChange={(event) => setMarketingEnabled(event.target.checked)}
                  className="mt-1 h-5 w-5 shrink-0 accent-[#0A2D62]"
                />
              </label>
            </div>

            <p className="mt-4 text-xs text-slate-500">
              Meer info:{' '}
              <Link href="/privacy" className="underline underline-offset-2 hover:text-[#0A2D62]">
                Privacybeleid
              </Link>
              {' · '}
              <Link href="/cookies" className="underline underline-offset-2 hover:text-[#0A2D62]">
                Cookiebeleid
              </Link>
            </p>

            <div className="mt-6">
              <button
                type="button"
                onClick={savePreferences}
                className="w-full rounded-lg bg-[#0A2D62] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#133a8f] sm:w-auto"
              >
                Voorkeuren opslaan
              </button>
            </div>
          </div>
        ) : (
          <div>
            <h2 id={titleId} className="text-xl font-bold tracking-[-0.02em] text-[#0A2D62]">
              Jouw privacy, jouw keuze
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-[15px]">
              VacationWeb gebruikt alleen strikt noodzakelijke technologieën om de website goed te
              laten werken. Met jouw toestemming kunnen we daarnaast gegevens gebruiken om
              VacationWeb te verbeteren en, als je daarvoor kiest, marketingtechnologie gebruiken.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Lees ons{' '}
              <Link href="/privacy" className="underline underline-offset-2 hover:text-[#0A2D62]">
                privacybeleid
              </Link>{' '}
              en{' '}
              <Link href="/cookies" className="underline underline-offset-2 hover:text-[#0A2D62]">
                cookiebeleid
              </Link>
              .
            </p>

            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={acceptNecessaryOnly}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                Alleen noodzakelijke cookies
              </button>
              <button
                type="button"
                onClick={openPreferences}
                className="w-full rounded-lg border border-[#0A2D62]/20 bg-white px-4 py-3 text-sm font-medium text-[#0A2D62] transition hover:border-[#0A2D62]/40 hover:bg-[#0A2D62]/5"
              >
                Voorkeuren aanpassen
              </button>
              <button
                type="button"
                onClick={acceptAll}
                className="w-full rounded-lg bg-[#0A2D62] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#133a8f]"
              >
                Alles accepteren
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
