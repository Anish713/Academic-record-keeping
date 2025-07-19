'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/Button';
import { blockchainService } from '@/services/blockchain';
import { truncateAddress } from '@/lib/utils';

export default function StudentDashboardPage() {
  const [connectedAddress, setConnectedAddress] = useState('');
  const [studentId, setStudentId] = useState('');
  const [records, setRecords] = useState<any[]>([]);
  const [sharedRecords, setSharedRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isRegistered, setIsRegistered] = useState(false);
  const [fetching, setFetching] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const initWallet = async () => {
      try {
        const success = await blockchainService.init();
        if (!success) {
          router.push('/login');
          return;
        }

        const address = await blockchainService.getCurrentAddress();
        setConnectedAddress(address);

        // Check if the user is a university
        const isUniversity = await blockchainService.hasRole('UNIVERSITY_ROLE', address);
        if (isUniversity) {
          router.push('/dashboard');
          return;
        }

        // Check if the user is already registered as a student
        await fetchStudentDetails(address);
      } catch (err) {
        console.error('Error initializing wallet:', err);
        setError('Failed to connect to blockchain. Please make sure your wallet is connected.');
      } finally {
        setLoading(false);
      }
    };

    initWallet();
  }, []);
  
  const fetchStudentDetails = async (address: string) => {
    try {
      const studentIdFromAddress = await blockchainService.getStudentId(address);
      if (studentIdFromAddress && studentIdFromAddress.length > 0) {
        setStudentId(studentIdFromAddress);
        setIsRegistered(true);
        await fetchRecords(studentIdFromAddress);
        await fetchSharedRecords(address);
      }
    } catch (err) {
      console.error('Error fetching student details:', err);
      setError('Failed to fetch student details. Please try again.');
    }
  };

  const fetchRecords = async (id: string) => {
    try {
      const recordIds = await blockchainService.getStudentRecords(id);

      const recordsData = await Promise.all(
        recordIds.map(async (id: number) => {
          const record = await blockchainService.getRecord(id);
          return {
            id: id.toString(),
            studentName: record.studentName,
            universityName: record.universityName,
            type: getRecordTypeName(record.recordType),
            dateIssued: new Date(record.timestamp * 1000).toLocaleDateString(),
          };
        })
      );

      setRecords(recordsData);
    } catch (err) {
      console.error('Error fetching records:', err);
      setError('Failed to fetch records. Please try again.');
    }
  };

  const fetchSharedRecords = async (address: string) => {
    try {
      const recordIds = await blockchainService.getSharedRecords(address);

      const recordsData = await Promise.all(
        recordIds.map(async (id: number) => {
          const record = await blockchainService.getRecord(id);
          return {
            id: id.toString(),
            studentName: record.studentName,
            universityName: record.universityName,
            type: getRecordTypeName(record.recordType),
            dateIssued: new Date(record.timestamp * 1000).toLocaleDateString(),
          };
        })
      );

      setSharedRecords(recordsData);
    } catch (err) {
      console.error('Error fetching shared records:', err);
    }
  };

  // Helper function to get record type names
  const getRecordTypeName = (typeId: number): string => {
    const types = [
      // Academic Records
      'Transcript', 'Degree', 'Marksheet', 'Diploma', 'Certificate', 'Provisional Certificate',
      // Identity & Personal Verification
      'Birth Certificate', 'Citizenship', 'National ID', 'Passport Copy', 'Character Certificate',
      // Admission & Examination Documents
      'Entrance Results', 'Admit Card', 'Counseling Letter', 'Seat Allotment Letter', 'Migration Certificate', 'Transfer Certificate',
      // Administrative & Financial Records
      'Bills', 'Fee Receipt', 'Scholarship Letter', 'Loan Document', 'Hostel Clearance',
      // Academic Schedules & Communications
      'Routine', 'Notice', 'Circular', 'News',
      // Miscellaneous & Supporting Documents
      'Recommendation Letter', 'Internship Certificate', 'Experience Letter', 'Bonafide Certificate', 'No Objection Certificate',
      // Fallback
      'Other'
    ];
    return types[typeId] || 'Unknown';
  };

  const handleGetDetails = async () => {
    setFetching(true);
    setError('');

    try {
      const address = await blockchainService.getCurrentAddress();
      await fetchStudentDetails(address);
      
      if (!isRegistered) {
        setError('No student record found for this address. Please contact your university administrator.');
      }
    } catch (err: any) {
      console.error('Failed to get details:', err);
      setError('Failed to get student details. ' + (err.message || 'Please try again.'));
    } finally {
      setFetching(false);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg mb-8">
          <div className="px-6 py-5 border-b border-gray-200">
            <div className="flex items-center justify-between flex-wrap sm:flex-nowrap">
              <div>
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Student Dashboard
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {truncateAddress(connectedAddress)}
                </p>
              </div>
            </div>
          </div>

          {!isRegistered ? (
            <div className="px-6 py-5">
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-yellow-700">
                      No student record found for your address. Click the button below to check if your university has registered you.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {error && (
                  <div className="text-sm text-red-600">
                    {error}
                  </div>
                )}
                <Button
                  type="button"
                  variant="outline"
                  disabled={fetching}
                  onClick={handleGetDetails}
                >
                  {fetching ? 'Checking...' : 'Get My Details'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="px-6 py-5 grid grid-cols-1 gap-5 sm:grid-cols-3">
              <div className="bg-gray-50 overflow-hidden shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <dt className="text-sm font-medium text-gray-500 truncate">Student ID</dt>
                  <dd className="mt-1 text-lg font-semibold text-gray-900 truncate">{studentId}</dd>
                </div>
              </div>

              <div className="bg-gray-50 overflow-hidden shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <dt className="text-sm font-medium text-gray-500 truncate">My Records</dt>
                  <dd className="mt-1 text-3xl font-semibold text-gray-900">{records.length}</dd>
                </div>
              </div>

              <div className="bg-gray-50 overflow-hidden shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <dt className="text-sm font-medium text-gray-500 truncate">Shared With Me</dt>
                  <dd className="mt-1 text-3xl font-semibold text-gray-900">{sharedRecords.length}</dd>
                </div>
              </div>
            </div>
          )}
        </div>

        {isRegistered && (
          <>
            <div className="bg-white shadow overflow-hidden rounded-lg mb-8">
              <div className="px-6 py-5 border-b border-gray-200">
                <h3 className="text-lg leading-6 font-medium text-gray-900">My Records</h3>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">University</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Issued</th>
                      <th className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {records.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                          No records found. Records will appear here when universities issue them to you.
                        </td>
                      </tr>
                    ) : (
                      records.map((record) => (
                        <tr key={record.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {record.id}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {record.universityName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <span className="px-2 py-1 rounded-md text-xs font-medium bg-teal-100 text-teal-800">
                              {record.type}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {record.dateIssued}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              className="text-blue-600 hover:text-blue-900 mr-4"
                              onClick={() => router.push(`/records/${record.id}`)}
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white shadow overflow-hidden rounded-lg">
              <div className="px-6 py-5 border-b border-gray-200">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Records Shared With Me</h3>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">University</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Issued</th>
                      <th className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sharedRecords.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                          No shared records found. Records will appear here when other students share them with you.
                        </td>
                      </tr>
                    ) : (
                      sharedRecords.map((record) => (
                        <tr key={record.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {record.id}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {record.studentName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {record.universityName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <span className="px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
                              {record.type}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {record.dateIssued}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              className="text-blue-600 hover:text-blue-900 mr-4"
                              onClick={() => router.push(`/records/${record.id}`)}
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}