'use client';

import type { FormEvent } from 'react';
import { useState } from 'react';
import { useChromeCopy } from '@/components/i18n/ui-language-provider';

/** Newsletter stays honest: there is no list yet. Glass, not a second photo. */
export function HomeNewsletter() {
  const copy = useChromeCopy().newsletter;
  const [status, setStatus] = useState<'idle' | 'unavailable'>('idle');

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // No backend yet — do not claim a successful subscription.
    setStatus('unavailable');
  };

  return (
    <section className="px-[18px] pb-[clamp(56px,8vw,100px)] sm:px-[clamp(20px,4vw,56px)]">
      <div className="mx-auto max-w-[1180px]">
        <div className="vw-glass flex flex-col gap-5 px-6 py-8 sm:px-9 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-md">
            <h2 className="font-vw-serif text-[28px] font-normal leading-tight sm:text-[34px]">{copy.title}</h2>
            <p className="mt-2 max-w-sm text-[14.5px] leading-relaxed text-white/80">{copy.body}</p>
          </div>
          {status === 'unavailable' ? (
            <p
              className="rounded-[14px] border border-white/30 bg-white/10 px-5 py-3 text-[14px] font-medium text-white"
              role="status"
            >
              {copy.unavailable}
            </p>
          ) : (
            <form method="post" action="#" className="flex w-full max-w-md flex-col gap-2 sm:flex-row" onSubmit={onSubmit}>
              <label className="sr-only" htmlFor="vw-newsletter-email">
                {copy.emailLabel}
              </label>
              <input
                id="vw-newsletter-email"
                type="email"
                name="email"
                required
                autoComplete="email"
                placeholder={copy.emailPlaceholder}
                className="min-h-11 min-w-0 flex-1 rounded-[14px] border border-white/35 bg-white/10 px-4 text-[14px] text-white outline-none placeholder:text-white/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              />
              <button
                type="submit"
                className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-[14px] bg-white px-4 text-[14px] font-semibold text-vw-navy"
              >
                {copy.submit}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
