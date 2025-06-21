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

  const [newUniversityAddress, setNewUniversityAddress] = useState('');
  const [newUniversityName, setNewUniversityName] = useState('');
  const [universities, setUniversities] = useState<{ address: string, name: string }[]>([]);

  useEffect(() => {
    const initWallet = async () => {
      try {
        const success = await blockchainService.init();
        if (!success) {
          window.location.href = '/login';
          return;
        }

        const address = await blockchainService.getCurrentAddress();
        setConnectedAddress(address);

        const hasAdminRole = await blockchainService.hasRole('ADMIN_ROLE', address);
        setIsAdmin(hasAdminRole);

        if (!hasAdminRole) {
          window.location.href = '/login';
          return;
        }

        const paused = await blockchainService.isPaused();
        setIsPaused(paused);

        const allUniversities = await blockchainService.getAllUniversities();
        console.log("Fetched universities:", allUniversities);
        setUniversities(allUniversities);

        setLoading(false);
      } catch (err) {
        console.error('Error initializing wallet:', err);
        setError('Failed to initialize wallet. Please try again.');
        setLoading(false);
      }
    };

    initWallet();
  }, []);

  const handlePauseToggle = async () => {
    try {
      setLoading(true);

      if (isPaused) {
        await blockchainService.unpauseContract();
      } else {
        await blockchainService.pauseContract();
      }

      setIsPaused(!isPaused);
    } catch (err) {
      console.error('Error toggling pause state:', err);
      setError('Failed to update contract state. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddUniversity = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newUniversityAddress) {
      setError('Please enter a university address');
      return;
    }

    try {
      setLoading(true);
      setError('');

      await blockchainService.addUniversity(newUniversityAddress, newUniversityName || 'Unnamed University');

      const updatedList = await blockchainService.getAllUniversities();
      setUniversities(updatedList);
      console.log("Fetched universities updatedList:", updatedList); // Add this line

      setNewUniversityAddress('');
      setNewUniversityName('');
    } catch (err) {
      console.error('Error adding university:', err);
      setError('Failed to add university. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Admin Panel</h1>

        {loading ? (
          <p>Loading...</p>
        ) : (
          <>
            <p className="mb-2">Connected as: {truncateAddress(connectedAddress)}</p>
            <p className="mb-4">Contract is currently <strong>{isPaused ? 'Paused' : 'Active'}</strong></p>

            <Button onClick={handlePauseToggle} className="mb-6">
              {isPaused ? 'Unpause Contract' : 'Pause Contract'}
            </Button>

            <h2 className="text-xl font-semibold mt-6 mb-2">Add University</h2>
            <form onSubmit={handleAddUniversity} className="mb-6 space-y-4">
              <input
                type="text"
                placeholder="University Address"
                value={newUniversityAddress}
                onChange={(e) => setNewUniversityAddress(e.target.value)}
                className="w-full border p-2 rounded"
              />
              <input
                type="text"
                placeholder="University Name (optional)"
                value={newUniversityName}
                onChange={(e) => setNewUniversityName(e.target.value)}
                className="w-full border p-2 rounded"
              />
              <Button type="submit">Add University</Button>
            </form>

            <h2 className="text-xl font-semibold mb-2">Registered Universities</h2>
            {universities.length === 0 ? (
              <p>No universities registered yet.</p>
            ) : (
              <ul className="space-y-2">
                {universities.map((uni, idx) => (
                  <li key={idx} className="border p-3 rounded">
                    <p><strong>{uni.name}</strong></p>
                    <p className="text-sm text-gray-600">{truncateAddress(uni.address)}</p>
                  </li>
                ))}
              </ul>
            )}

            {error && <p className="mt-4 text-red-500">{error}</p>}
          </>
        )}
      </div>
    </MainLayout>
  );
}
