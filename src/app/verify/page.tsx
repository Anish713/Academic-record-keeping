'use client';

import { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/Button';

export default function VerifyPage() {
  const [recordId, setRecordId] = useState('');
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [recordDetails, setRecordDetails] = useState<any>(null);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // In a real implementation, this would call the blockchain to verify the record
    setVerificationStatus('loading');
    
    // Simulate API call
    setTimeout(() => {
      if (recordId === '8898789') {
        setVerificationStatus('success');
        setRecordDetails({
          id: recordId,
          studentName: 'John Doe',
          universityName: 'Example University',
          recordType: 'Transcript',
          issueDate: 'March 15, 2023',
          verified: true,
          issuer: '0x1234...5678',
        });
      } else {
        setVerificationStatus('error');
        setRecordDetails(null);
      }
    }, 1500);
  };

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Verify Academic Records</h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Enter the record ID to verify the authenticity of an academic record on the blockchain.
          </p>
        </div>

        <div className="bg-white shadow-md rounded-lg p-6 mb-10">
          <form onSubmit={handleVerify} className="flex flex-col sm:flex-row gap-4">
            <input
              type="text"
              value={recordId}
              onChange={(e) => setRecordId(e.target.value)}
              placeholder="Enter record ID (e.g., 8898789)"
              className="flex-grow px-4 py-3 rounded-md border border-gray-300 focus:ring-2 focus:ring-navy-700 focus:border-navy-700 text-gray-900"
              required
            />
            <Button 
              type="submit" 
              variant="navy"
              disabled={verificationStatus === 'loading'}
              className="px-8 py-3"
            >
              {verificationStatus === 'loading' ? 'Verifying...' : 'Verify'}
            </Button>
          </form>
        </div>

        {verificationStatus === 'success' && recordDetails && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <div className="flex items-center mb-4">
              <svg className="h-8 w-8 text-green-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h2 className="text-xl font-semibold text-gray-900">Record Verified Successfully</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <div>
                <p className="text-sm text-gray-500 mb-1">Record ID</p>
                <p className="font-medium">{recordDetails.id}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Student Name</p>
                <p className="font-medium">{recordDetails.studentName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">University</p>
                <p className="font-medium">{recordDetails.universityName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Record Type</p>
                <p className="font-medium">{recordDetails.recordType}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Issue Date</p>
                <p className="font-medium">{recordDetails.issueDate}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Issuer</p>
                <p className="font-medium">{recordDetails.issuer}</p>
              </div>
            </div>
            
            <div className="mt-6 pt-6 border-t border-green-200">
              <p className="text-sm text-gray-600">
                This record has been cryptographically verified on the blockchain. The digital signature matches the issuing institution.
              </p>
            </div>
          </div>
        )}

        {verificationStatus === 'error' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-center mb-4">
              <svg className="h-8 w-8 text-red-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h2 className="text-xl font-semibold text-gray-900">Verification Failed</h2>
            </div>
            <p className="text-gray-600">
              We couldn't verify the record with ID <span className="font-medium">{recordId}</span>. Please check the ID and try again, or contact support if you believe this is an error.
            </p>
          </div>
        )}
      </div>
    </MainLayout>
  );
}