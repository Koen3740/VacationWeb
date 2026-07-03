import { HomeHero } from '@/components/home/home-hero';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-stone-950">
      <HomeHero />
    </main>
  );
}
