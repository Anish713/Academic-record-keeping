'use client';

import { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/Button';
import { truncateAddress } from '@/lib/utils';
import { blockchainService } from '@/services/blockchain';

export default function DashboardPage() {
  const [connectedAddress, setConnectedAddress] = useState('');
  const [universityName, setUniversityName] = useState('Example University');
  const [universityNames, setUniversityNames] = useState<string[]>([]);
  
  useEffect(() => {
    const fetchUniversityNames = async () => {
      try {
        // Get the connected address
        const address = await blockchainService.getAddress();
        
        // Get university record IDs
        const recordIds = await blockchainService.getUniversityRecords();
        
        // If there are record IDs, fetch the first record to get university name
        if (recordIds.length > 0) {
          const firstRecord = await blockchainService.getRecord(recordIds[0]);
          if (firstRecord && firstRecord.universityName) {
            setUniversityNames([firstRecord.universityName]);
            return;
          }
        }
        
        // Fallback: Try to get university name from local storage mapping
        const universityName = await blockchainService.getUniversityName(address);
        if (universityName) {
          setUniversityNames([universityName]);
        } else {
          setUniversityNames(['Your University']);
        }
      } catch (error) {
        console.error('Error fetching university names:', error);
        setUniversityNames(['Your University']);
      }
    };
    
    fetchUniversityNames();
  }, []);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
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
        
        // Check if the user has university role
        const isUniversity = await blockchainService.hasRole('UNIVERSITY_ROLE', address);
        if (!isUniversity) {
          window.location.href = '/records';
          return;
        }
        
        // In a real app, this would come from a database or user profile // TODO 1: fetch university name from blockchain or database
        setUniversityName('Example University');
      } catch (err) {
        console.error('Error initializing wallet:', err);
        window.location.href = '/login';
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
        // Get record IDs issued by the university
        const recordIds = await blockchainService.getUniversityRecords();
        
        // Fetch details for each record
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
        <div className="bg-white shadow rounded-lg mb-8">
          <div className="px-6 py-5 border-b border-gray-200">
            <div className="flex items-center justify-between flex-wrap sm:flex-nowrap">
              <div>
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  University Dashboard
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {universityName} ({truncateAddress(connectedAddress)})
                </p>
              </div>
              <div>
                <Button variant="navy">
                  Add New Record
                </Button>
              </div>
            </div>
          </div>
          
          <div className="px-6 py-5 grid grid-cols-1 gap-5 sm:grid-cols-3">
            <div className="bg-gray-50 overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Total Records
                </dt>
                <dd className="mt-1 text-3xl font-semibold text-gray-900">
                  {records.length}
                </dd>
              </div>
            </div>
            
            <div className="bg-gray-50 overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Transcripts
                </dt>
                <dd className="mt-1 text-3xl font-semibold text-gray-900">
                  {records.filter(r => r.type === 'Transcript').length}
                </dd>
              </div>
            </div>
            
            <div className="bg-gray-50 overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Certificates
                </dt>
                <dd className="mt-1 text-3xl font-semibold text-gray-900">
                  {records.filter(r => r.type === 'Certificate').length}
                </dd>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white shadow overflow-hidden rounded-lg">
          <div className="px-6 py-5 border-b border-gray-200">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Recent Records
            </h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ID
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Student Name
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date Issued
                  </th>
                  <th scope="col" className="relative px-6 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {records.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {record.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {record.studentName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className={`px-2 py-1 rounded-md text-xs font-medium ${record.type === 'Transcript' ? 'bg-teal-100 text-teal-800' : 'bg-teal-100 text-teal-800'}`}>
                        {record.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {record.dateIssued}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <a href={`/records/${record.id}`} className="text-blue-600 hover:text-blue-900 mr-4">View</a>
                      <button className="text-red-600 hover:text-red-900">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}