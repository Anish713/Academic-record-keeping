"use client";

import { Button } from '@/components/ui/Button';
import { useRouter } from 'next/navigation';

/**
 * Renders a hero section highlighting immutable academic records on the blockchain, featuring a call-to-action button that navigates to the verification page.
 *
 * Displays a prominent heading, descriptive text, and a styled button that routes users to the `/verify` page when clicked.
 */
export default function Hero() {
  const router = useRouter();

  return (
    <section className="w-full py-20 px-6 bg-white">
      <div className="max-w-5xl mx-auto text-center">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-black mb-6">
          Immutable Academic Records on the Blockchain
        </h1>
        
        <p className="text-lg md:text-xl text-teal-600 mb-10 max-w-3xl mx-auto">
          We store your academic records on blockchain to make them immutable and help you find/validate 24/7
        </p>
        
        <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button
              variant="navy"
              size="lg"
              className="bg-yellow-400 hover:bg-yellow-300 text-black font-bold border-2 border-yellow-500 shadow-lg"
              onClick={() => router.push('/verify')}
            >
              Try for free →
            </Button>
        </div>
      </div>
    </section>
  );
}