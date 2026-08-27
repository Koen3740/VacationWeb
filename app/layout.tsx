import './globals.css';
import { FavoritesProvider } from '@/components/favorites/favorites-provider';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'VacationWeb | Vakantievergelijking met focus op budget',
  description: 'Vacations vergelijken op basis van totale waarde, prijs per dag, flexibiliteit en meerdere aanbieders.',
  keywords: ['vakantie', 'vacationweb', 'prijs per dag', 'vakantievergelijking', 'budget vakantie'],
  openGraph: {
    title: 'VacationWeb | Vakantievergelijking met focus op budget',
    description: 'Vergelijk vakanties op waarde, prijs per dag en flexibiliteit.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body>
        <FavoritesProvider>{children}</FavoritesProvider>
      </body>
    </html>
  );
}
