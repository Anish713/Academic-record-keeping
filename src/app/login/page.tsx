'use client';

import { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/Button';
import { blockchainService } from '@/services/blockchain';

export default function LoginPage() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');

  const connectWallet = async () => {
    setIsConnecting(true);
    setError('');
    
    try {
      // Initialize blockchain service
      const success = await blockchainService.init();
      if (!success) {
        throw new Error('Failed to initialize blockchain service');
      }
      
      // Get connected address
      const address = await blockchainService.getAddress();
      
      // Check if the user has university role
      const isUniversity = await blockchainService.hasRole('UNIVERSITY_ROLE', address);
      
      // Redirect based on role
      if (isUniversity) {
        window.location.href = '/dashboard';
      } else {
        window.location.href = '/records';
      }
    } catch (err: any) {
      console.error('Error connecting wallet:', err);
      if (err.message?.includes('MetaMask is not installed')) {
        setError('MetaMask is not installed. Please install MetaMask to continue.');
      } else if (err.message?.includes('User rejected')) {
        setError('You denied wallet connection. Please try again.');
      } else {
        setError('Failed to connect wallet. Please try again.');
      }
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-md mx-auto py-16 px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Login</h1>
          <p className="text-gray-600">
            Connect your wallet to access your academic records or university dashboard.
          </p>
        </div>

        <div className="bg-white shadow-md rounded-lg p-8">
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-medium text-gray-900 mb-4">Connect Wallet</h2>
              <p className="text-sm text-gray-600 mb-6">
                Connect your Ethereum wallet to securely access the platform. We support MetaMask and other Web3 wallets.
              </p>
              
              <Button
                variant="navy"
                className="w-full py-3 flex items-center justify-center"
                onClick={connectWallet}
                disabled={isConnecting}
              >
                {isConnecting ? 'Connecting...' : 'Connect Wallet'}
              </Button>
              
              {error && (
                <p className="mt-4 text-sm text-red-600">{error}</p>
              )}
            </div>
            
            <div className="pt-6 border-t border-gray-200">
              <h2 className="text-xl font-medium text-gray-900 mb-4">Access with ID</h2>
              <p className="text-sm text-gray-600 mb-6">
                If you have a record ID, you can verify it without connecting a wallet.
              </p>
              
              <Button
                variant="outline"
                className="w-full py-3"
                asChild
              >
                <a href="/verify">Verify Record</a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}