import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default function Header() {
  return (
    <header className="w-full py-4 px-6 bg-white shadow-sm">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Link href="/" className="flex items-center">
            <div className="w-10 h-10 rounded-full bg-navy-700 flex items-center justify-center">
              <span className="text-white font-bold">Logo</span>
            </div>
          </Link>
        </div>

        <nav className="hidden md:flex items-center space-x-6">
          <Link href="/" className="text-gray-700 hover:text-navy-700 transition-colors">
            Home
          </Link>
          <Link href="/records" className="text-gray-700 hover:text-navy-700 transition-colors">
            Records
          </Link>
          <Link href="/verify" className="text-gray-700 hover:text-navy-700 transition-colors">
            Verify
          </Link>
          <Link href="/about" className="text-gray-700 hover:text-navy-700 transition-colors">
            About
          </Link>
        </nav>

        <div className="flex items-center space-x-4">
          <Button asChild variant="navy">
            <Link href="/login">Login →</Link>
          </Button>

        </div>
      </div>
    </header>
  );
}