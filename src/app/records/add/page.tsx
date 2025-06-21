'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/Button';
import { blockchainService } from '@/services/blockchain';
import { ethers } from 'ethers';

export default function AddRecordPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isUniversity, setIsUniversity] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [studentName, setStudentName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [recordType, setRecordType] = useState('0');
  const [ipfsHash, setIpfsHash] = useState('');
  const [universityName, setUniversityName] = useState('');

  useEffect(() => {
    const initWallet = async () => {
      try {
        const success = await blockchainService.init();
        if (!success) return router.push('/login');

        const address = await blockchainService.getCurrentAddress();
        const hasRole = await blockchainService.hasRole('UNIVERSITY_ROLE', address);
        if (!hasRole) return router.push('/records');

        const uniName = await blockchainService.getUniversityName(address);
        setUniversityName(uniName);
        setIsUniversity(true);
      } catch (err: any) {
        console.error('Initialization error:', err);
        setError('Failed to connect wallet or fetch university info.');
      } finally {
        setLoading(false);
      }
    };

    initWallet();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!studentName.trim() || !studentId.trim() || !ipfsHash.trim()) {
      setError('Please fill in all required fields.');
      return;
    }

    //// TODO: Validation for ipfsHash
    // if (!/^Qm[a-zA-Z0-9]{44}$/.test(ipfsHash.trim())) {
    //   setError('Invalid IPFS hash format. It should start with "Qm..."');
    //   return;
    // }

    try {
      setSubmitting(true);
      setError('');

      const metadataHash = ethers.keccak256(ethers.toUtf8Bytes(ipfsHash.trim()));

      await blockchainService.addRecord(
        studentId.trim(),
        studentName.trim(),
        universityName,
        ipfsHash.trim(),
        metadataHash,
        parseInt(recordType, 10)
      );

      router.push('/dashboard?success=true');
    } catch (err: any) {
      console.error('Add record failed:', err);
      setError('Failed to add record. Please try again or contact support.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-lg text-gray-600">Connecting to blockchain...</p>
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
            You are submitting a record on behalf of: <strong>{universityName}</strong>
          </p>
        </div>

        <div className="bg-white shadow-md rounded-lg p-6 mb-10">
          {error && (
            <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6" role="alert">
              <p className="text-sm text-red-700">{error}</p>
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
                disabled={submitting}
                required
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-navy-500 focus:border-navy-500"
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
                disabled={submitting}
                required
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-navy-500 focus:border-navy-500"
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
                disabled={submitting}
                required
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-navy-500 focus:border-navy-500"
              >
                <option value="0">Transcript</option>
                <option value="1">Certificate</option>
                <option value="2">Degree</option>
              </select>
            </div>

            <div>
              <label htmlFor="ipfsHash" className="block text-sm font-medium text-gray-700">
                IPFS Hash (Document) *
              </label>
              <input
                type="text"
                id="ipfsHash"
                value={ipfsHash}
                onChange={(e) => setIpfsHash(e.target.value)}
                disabled={submitting}
                required
                placeholder="QmXyz..."
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-navy-500 focus:border-navy-500"
              />
              <p className="mt-1 text-sm text-gray-500">
                TODO: Use IPFS services like Pinata or Infura to upload and get a hash.
              </p>
            </div>

            <div className="flex justify-end space-x-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/dashboard')}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" variant="outline" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Add Record'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </MainLayout>
  );
}
