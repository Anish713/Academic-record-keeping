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
      {/* <div className="w-full py-16 px-6 bg-white text-center">
        <p className="text-gray-500">#TODO: Add cards to show the features</p>
      </div> */}
    </MainLayout>
  );
}
