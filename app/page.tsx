import { HomeFeatures } from '@/components/home/home-features';
import { HomeHero } from '@/components/home/home-hero';
import { HomePopularDestinations } from '@/components/home/home-popular-destinations';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#F5F7FA]">
      <HomeHero />
      <section className="bg-[#0A2D62] py-6">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-5 lg:px-6">
          <HomeFeatures />
        </div>
      </section>
      <HomePopularDestinations />
    </main>
  );
}
