'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { truncateAddress } from '@/lib/utils';
import { blockchainService } from '@/services/blockchain';

export default function Header() {
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState('');
  const [isUniversity, setIsUniversity] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const connectWallet = async () => {
      try {
        const initialized = await blockchainService.init();
        if (!initialized) return;

        const userAddress = await blockchainService.getCurrentAddress();
        if (!userAddress) return;

        setIsConnected(true);
        setAddress(userAddress);

        const hasUniversityRole = await blockchainService.hasRole('UNIVERSITY_ROLE', userAddress);
        const hasAdminRole = await blockchainService.hasRole('ADMIN_ROLE', userAddress);

        setIsUniversity(hasUniversityRole);
        setIsAdmin(hasAdminRole);
      } catch (error) {
        console.error('Failed to connect wallet:', error);
      }
    };

    connectWallet();
  }, []);

  return (
    <header className="w-full py-4 px-6 bg-white shadow-sm">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Link href="/" className="flex items-center">
            <div className="w-10 h-10 rounded-full bg-navy-700 flex items-center justify-center">
              <span className="text-gray-700 hover:text-navy-700 transition-colors font-bold">Logo</span>
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
          {isAdmin && (
            <Link
              href="/admin"
              className="text-gray-700 hover:text-navy-600 px-3 py-2 rounded-md text-sm font-medium"
            >
              Admin
            </Link>
          )}
          {isUniversity && (
            <Link
              href="/dashboard"
              className="text-gray-700 hover:text-navy-600 px-3 py-2 rounded-md text-sm font-medium"
            >
              Dashboard
            </Link>
          )}
        </nav>

        <div className="flex items-center space-x-4">
          {isConnected ? (
            <div className="text-sm text-gray-700 font-medium">
              {truncateAddress(address)}
            </div>
          ) : (
            <Button asChild variant="navy" className='bg-yellow-400 hover:bg-yellow-300 text-black font-bold border-2 border-yellow-500 shadow-lg'>
              <Link href="/login">Login →</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
