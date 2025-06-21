'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/Button';
import { blockchainService } from '@/services/blockchain';

export default function AddRecordPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isUniversity, setIsUniversity] = useState(false);
  const [error, setError] = useState('');
  
  // Form state
  const [studentName, setStudentName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [recordType, setRecordType] = useState('0'); // Default to Transcript (0)
  const [ipfsHash, setIpfsHash] = useState('');
  
  // Initialize and check university role
  useEffect(() => {
    const initWallet = async () => {
      try {
        // Initialize blockchain service
        const success = await blockchainService.init();
        if (!success) {
          router.push('/login');
          return;
        }
        
        // Get connected address
        const address = await blockchainService.getAddress();
        
        // Check if the user has university role
        const hasUniversityRole = await blockchainService.hasRole('UNIVERSITY_ROLE', address);
        setIsUniversity(hasUniversityRole);
        
        if (!hasUniversityRole) {
          router.push('/records');
          return;
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error initializing wallet:', err);
        setError('Failed to initialize wallet. Please try again.');
        setLoading(false);
      }
    };
    
    initWallet();
  }, [router]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!studentName || !studentId || !ipfsHash) {
      setError('Please fill in all required fields');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      
      // Add record to blockchain
      const recordId = await blockchainService.addRecord(
        studentName,
        studentId,
        parseInt(recordType, 10),
        ipfsHash
      );
      
      // Redirect to the dashboard
      router.push('/dashboard?success=true');
    } catch (err) {
      console.error('Error adding record:', err);
      setError('Failed to add record. Please try again.');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-lg text-gray-600">Loading...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Add New Academic Record</h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Create a new academic record that will be stored on the blockchain.
          </p>
        </div>

        <div className="bg-white shadow-md rounded-lg p-6 mb-10">
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
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="studentName" className="block text-sm font-medium text-gray-700">
                Student Name *
              </label>
              <input
                type="text"
                id="studentName"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-navy-500 focus:border-navy-500"
                placeholder="Full Name"
                required
              />
            </div>
            
            <div>
              <label htmlFor="studentId" className="block text-sm font-medium text-gray-700">
                Student ID *
              </label>
              <input
                type="text"
                id="studentId"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-navy-500 focus:border-navy-500"
                placeholder="Student ID"
                required
              />
            </div>
            
            <div>
              <label htmlFor="recordType" className="block text-sm font-medium text-gray-700">
                Record Type *
              </label>
              <select
                id="recordType"
                value={recordType}
                onChange={(e) => setRecordType(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-navy-500 focus:border-navy-500"
                required
              >
                <option value="0">Transcript</option>
                <option value="1">Certificate</option>
                <option value="2">Degree</option>
              </select>
            </div>
            
            <div>
              <label htmlFor="ipfsHash" className="block text-sm font-medium text-gray-700">
                IPFS Hash (Document Hash) *
              </label>
              <input
                type="text"
                id="ipfsHash"
                value={ipfsHash}
                onChange={(e) => setIpfsHash(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-navy-500 focus:border-navy-500"
                placeholder="QmXyz..."
                required
              />
              <p className="mt-1 text-sm text-gray-500">
                The IPFS hash of the uploaded document. You can use services like Pinata or IPFS to upload and get a hash.
              </p>
            </div>
            
            <div className="flex justify-end space-x-3">
              <Button 
                type="button" 
                variant="outline"
                onClick={() => router.push('/dashboard')}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                variant="navy"
                disabled={loading}
              >
                {loading ? 'Adding...' : 'Add Record'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </MainLayout>
  );
}