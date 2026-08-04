'use client';

import {
  CookiePreferences,
  getCookieConsent,
  hasCookieConsent,
  OPEN_COOKIE_PREFERENCES_EVENT,
  setCookieConsent,
  setCookiePreferences,
} from '@/lib/cookie-consent';
import { useEffect, useId, useState } from 'react';

const DEFAULT_PREFERENCES: CookiePreferences = {
  analytics: false,
  marketing: false,
};

export function HomeCookieBanner() {
  const titleId = useId();
  const [visible, setVisible] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);
  const [marketingEnabled, setMarketingEnabled] = useState(false);

  useEffect(() => {
    if (!hasCookieConsent()) {
      setVisible(true);
      setIsBlocking(true);
    }

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
      aria-hidden={false}
    >
      <div
        className={`absolute inset-0 bg-[#0A2D62]/60 ${
          isBlocking ? 'pointer-events-auto' : 'pointer-events-none'
        }`}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative z-10 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl sm:p-8 ${
          isBlocking ? 'pointer-events-auto' : 'pointer-events-auto'
        }`}
      >
        {showPreferences ? (
          <div>
            <h2 id={titleId} className="text-xl font-bold tracking-[-0.02em] text-[#0A2D62]">
              Cookievoorkeuren
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-[15px]">
              Kies per categorie welke cookies je wilt toestaan. Noodzakelijke cookies zijn altijd
              actief.
            </p>

            <div className="mt-6 space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-slate-900">Noodzakelijke cookies</p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">
                      Vereist voor het functioneren van de website.
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[#0A2D62]/10 px-3 py-1 text-xs font-semibold text-[#0A2D62]">
                    Altijd actief
                  </span>
                </div>
              </div>

              <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-slate-200 px-4 py-4">
                <div>
                  <p className="font-semibold text-slate-900">Analytische cookies</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">
                    Helpen ons te begrijpen hoe bezoekers de website gebruiken.
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
                  <p className="font-semibold text-slate-900">Marketingcookies</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">
                    Worden gebruikt om relevante content en aanbiedingen te tonen.
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
              Cookies op VacationWeb
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-[15px]">
              VacationWeb gebruikt cookies om de website goed te laten werken en het gebruik te
              analyseren. Maak een keuze om verder te gaan.
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
                Alle cookies accepteren
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
