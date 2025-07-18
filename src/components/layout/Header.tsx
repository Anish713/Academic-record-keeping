'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { truncateAddress } from '@/lib/utils';
import { blockchainService } from '@/services/blockchain';

export default function Header() {
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState('');
  const [isUniversity, setIsUniversity] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const router = useRouter();

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
        const hasSuperAdminRole = await blockchainService.hasRole('SUPER_ADMIN_ROLE', userAddress);

        setIsUniversity(hasUniversityRole);
        setIsAdmin(hasAdminRole);
        setIsSuperAdmin(hasSuperAdminRole);
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
          <button
            className="flex items-center"
            onClick={() => router.push('/')}
            type="button"
          >
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center overflow-hidden border border-gray-200">
              <img src="/favicon.ico" alt="CertiChain Logo" className="w-full h-full object-contain" />
            </div>
          </button>
        </div>

        <nav className="hidden md:flex items-center space-x-6">
          <button
            className="text-gray-700 hover:text-navy-700 transition-colors"
            onClick={() => router.push('/')}
            type="button"
          >
            Home
          </button>
          <button
            className="text-gray-700 hover:text-navy-700 transition-colors"
            onClick={() => router.push('/records')}
            type="button"
          >
            Records
          </button>
          <button
            className="text-gray-700 hover:text-navy-700 transition-colors"
            onClick={() => router.push('/verify')}
            type="button"
          >
            Verify
          </button>
          <button
            className="text-gray-700 hover:text-navy-700 transition-colors"
            onClick={() => router.push('/about')}
            type="button"
          >
            About
          </button>
          {(isAdmin || isSuperAdmin) && (
            <button
              className="text-gray-700 hover:text-navy-600 px-3 py-2 rounded-md text-sm font-medium"
              onClick={() => router.push('/admin')}
              type="button"
            >
              {isSuperAdmin ? 'Super Admin' : 'Admin'}
            </button>
          )}
          {isUniversity && (
            <button
              className="text-gray-700 hover:text-navy-600 px-3 py-2 rounded-md text-sm font-medium"
              onClick={() => router.push('/dashboard')}
              type="button"
            >
              Dashboard
            </button>
          )}
        </nav>

        <div className="flex items-center space-x-4">
          {isConnected ? (
            <div className="text-sm text-gray-700 font-medium">
              {truncateAddress(address)}
            </div>
          ) : (
            <Button
              variant="navy"
              className='bg-yellow-400 hover:bg-yellow-300 text-black font-bold border-2 border-yellow-500 shadow-lg'
              onClick={() => router.push('/login')}
            >
              Login →
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
