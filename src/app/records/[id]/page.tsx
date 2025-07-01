'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/Button';
import { blockchainService } from '@/services/blockchain';
import { truncateAddress } from '@/lib/utils';

export default function RecordDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [record, setRecord] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [initialized, setInitialized] = useState(false);
  const [connectedAddress, setConnectedAddress] = useState('');
  
  // Sharing functionality
  const [shareAddress, setShareAddress] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [shareSuccess, setShareSuccess] = useState('');
  const [shareError, setShareError] = useState('');
  const [sharedWith, setSharedWith] = useState<string[]>([]);

  useEffect(() => {
    const init = async () => {
      try {
        const success = await blockchainService.init();
        if (!success) {
          router.push('/login');
          return;
        }

        const address = await blockchainService.getCurrentAddress();
        setConnectedAddress(address);
        setInitialized(true);
      } catch (err) {
        console.error('Error initializing blockchain service:', err);
        router.push('/login');
      }
    };

    init();
  }, []);

  useEffect(() => {
    const fetchRecord = async () => {
      if (!initialized || !params.id) return;

      setLoading(true);
      setError('');

      try {
        const recordId = parseInt(params.id as string, 10);
        if (isNaN(recordId)) throw new Error('Invalid record ID');

        const recordData = await blockchainService.getRecord(recordId);
        console.log('Fetched record data:', recordData);
        
        if (!recordData) {
          setError('Record not found');
          console.error('Record not found for recordId:', recordId);
          setLoading(false);
          return;
        }

        // Format record data
        const formattedRecord = {
          id: recordId,
          studentName: recordData.studentName,
          studentId: recordData.studentId,
          universityName: recordData.universityName || await blockchainService.getUniversityName(recordData.university),
          recordType: recordData.recordType === 0 ? 'Transcript' : 
                    recordData.recordType === 1 ? 'Certificate' : 
                    recordData.recordType === 2 ? 'Degree' : 'Other',
          issueDate: new Date(recordData.timestamp * 1000).toLocaleDateString(),
          verified: recordData.isValid,
          issuer: recordData.university,
          issuerTruncated: truncateAddress(recordData.university),
        };

        setRecord(formattedRecord);
        
        if (recordData.studentId === connectedAddress) {
          await loadSharedAddresses(recordId);
        }
      } catch (err) {
        console.error('Error fetching record:', err);
        setError('Failed to fetch record details. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchRecord();
  }, [initialized, params.id, connectedAddress]);

  const loadSharedAddresses = async (recordId: number) => {
    try {
      // This is a placeholder - in a real implementation, you would fetch the list of addresses
      // this record is shared with from the blockchain
      // For now, we'll just check if the record is shared with the current address
      
      // TODO: Have a function to get all addresses this record is shared with
      // const sharedAddresses = await blockchainService.getSharedAddresses(recordId);
      // setSharedWith(sharedAddresses);
      
      // For now, we'll leave this empty as the contract doesn't have a direct method to get all addresses
      setSharedWith([]);
    } catch (err) {
      console.error('Error loading shared addresses:', err);
    }
  };

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareAddress || !record) return;

    setIsSharing(true);
    setShareSuccess('');
    setShareError('');

    try {
      // Validate the address
      if (!shareAddress.startsWith('0x') || shareAddress.length !== 42) {
        throw new Error('Invalid Ethereum address');
      }

      await blockchainService.shareRecord(record.id, shareAddress);
      
      setShareSuccess(`Record successfully shared with ${truncateAddress(shareAddress)}`);
      setShareAddress('');
      
      // Add to the list of shared addresses
      setSharedWith([...sharedWith, shareAddress]);
    } catch (err: any) {
      console.error('Error sharing record:', err);
      setShareError(err.message || 'Failed to share record. Please try again.');
    } finally {
      setIsSharing(false);
    }
  };

  const handleUnshare = async (address: string) => {
    if (!record) return;

    setIsSharing(true);
    setShareSuccess('');
    setShareError('');

    try {
      await blockchainService.unshareRecord(record.id, address);
      
      setShareSuccess(`Record access revoked from ${truncateAddress(address)}`);
      
      // Remove from the list of shared addresses
      setSharedWith(sharedWith.filter(a => a !== address));
    } catch (err: any) {
      console.error('Error unsharing record:', err);
      setShareError(err.message || 'Failed to revoke access. Please try again.');
    } finally {
      setIsSharing(false);
    }
  };

  const isOwnRecord = () => {
    if (!record || !connectedAddress) return false;
    return record.studentId === connectedAddress;
  };

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <button 
            onClick={() => router.push('/records')} 
            className="flex items-center text-navy-600 hover:text-navy-800"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            Back to Records
          </button>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Record Details</h1>
          <p className="text-lg text-gray-600">
            View and manage your academic record
          </p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-navy-700 mb-4"></div>
            <p className="text-gray-600">Loading record details...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <svg className="h-12 w-12 text-red-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Record</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button variant="navy" onClick={() => router.push('/records')}>
              Return to Records
            </Button>
          </div>
        ) : record ? (
          <div className="bg-white shadow-md rounded-lg overflow-hidden">
            {/* Record details section */}
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Record Information</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Record ID</p>
                  <p className="font-medium">{record.id}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Student Name</p>
                  <p className="font-medium">{record.studentName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">University</p>
                  <p className="font-medium">{record.universityName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Record Type</p>
                  <p className="font-medium">
                    <span className={`px-2 py-1 rounded-md text-xs font-medium ${record.recordType === 'Transcript' ? 'bg-teal-100 text-teal-800' : 'bg-blue-100 text-blue-800'}`}>
                      {record.recordType}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Issue Date</p>
                  <p className="font-medium">{record.issueDate}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Issuer</p>
                  <p className="font-medium">{record.issuerTruncated}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Verification Status</p>
                  <p className="font-medium flex items-center">
                    {record.verified ? (
                      <>
                        <svg className="h-5 w-5 text-green-500 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Verified
                      </>
                    ) : (
                      <>
                        <svg className="h-5 w-5 text-red-500 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Not Verified
                      </>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Sharing section - only visible to the record owner */}
            {isOwnRecord() && (
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Share Your Record</h2>
                <p className="text-gray-600 mb-6">
                  Share this record with other Ethereum addresses to grant them access to view your record details.
                </p>

                <form onSubmit={handleShare} className="mb-6">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <input
                      type="text"
                      value={shareAddress}
                      onChange={(e) => setShareAddress(e.target.value)}
                      placeholder="Enter Ethereum address (0x...)"
                      className="flex-grow px-4 py-3 rounded-md border border-gray-300 focus:ring-2 focus:ring-navy-700 focus:border-navy-700 text-gray-900"
                      required
                    />
                    <Button 
                      type="submit" 
                      variant="navy"
                      disabled={isSharing}
                    >
                      {isSharing ? 'Sharing...' : 'Share Record'}
                    </Button>
                  </div>
                </form>

                {shareSuccess && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                    <p className="text-green-800 flex items-center">
                      <svg className="h-5 w-5 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {shareSuccess}
                    </p>
                  </div>
                )}

                {shareError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                    <p className="text-red-800 flex items-center">
                      <svg className="h-5 w-5 text-red-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {shareError}
                    </p>
                  </div>
                )}

                {/* Shared with list */}
                <div className="mt-8">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Shared With</h3>
                  
                  {sharedWith.length === 0 ? (
                    <p className="text-gray-500 italic">This record hasn't been shared with anyone yet.</p>
                  ) : (
                    <ul className="divide-y divide-gray-200 border border-gray-200 rounded-md">
                      {sharedWith.map((address, index) => (
                        <li key={index} className="flex items-center justify-between py-3 px-4">
                          <span className="text-gray-800">{truncateAddress(address)}</span>
                          <Button 
                            variant="outline" 
                            onClick={() => handleUnshare(address)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Revoke Access
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </MainLayout>
  );
}