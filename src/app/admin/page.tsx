'use client';

import { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/Button';
import { blockchainService } from '@/services/blockchain';
import { truncateAddress } from '@/lib/utils';

export default function AdminPage() {
  const [connectedAddress, setConnectedAddress] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isPaused, setIsPaused] = useState(false);
  
  // University management
  const [newUniversityAddress, setNewUniversityAddress] = useState('');
  const [newUniversityName, setNewUniversityName] = useState('');
  const [universities, setUniversities] = useState<{address: string, name: string}[]>([]);
  
  // Initialize and check admin role
  useEffect(() => {
    const initWallet = async () => {
      try {
        // Initialize blockchain service
        const success = await blockchainService.init();
        if (!success) {
          window.location.href = '/login';
          return;
        }
        
        // Get connected address
        const address = await blockchainService.getAddress();
        setConnectedAddress(address);
        
        // Check if the user has admin role
        const hasAdminRole = await blockchainService.hasRole('ADMIN_ROLE', address);
        setIsAdmin(hasAdminRole);
        
        if (!hasAdminRole) {
          window.location.href = '/login';
          return;
        }
        
        // Check if contract is paused
        const paused = await blockchainService.isContractPaused();
        setIsPaused(paused);
        
        setLoading(false);
      } catch (err) {
        console.error('Error initializing wallet:', err);
        setError('Failed to initialize wallet. Please try again.');
        setLoading(false);
      }
    };
    
    initWallet();
  }, []);
  
  // Handle pause/unpause
  const handlePauseToggle = async () => {
    try {
      setLoading(true);
      
      if (isPaused) {
        await blockchainService.unpauseContract();
      } else {
        await blockchainService.pauseContract();
      }
      
      setIsPaused(!isPaused);
      setLoading(false);
    } catch (err) {
      console.error('Error toggling pause state:', err);
      setError('Failed to update contract state. Please try again.');
      setLoading(false);
    }
  };
  
  // Add university
  const handleAddUniversity = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newUniversityAddress) {
      setError('Please enter a university address');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      
      await blockchainService.addUniversity(newUniversityAddress);
      
      // Store university name mapping
      if (newUniversityName) {
        blockchainService.setUniversityName(newUniversityAddress, newUniversityName);
      }
      
      // Add to local state
      setUniversities(prev => [
        ...prev, 
        { 
          address: newUniversityAddress, 
          name: newUniversityName || 'Unnamed University' 
        }
      ]);
      
      // Reset form
      setNewUniversityAddress('');
      setNewUniversityName('');
      setLoading(false);
    } catch (err) {
      console.error('Error adding university:', err);
      setError('Failed to add university. Please try again.');
      setLoading(false);
    }
  };
  
  // Remove university
  const handleRemoveUniversity = async (address: string) => {
    try {
      setLoading(true);
      
      await blockchainService.removeUniversity(address);
      
      // Remove from local state
      setUniversities(prev => prev.filter(uni => uni.address !== address));
      
      setLoading(false);
    } catch (err) {
      console.error('Error removing university:', err);
      setError('Failed to remove university. Please try again.');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-lg text-gray-600">Loading...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg mb-8">
          <div className="px-6 py-5 border-b border-gray-200">
            <div className="flex items-center justify-between flex-wrap sm:flex-nowrap">
              <div>
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Admin Dashboard
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Connected as: {truncateAddress(connectedAddress)}
                </p>
              </div>
              <div>
                <Button 
                  variant={isPaused ? "default" : "destructive"}
                  onClick={handlePauseToggle}
                  disabled={loading}
                >
                  {isPaused ? 'Unpause Contract' : 'Pause Contract'}
                </Button>
              </div>
            </div>
          </div>
        </div>
        
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}
        
        <div className="bg-white shadow rounded-lg mb-8">
          <div className="px-6 py-5 border-b border-gray-200">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              University Management
            </h3>
          </div>
          
          <div className="px-6 py-5">
            <form onSubmit={handleAddUniversity} className="space-y-6">
              <div>
                <label htmlFor="universityAddress" className="block text-sm font-medium text-gray-700">
                  University Ethereum Address
                </label>
                <input
                  type="text"
                  id="universityAddress"
                  value={newUniversityAddress}
                  onChange={(e) => setNewUniversityAddress(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-navy-500 focus:border-navy-500"
                  placeholder="0x..."
                  required
                />
              </div>
              
              <div>
                <label htmlFor="universityName" className="block text-sm font-medium text-gray-700">
                  University Name
                </label>
                <input
                  type="text"
                  id="universityName"
                  value={newUniversityName}
                  onChange={(e) => setNewUniversityName(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-navy-500 focus:border-navy-500"
                  placeholder="University Name"
                />
              </div>
              
              <div>
                <Button 
                  type="submit" 
                  variant="navy"
                  disabled={loading || !newUniversityAddress}
                >
                  Add University
                </Button>
              </div>
            </form>
          </div>
          
          <div className="px-6 py-5 border-t border-gray-200">
            <h4 className="text-md font-medium text-gray-900 mb-4">
              Registered Universities
            </h4>
            
            {universities.length === 0 ? (
              <p className="text-sm text-gray-500">No universities added yet.</p>
            ) : (
              <ul className="divide-y divide-gray-200">
                {universities.map((university) => (
                  <li key={university.address} className="py-4 flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{university.name}</p>
                      <p className="text-sm text-gray-500">{truncateAddress(university.address)}</p>
                    </div>
                    <Button 
                      variant="destructive"
                      onClick={() => handleRemoveUniversity(university.address)}
                      disabled={loading}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}