'use client';

import { useId, useState } from 'react';
import {
  RESULTS_BORDER,
  RESULTS_MUTED,
  RESULTS_NAVY,
  RESULTS_PANEL_BG,
} from '@/components/results-v2/results-design-tokens';

const FAQ_ITEMS = [
  {
    question: 'Hoe werkt VacationWeb?',
    answer:
      'Je vult je wensen één keer in, vergelijkt passend aanbod van meerdere reisaanbieders en boekt rechtstreeks bij de aanbieder die je kiest.',
  },
  {
    question: 'Boek ik bij VacationWeb?',
    answer:
      'Nee. VacationWeb is een vergelijkingsplatform. Na je keuze boek je rechtstreeks bij de reisorganisatie.',
  },
  {
    question: 'Zijn de prijzen op VacationWeb dezelfde als bij de aanbieder?',
    answer:
      'Getoonde actuele prijzen zijn de prijzen van de aanbieder. Catalogus- of feedprijzen presenteren we niet als live prijs.',
  },
  {
    question: 'Vergelijkt VacationWeb echt meerdere reisaanbieders?',
    answer:
      'Ja. Met één zoekopdracht zie je passend aanbod van meerdere reisaanbieders naast elkaar.',
  },
  {
    question: 'Waarom zou ik VacationWeb gebruiken als ik al weet waar ik wil boeken?',
    answer:
      'Omdat je snel kunt controleren of een andere aanbieder een betere match of prijs heeft voor dezelfde wensen — zonder bij elke site opnieuw te zoeken.',
  },
  {
    question: 'Bij wie boek ik mijn vakantie?',
    answer:
      'Rechtstreeks bij de reisorganisatie of aanbieder die je na het vergelijken kiest.',
  },
] as const;

function FaqItem({
  question,
  answer,
  open,
  onToggle,
}: {
  question: string;
  answer: string;
  open: boolean;
  onToggle: () => void;
}) {
  const panelId = useId();
  const buttonId = useId();

  return (
    <div className="border-b last:border-b-0" style={{ borderColor: RESULTS_BORDER }}>
      <h3 className="m-0">
        <button
          type="button"
          id={buttonId}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex w-full min-h-[48px] items-center justify-between gap-3 py-3.5 text-left text-[14.5px] font-semibold text-[#0A2D62] transition hover:text-[#082452] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E66F5]"
        >
          <span>{question}</span>
          <span className="shrink-0 text-[18px] font-normal text-[#89ACD3]" aria-hidden="true">
            {open ? '−' : '+'}
          </span>
        </button>
      </h3>
      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        hidden={!open}
        className="pb-3.5 pr-8 text-[13.5px] leading-relaxed text-[#475569]"
      >
        {answer}
      </div>
    </div>
  );
}

export function HomeFaq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="goed-om-te-weten" className="mx-auto max-w-[1600px] px-6 py-10 lg:px-8 lg:py-12">
      <div className="max-w-2xl">
        <h2 className="text-[22px] font-bold tracking-tight" style={{ color: RESULTS_NAVY }}>
          Goed om te weten
        </h2>
        <p className="mt-1.5 text-[14px] leading-relaxed" style={{ color: RESULTS_MUTED }}>
          Alles wat je wilt weten voordat je gaat vergelijken.
        </p>
      </div>

      <div
        className="mt-6 max-w-3xl rounded-[16px] border px-4 sm:px-5"
        style={{ backgroundColor: RESULTS_PANEL_BG, borderColor: RESULTS_BORDER }}
      >
        {FAQ_ITEMS.map((item, index) => (
          <FaqItem
            key={item.question}
            question={item.question}
            answer={item.answer}
            open={openIndex === index}
            onToggle={() => setOpenIndex((current) => (current === index ? null : index))}
          />
        ))}
      </div>
    </section>
  );
}
