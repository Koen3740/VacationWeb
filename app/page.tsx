import Link from 'next/link';
import { SearchForm } from '@/components/search/search-form';
import { loadFilterOptions } from '@/lib/offers/load-filter-options';

const destinations = [
  { name: 'Mallorca', country: 'Spanje', image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80' },
  { name: 'Kos', country: 'Griekenland', image: 'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=900&q=80' },
  { name: 'Antalya', country: 'Turkije', image: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=900&q=80' },
];

const countries = ['Spanje', 'Turkije', 'Griekenland', 'Egypte', 'Portugal', 'Italië'];

const themes = [
  { title: 'All inclusive', description: 'Vergelijk all inclusive vakanties op totale prijs en verzorging.' },
  { title: 'Last minute', description: 'Bekijk kortere vertrekperiodes en flexibele opties.' },
  { title: 'Goedkoop', description: 'Filter op budget en prijs per dag voor de scherpste vergelijkingen.' },
];

const faqs = [
  { question: 'Wat is VacationWeb?', answer: 'VacationWeb is een onafhankelijk vergelijkingsplatform voor vakantieaanbiedingen van meerdere aanbieders.' },
  { question: 'Vergelijkt VacationWeb alle aanbieders?', answer: 'Ja, het platform toont objectief beschikbare opties vanuit aangesloten aanbieders.' },
  { question: 'Welke informatie zie ik?', answer: 'Je ziet prijs, prijs per dag, verzorging, beoordeling, sterren en aanbiederinformatie.' },
];

const highlights = [
  'Objectieve vergelijking',
  'Prijs per dag als kernmetric',
  'Flexibele vertrekperiodes',
  'Meerdere aanbieders naast elkaar',
];

export const dynamic = 'force-dynamic';

export default function HomePage() {
  const filterOptions = loadFilterOptions();

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="border-b border-slate-200 bg-[linear-gradient(135deg,_#f8fbff_0%,_#eef4ff_100%)]">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-24">
          <div className="max-w-2xl">
            <div className="inline-flex rounded-full border border-brand-500/20 bg-white/80 px-4 py-2 text-sm font-medium text-brand-700 shadow-sm">
              Onafhankelijk vakantievergelijkingsplatform
            </div>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
              Vergelijk vakanties op budget, prijs per dag en flexibiliteit.
            </h1>
            <p className="mt-6 text-lg leading-8 text-slate-700">
              VacationWeb toont objectief beschikbare aanbiedingen van meerdere aanbieders, zodat je zelf kunt kiezen op basis van jouw budget en voorkeuren.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link href="/search" className="rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700">
                Zoek vakanties
              </Link>
              <Link href="/results" className="rounded-full border border-slate-300 bg-white/80 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-brand-500 hover:text-brand-700">
                Bekijk beschikbare opties
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              {highlights.map((item) => (
                <span key={item} className="rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm text-slate-600 shadow-sm">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_35px_80px_-25px_rgba(15,23,42,0.22)] sm:p-8">
            <div className="rounded-[1.5rem] bg-slate-950 p-6 text-white">
              <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Beschikbare aanbiedingen</p>
              <div className="mt-6 grid gap-6 sm:grid-cols-2">
                <div>
                  <p className="text-4xl font-semibold">184</p>
                  <p className="mt-2 text-sm text-slate-300">vergelijkbare vakanties</p>
                </div>
                <div>
                  <p className="text-4xl font-semibold">€ 89</p>
                  <p className="mt-2 text-sm text-slate-300">prijs per dag</p>
                </div>
              </div>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Flexibel vertrek</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">7-12 dagen</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Aanbieders</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">8+ partners</p>
              </div>
            </div>
            <div className="mt-6">
              <SearchForm {...filterOptions} />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-700">Populaire bestemmingen</p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-950">Vergelijk vakanties naar populaire regio&apos;s</h2>
          </div>
        </div>
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          {destinations.map((destination) => (
            <div key={destination.name} className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
              <div className="relative h-44 w-full">
                <img src={destination.image} alt={destination.name} className="h-full w-full object-cover" />
              </div>
              <div className="p-5">
                <p className="text-xl font-semibold text-slate-950">{destination.name}</p>
                <p className="mt-1 text-sm text-slate-600">{destination.country}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-700">Populaire landen</p>
          <div className="mt-6 flex flex-wrap gap-3">
            {countries.map((country) => (
              <span key={country} className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">
                {country}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {themes.map((theme) => (
            <div key={theme.title} className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-lg font-semibold text-slate-950">{theme.title}</p>
              <p className="mt-3 text-sm leading-7 text-slate-600">{theme.description}</p>
              <Link href="/results" className="mt-5 inline-flex text-sm font-semibold text-brand-700">
                Bekijk opties →
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-16 lg:px-8">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-700">Veelgestelde vragen</p>
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {faqs.map((item) => (
              <div key={item.question} className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-5">
                <p className="font-semibold text-slate-950">{item.question}</p>
                <p className="mt-2 text-sm leading-7 text-slate-600">{item.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-12 text-sm text-slate-600 lg:grid-cols-4 lg:px-8">
          <div>
            <p className="font-semibold text-slate-950">VacationWeb</p>
            <p className="mt-3 leading-7">Objectief vergelijken van vakantieaanbiedingen op basis van prijs, verzorging en flexibiliteit.</p>
          </div>
          <div>
            <p className="font-semibold text-slate-950">Pagina&apos;s</p>
            <ul className="mt-3 space-y-2">
              <li><Link href="/search" className="hover:text-brand-700">Zoeken</Link></li>
              <li><Link href="/results" className="hover:text-brand-700">Resultaten</Link></li>
              <li><Link href="/faq" className="hover:text-brand-700">FAQ</Link></li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-slate-950">Thema&apos;s</p>
            <ul className="mt-3 space-y-2">
              <li><Link href="/results" className="hover:text-brand-700">All inclusive</Link></li>
              <li><Link href="/results" className="hover:text-brand-700">Last minute</Link></li>
              <li><Link href="/results" className="hover:text-brand-700">Goedkoop</Link></li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-slate-950">Contact</p>
            <ul className="mt-3 space-y-2">
              <li><Link href="/contact" className="hover:text-brand-700">Contact</Link></li>
              <li><Link href="/over-ons" className="hover:text-brand-700">Over ons</Link></li>
            </ul>
          </div>
        </div>
      </footer>
    </main>
  );
}
