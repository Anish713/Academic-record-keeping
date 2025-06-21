import MainLayout from '@/components/layout/MainLayout';
import Hero from '@/components/home/Hero';
import SearchSection from '@/components/home/SearchSection';
import FeaturesSection from '@/components/home/FeaturesSection';

export default function Home() {
  return (
    <MainLayout>
      <Hero />
      <SearchSection />
      <FeaturesSection />
    </MainLayout>
  );
}
