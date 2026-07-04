import { HomeHero } from '@/components/home/home-hero';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#F5F7FA]">
      <HomeHero />
    </main>
  );
}
