'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/Button';
import { blockchainService } from '@/services/blockchain';

interface RecordItemProps {
  id: string;
  studentName: string;
  type: string;
  dateIssued: string;
}

function RecordItem({ id, studentName, type, dateIssued }: RecordItemProps) {
  return (
    <tr className="border-b border-gray-200 hover:bg-gray-50 cursor-pointer" onClick={() => window.location.href = `/records/${id}`}>
      <td className="py-4 px-6 text-sm text-gray-900">{studentName}</td>
      <td className="py-4 px-6 text-sm">
        <span className={`px-2 py-1 rounded-md text-xs font-medium ${type === 'Transcript' ? 'bg-teal-100 text-teal-800' : 'bg-blue-100 text-blue-800'}`}>
          {type}
        </span>
      </td>
      <td className="py-4 px-6 text-sm text-gray-500">{dateIssued}</td>
      <td className="py-4 px-6 text-sm text-right">
        <a 
          href={`/records/${id}`} 
          className="text-navy-600 hover:text-navy-900 mr-3"
          onClick={(e) => e.stopPropagation()}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </a>
        <a 
          href={`/verify?id=${id}`} 
          className="text-blue-600 hover:text-blue-900 mr-3"
          onClick={(e) => e.stopPropagation()}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        </a>
      </td>
    </tr>
  );
}

export default function RecordsPage() {
  const [records, setRecords] = useState<RecordItemProps[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [connectedAddress, setConnectedAddress] = useState('');
  const router = useRouter();

  useEffect(() => {
    const initWallet = async () => {
      try {
        // Initialize blockchain service
        const success = await blockchainService.init();
        if (!success) {
          router.push('/login');
          return;
        }

        const address = await blockchainService.getCurrentAddress();
        setConnectedAddress(address);

        const isUniversity = await blockchainService.hasRole('UNIVERSITY_ROLE', address);
        // if (isUniversity) {
        //   router.push('/dashboard');
        //   return;
        // }
      } catch (err) {
        console.error('Error initializing wallet:', err);
        router.push('/login');
      }
    };

    initWallet();
  }, []);

  useEffect(() => {
    const fetchRecords = async () => {
      if (!connectedAddress) return;

      setLoading(true);
      setError('');

      try {
        const studentId = connectedAddress;

        const recordIds = await blockchainService.getStudentRecords(studentId);

        const recordsData = await Promise.all(
          recordIds.map(async (id: number) => {
            const record = await blockchainService.getRecord(id);
            return {
              id: id.toString(),
              studentName: record.studentName,
              type: record.recordType === 0 ? 'Transcript' : 
                    record.recordType === 1 ? 'Certificate' : 
                    record.recordType === 2 ? 'Degree' : 'Other',
              dateIssued: new Date(record.timestamp * 1000).toLocaleDateString()
            };
          })
        );

        setRecords(recordsData);
      } catch (err) {
        console.error('Error fetching records:', err);
        setError('Failed to fetch records. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchRecords();
  }, [connectedAddress]);

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Records</h1>
          <Button variant="navy" onClick={() => router.push('/records/new')}>
            New Record  
          </Button>
        </div>

        <div className="bg-white shadow overflow-hidden rounded-lg">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Student name
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date Issued
                  </th>
                  <th scope="col" className="relative px-6 py-3">
                    <span className="sr-only">Edit</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="py-4 px-6 text-center text-gray-500">
                      Loading records...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={4} className="py-4 px-6 text-center text-red-500">
                      {error}
                    </td>
                  </tr>
                ) : records.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-4 px-6 text-center text-gray-500">
                      No records found.
                    </td>
                  </tr>
                ) : (
                  records.map((record, index) => (
                    <RecordItem key={index} {...record} />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}