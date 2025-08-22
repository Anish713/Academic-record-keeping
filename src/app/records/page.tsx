"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import MainLayout from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/Button";
import { blockchainService } from "@/services/blockchain";
import { type RecordItem, getRecordTypeName } from "@/types/records";
import { type SharedRecordInfo, type SecureRecord } from "@/types/zkTypes";

/**
 * Enhanced record item interface for display
 */
interface EnhancedRecordItem extends RecordItem {
  hasZKAccess?: boolean;
  accessLevel?: 'owner' | 'shared' | 'university' | 'admin' | 'none';
  sharedBy?: string;
}

/**
 * Renders a table row displaying a student's record with actions to view or verify the record.
 * Enhanced with ZK access control - only shows "View Document" button if user has access.
 */
function RecordItem({ 
  id, 
  studentName, 
  type, 
  dateIssued, 
  hasZKAccess = false, 
  accessLevel = 'none',
  sharedBy 
}: EnhancedRecordItem) {
  const showViewButton = hasZKAccess || accessLevel === 'owner' || accessLevel === 'university' || accessLevel === 'admin';
  
  return (
    <tr
      className="border-b border-gray-200 hover:bg-gray-50 cursor-pointer"
      onClick={() => (window.location.href = `/records/${id}`)}
    >
      <td className="py-4 px-6 text-sm text-gray-900">
        {studentName}
        {sharedBy && (
          <div className="text-xs text-gray-500 mt-1">
            Shared by: {sharedBy.slice(0, 6)}...{sharedBy.slice(-4)}
          </div>
        )}
      </td>
      <td className="py-4 px-6 text-sm">
        <span
          className={`px-2 py-1 rounded-md text-xs font-medium ${
            type === "Transcript"
              ? "bg-teal-100 text-teal-800"
              : "bg-blue-100 text-blue-800"
          }`}
        >
          {type}
        </span>
        {accessLevel === 'shared' && (
          <div className="mt-1">
            <span className="px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-800">
              Shared
            </span>
          </div>
        )}
      </td>
      <td className="py-4 px-6 text-sm text-gray-500">{dateIssued}</td>
      <td className="py-4 px-6 text-sm text-right">
        {showViewButton && (
          <a
            href={`/records/${id}`}
            className="text-blue-600 hover:text-blue-900 mr-3"
            onClick={(e) => e.stopPropagation()}
          >
            <Button variant="outline" size="sm">
              View Document
            </Button>
          </a>
        )}
        <a
          href={`/verify?id=${id}`}
          className="text-blue-600 hover:text-blue-900 mr-3"
          onClick={(e) => e.stopPropagation()}
        >
          <Button variant="outline" size="sm">
            Verify
          </Button>
        </a>
      </td>
    </tr>
  );
}

/**
 * Displays a list of student records with ZK access control, including both owned and shared records.
 * Enhanced to show "Shared with Me" section and implement ZK access verification before showing document access buttons.
 *
 * @returns The rendered records page component.
 */
