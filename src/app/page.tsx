import MainLayout from '@/components/layout/MainLayout';
import Hero from '@/components/home/Hero';
import SearchSection from '@/components/home/SearchSection';
import FeaturesSection from '@/components/home/FeaturesSection';

/**
 * Renders the home page with a main layout containing the hero, search, and features sections.
 *
 * @returns The JSX markup for the home page.
 */
export default function Home() {
  return (
    <MainLayout>
      <Hero />
      <SearchSection />
      <FeaturesSection />
    </MainLayout>
  );
}
