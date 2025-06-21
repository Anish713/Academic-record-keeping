import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default function Hero() {
  return (
    <section className="w-full py-20 px-6 bg-white">
      <div className="max-w-5xl mx-auto text-center">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-navy-900 mb-6">
          Immutable Academic Records on the Blockchain
        </h1>
        
        <p className="text-lg md:text-xl text-teal-600 mb-10 max-w-3xl mx-auto">
          We store your academic records on blockchain to make them immutable and help you find/validate 24/7
        </p>
        
        <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button
            variant="navy"
            size="lg"
            asChild
            className="bg-yellow-400 hover:bg-yellow-300 text-black font-bold border-2 border-yellow-500 shadow-lg"
            >
            <Link href="/try-for-free">
              Try for free →
            </Link>
            </Button>
        </div>
      </div>
    </section>
  );
}