export default function RecordsPage() {
  const [ownedRecords, setOwnedRecords] = useState<EnhancedRecordItem[]>([]);
  const [sharedRecords, setSharedRecords] = useState<EnhancedRecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [connectedAddress, setConnectedAddress] = useState("");
  const [activeTab, setActiveTab] = useState<'owned' | 'shared'>('owned');
  const router = useRouter();

  useEffect(() => {
    const initWallet = async () => {
      try {
        const success = await blockchainService.init();
        if (!success) {
          router.push("/login");
          return;
        }

        const address = await blockchainService.getCurrentAddress();
        setConnectedAddress(address);

        const isUniversity = await blockchainService.hasRole(
          "UNIVERSITY_ROLE",
          address
        );
        if (isUniversity) {
          router.push("/dashboard");
          return;
        }
      } catch (err) {
        console.error("Error initializing wallet:", err);
        router.push("/login");
      }
    };

    initWallet();
  }, [router]);

  useEffect(() => {
    const fetchRecords = async () => {
      if (!connectedAddress) return;

      setLoading(true);
      setError("");

      try {
        // Fetch owned records with ZK access validation
        await fetchOwnedRecords();
        
        // Fetch shared records with ZK access validation
        await fetchSharedRecords();
      } catch (err) {
        console.error("Error fetching records:", err);
        setError("Failed to fetch records. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    const fetchOwnedRecords = async () => {
      try {
        const recordIds = await blockchainService.getStudentRecordsByAddress(
          connectedAddress
        );

        if (recordIds && recordIds.length > 0) {
          const recordPromises = recordIds.map(async (id: number) => {
            try {
              const secureRecord = await blockchainService.getRecordWithZKAccess(id);
              return {
                id: id.toString(),
                studentName: secureRecord.studentName,
                type: getRecordTypeName(secureRecord.recordType),
                dateIssued: new Date(
                  secureRecord.timestamp * 1000
                ).toLocaleDateString(),
                hasZKAccess: secureRecord.hasZKAccess,
                accessLevel: secureRecord.accessLevel,
              } as EnhancedRecordItem;
            } catch (err) {
              console.error(`Error fetching owned record ${id}:`, err);
              return null;
            }
          });

          const recordsData = await Promise.all(recordPromises);
          const validRecords = recordsData.filter(
            (record) => record !== null
          ) as EnhancedRecordItem[];
          setOwnedRecords(validRecords);
        } else {
          setOwnedRecords([]);
        }
      } catch (err) {
        console.error("Error fetching owned records:", err);
        setOwnedRecords([]);
      }
    };

    const fetchSharedRecords = async () => {
      try {
        const sharedRecordInfos = await blockchainService.getSharedRecordsWithAccess(connectedAddress);

        if (sharedRecordInfos && sharedRecordInfos.length > 0) {
          const sharedRecordItems = sharedRecordInfos.map((sharedInfo: SharedRecordInfo) => {
            const record = sharedInfo.record;
            return {
              id: sharedInfo.recordId.toString(),
              studentName: record.studentName,
              type: getRecordTypeName(record.recordType),
              dateIssued: new Date(
                record.timestamp * 1000
              ).toLocaleDateString(),
              hasZKAccess: record.hasZKAccess,
              accessLevel: record.accessLevel,
              sharedBy: sharedInfo.sharedBy,
            } as EnhancedRecordItem;
          });
          setSharedRecords(sharedRecordItems);
        } else {
          setSharedRecords([]);
        }
      } catch (err) {
        console.error("Error fetching shared records:", err);
        setSharedRecords([]);
      }
    };

    fetchRecords();
  }, [connectedAddress]);

  const currentRecords = activeTab === 'owned' ? ownedRecords : sharedRecords;
  const hasRecords = currentRecords.length > 0;

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Tab Navigation */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('owned')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'owned'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                My Records ({ownedRecords.length})
              </button>
              <button
                onClick={() => setActiveTab('shared')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'shared'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Shared with Me ({sharedRecords.length})
              </button>
            </nav>
          </div>
        </div>

        {/* Records Table */}
        <div className="bg-white shadow overflow-hidden rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">
              {activeTab === 'owned' ? 'My Records' : 'Records Shared with Me'}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {activeTab === 'owned' 
                ? 'Academic records that belong to you'
                : 'Academic records that have been shared with your wallet address'
              }
            </p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Student name
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Type
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Date Issued
                  </th>
                  <th scope="col" className="relative px-6 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-8 px-6 text-center text-gray-500"
                    >
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
                        Loading records...
                      </div>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-8 px-6 text-center text-red-500"
                    >
                      <div className="flex flex-col items-center">
                        <svg className="h-8 w-8 text-red-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {error}
                      </div>
                    </td>
                  </tr>
                ) : !hasRecords ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-8 px-6 text-center text-gray-500"
                    >
                      <div className="flex flex-col items-center">
                        <svg className="h-8 w-8 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        {activeTab === 'owned' 
                          ? 'No records found. Your academic records will appear here once they are issued.'
                          : 'No shared records found. Records shared with your wallet address will appear here.'
                        }
                      </div>
                    </td>
                  </tr>
                ) : (
                  currentRecords.map((record, index) => (
                    <RecordItem key={`${activeTab}-${record.id}-${index}`} {...record} />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ZK Access Status Indicator */}
        {!loading && hasRecords && (
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">
                  Zero Knowledge Access Control
                </h3>
                <div className="mt-2 text-sm text-blue-700">
                  <p>
                    {blockchainService.isZKEnabled() 
                      ? 'ZK access control is active. Only authorized users can view document contents.'
                      : 'ZK access control is not available. Using legacy access control.'
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
