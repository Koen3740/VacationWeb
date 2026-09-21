import './globals.css';
import { FavoritesProvider } from '@/components/favorites/favorites-provider';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'VacationWeb | Meer vakantie voor jouw budget',
  description:
    'Vergelijk vakanties van meerdere reisaanbieders in één zoekopdracht. Boek rechtstreeks bij de reisorganisatie.',
  keywords: ['vakantie', 'vacationweb', 'vakantie vergelijken', 'vakantievergelijking', 'bestemmingen'],
  openGraph: {
    title: 'VacationWeb | Meer vakantie voor jouw budget',
    description: 'Vergelijk vakanties van meerdere reisaanbieders in één zoekopdracht.',
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
