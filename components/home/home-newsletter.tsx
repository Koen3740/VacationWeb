'use client';

import Image from 'next/image';
import type { FormEvent } from 'react';
import { useState } from 'react';

const SCRIPT_STACK =
  "Segoe Script, 'Apple Chancery', 'Snell Roundhand', cursive";

/** WOW newsletter photo band — Blijf ontdekken + Good places ahead. */
export function HomeNewsletter() {
  const [status, setStatus] = useState<'idle' | 'done'>('idle');

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const email = new FormData(form).get('email');
    if (typeof email !== 'string' || !email.trim()) {
      return;
    }
    // No backend yet — acknowledge the CTA so the control is not a dead button.
    setStatus('done');
  };

  return (
    <section className="relative overflow-hidden">
      <div className="relative h-[180px] sm:h-[200px] lg:h-[220px]">
        <Image
          src="/images/verified/mood/homepage-newsletter.jpg"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-black/35" aria-hidden />
        <div className="relative z-10 mx-auto flex h-full w-[86.8vw] flex-col justify-center gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:gap-8 lg:px-0">
          <div className="max-w-sm text-white">
            <h2
              className="text-[24px] font-semibold leading-tight"
              style={{ fontFamily: 'var(--font-vw-serif), Georgia, serif' }}
            >
              Blijf ontdekken
            </h2>
            <span className="mt-1 block h-[3px] w-10 rounded-full bg-[#E8C547]" aria-hidden />
            <p className="mt-2 max-w-xs text-[12.5px] leading-snug text-white/90">
              Ontvang elke week nieuwe bestemmingen, reistips en bijzondere plekken.
            </p>
          </div>
          {status === 'done' ? (
            <p className="rounded-full bg-white px-5 py-2.5 text-[13px] font-semibold text-[#0A2D62] shadow-sm ring-1 ring-black/5" role="status">
              Bedankt — je bent aangemeld voor updates.
            </p>
          ) : (
            <form
              className="flex w-full max-w-md overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-black/5"
              onSubmit={onSubmit}
            >
              <label className="sr-only" htmlFor="vw-newsletter-email">
                E-mailadres
              </label>
              <input
                id="vw-newsletter-email"
                type="email"
                name="email"
                required
                placeholder="Jouw e-mailadres"
                className="min-h-[40px] min-w-0 flex-1 border-0 bg-transparent px-4 text-[13px] text-[#0A2D62] outline-none"
              />
              <button
                type="submit"
                className="inline-flex min-h-[40px] shrink-0 items-center justify-center bg-[#3B82C4] px-4 text-[13px] font-semibold text-white transition hover:bg-[#2F6FA8]"
              >
                Inschrijven →
              </button>
            </form>
          )}
          <p
            className="pointer-events-none hidden max-w-[11rem] shrink-0 rotate-[-8deg] self-center text-right text-[28px] leading-tight text-white lg:block"
            style={{ fontFamily: SCRIPT_STACK }}
          >
            Good places ahead.
            <span className="mt-1 ml-auto block h-[2.5px] w-24 rounded-full bg-[#E8C547]" aria-hidden />
          </p>
        </div>
      </div>
    </section>
  );
}