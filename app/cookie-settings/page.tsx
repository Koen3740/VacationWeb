'use client';

import { LegalPageShell } from '@/components/consent/legal-page-shell';
import {
  getConsentRecord,
  getCookieConsent,
  openCookiePreferences,
  revokeOptionalConsent,
  setCookieConsent,
  setCookiePreferences,
} from '@/lib/cookie-consent';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function CookieSettingsPage() {
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [timestamp, setTimestamp] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function refreshFromStore() {
    const record = getConsentRecord();
    const prefs = getCookieConsent();
    setAnalytics(prefs?.analytics ?? false);
    setMarketing(prefs?.marketing ?? false);
    setTimestamp(record?.timestamp ?? null);
    setSource(record?.source ?? null);
  }

  useEffect(() => {
    refreshFromStore();
  }, []);

  function save() {
    setCookiePreferences({ analytics, marketing });
    refreshFromStore();
    setSaved(true);
  }

  function acceptAll() {
    setCookieConsent('all');
    refreshFromStore();
    setSaved(true);
  }

  function necessaryOnly() {
    setCookieConsent('necessary');
    refreshFromStore();
    setSaved(true);
  }

  function revoke() {
    revokeOptionalConsent();
    refreshFromStore();
    setSaved(true);
  }

  return (
    <LegalPageShell title="Cookie-instellingen">
      <p>
        Beheer hier je toestemming voor optionele technologie. Noodzakelijke functionaliteit blijft
        altijd actief. Analytics en marketing zijn standaard uit en er is momenteel geen
        analytics-/marketingprovider geïnstalleerd.
      </p>

      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
          <div>
            <p className="font-semibold text-slate-900">Noodzakelijk</p>
            <p className="mt-1 text-sm text-slate-600">Altijd actief voor de werking van de site.</p>
          </div>
          <span className="shrink-0 rounded-full bg-[#0A2D62]/10 px-3 py-1 text-xs font-semibold text-[#0A2D62]">
            Aan
          </span>
        </div>

        <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-slate-200 px-4 py-4">
          <div>
            <p className="font-semibold text-slate-900">Analytisch</p>
            <p className="mt-1 text-sm text-slate-600">
              Toestemming bewaard voor toekomstig gebruik; geen actieve analyticsprovider.
            </p>
          </div>
          <input
            type="checkbox"
            checked={analytics}
            onChange={(e) => {
              setAnalytics(e.target.checked);
              setSaved(false);
            }}
            className="mt-1 h-5 w-5 accent-[#0A2D62]"
          />
        </label>

        <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-slate-200 px-4 py-4">
          <div>
            <p className="font-semibold text-slate-900">Marketing</p>
            <p className="mt-1 text-sm text-slate-600">
              Toestemming bewaard voor toekomstig gebruik; geen actieve marketingprovider.
            </p>
          </div>
          <input
            type="checkbox"
            checked={marketing}
            onChange={(e) => {
              setMarketing(e.target.checked);
              setSaved(false);
            }}
            className="mt-1 h-5 w-5 accent-[#0A2D62]"
          />
        </label>

        {(timestamp || source) && (
          <p className="text-[12px] text-slate-500">
            Laatste keuze: {timestamp ?? '—'}
            {source ? ` (${source})` : ''}
          </p>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={save}
            className="rounded-lg bg-[#0A2D62] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#133a8f]"
          >
            Voorkeuren opslaan
          </button>
          <button
            type="button"
            onClick={acceptAll}
            className="rounded-lg border border-[#0A2D62]/25 px-4 py-2.5 text-sm font-medium text-[#0A2D62] hover:bg-[#0A2D62]/5"
          >
            Alles accepteren
          </button>
          <button
            type="button"
            onClick={necessaryOnly}
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Alleen noodzakelijk
          </button>
          <button
            type="button"
            onClick={revoke}
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Optionele toestemming intrekken
          </button>
          <button
            type="button"
            onClick={() => openCookiePreferences()}
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Open banner
          </button>
        </div>

        {saved ? (
          <p className="text-sm font-medium text-emerald-700" role="status">
            Voorkeuren opgeslagen.
          </p>
        ) : null}
      </div>

      <p>
        Meer informatie:{' '}
        <Link href="/privacy" className="font-medium text-[#0A2D62] underline underline-offset-2">
          Privacybeleid
        </Link>
        {' · '}
        <Link href="/cookies" className="font-medium text-[#0A2D62] underline underline-offset-2">
          Cookiebeleid
        </Link>
      </p>
    </LegalPageShell>
  );
}
