"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import MainLayout from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/Button";
import { truncateAddress } from "@/lib/utils";
import { blockchainService } from "@/services/blockchain";
import { RecordItem, getRecordTypeName } from "@/types/records";
import ZKDebugPanel from "@/components/debug/ZKDebugPanel";

/**
 * Displays the university dashboard for authenticated university users, showing summary statistics and a table of recent academic records.
 *
 * Redirects to the login page if the user is not authenticated or lacks the required university role. Fetches and displays the university name, total records, transcripts, certificates, and a list of recent records with options to view or add new records. Handles loading and error states during data retrieval.
 */
export default function DashboardPage() {
  const [connectedAddress, setConnectedAddress] = useState("");
  const [universityName, setUniversityName] = useState("Your University");
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [zkStats, setZkStats] = useState({
    totalRecords: 0,
    zkProtectedRecords: 0,
    legacyRecords: 0,
    successfulAccess: 0,
    failedAccess: 0
  });
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
        if (!isUniversity) {
          router.push("/records");
          return;
        }

        // Try to fetch first record for university name
        const recordIds = await blockchainService.getUniversityRecords();
        if (recordIds.length > 0) {
          const record = await blockchainService.getRecord(recordIds[0]);
          if (record?.universityName) {
            setUniversityName(record.universityName);
          }
        }
      } catch (err) {
        console.error("Error initializing wallet:", err);
        router.push("/login");
      }
    };

    initWallet();
  }, []);

  useEffect(() => {
    const fetchRecords = async () => {
      if (!connectedAddress) return;

      setLoading(true);
      setError("");

      try {
        // Use ZK-enhanced university records method
        const secureRecords = await blockchainService.getUniversityRecordsWithZKAccess();

        const recordsData = secureRecords.map((record) => {
          console.log(`Record ${record.id}: hasZKAccess=${record.hasZKAccess}, accessLevel=${record.accessLevel}`);
          return {
            id: record.id.toString(),
            studentName: record.studentName,
            type: getRecordTypeName(record.recordType),
            dateIssued: new Date(record.timestamp * 1000).toLocaleDateString(),
            hasZKAccess: record.hasZKAccess,
            accessLevel: record.accessLevel,
            documentUrl: record.documentUrl,
            verified: record.verified || false,
            issuer: record.issuer || universityName
          };
        });

        setRecords(recordsData);

        // Calculate ZK statistics
        const zkProtectedCount = recordsData.filter(r => r.hasZKAccess).length;
        const legacyCount = recordsData.filter(r => !r.hasZKAccess).length;
        
        console.log(`ZK Statistics: Total=${recordsData.length}, ZK Protected=${zkProtectedCount}, Legacy=${legacyCount}`);
        console.log('ZK Service Status:', blockchainService.getZKStatus());
        
        setZkStats({
          totalRecords: recordsData.length,
          zkProtectedRecords: zkProtectedCount,
          legacyRecords: legacyCount,
          successfulAccess: recordsData.filter(r => r.documentUrl).length,
          failedAccess: recordsData.filter(r => r.hasZKAccess && !r.documentUrl).length
        });
      } catch (err) {
        console.error("Error fetching records:", err);
        setError("Failed to fetch records. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchRecords();
  }, [connectedAddress, universityName]);

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
                <Button
                  variant="outline"
                  onClick={() => router.push("/records/add")}
                >
                  Add New Record
                </Button>
              </div>
            </div>
          </div>

          <div className="px-6 py-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
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

            <div className="bg-green-50 overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <dt className="text-sm font-medium text-green-600 truncate">
                  ZK Protected
                </dt>
                <dd className="mt-1 text-3xl font-semibold text-green-900">
                  {zkStats.zkProtectedRecords}
                </dd>
              </div>
            </div>

            <div className="bg-blue-50 overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <dt className="text-sm font-medium text-blue-600 truncate">
                  Transcripts
                </dt>
                <dd className="mt-1 text-3xl font-semibold text-blue-900">
                  {records.filter((r) => r.type === "Transcript").length}
                </dd>
              </div>
            </div>

            <div className="bg-purple-50 overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <dt className="text-sm font-medium text-purple-600 truncate">
                  Certificates
                </dt>
                <dd className="mt-1 text-3xl font-semibold text-purple-900">
                  {records.filter((r) => r.type === "Certificate").length}
                </dd>
              </div>
            </div>
          </div>
        </div>

        {/* ZK Access Control Status */}
        <div className="bg-white shadow rounded-lg mb-8">
          <div className="px-6 py-5 border-b border-gray-200">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              ZK Access Control Status
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Monitor your records' zero-knowledge proof protection status
            </p>
          </div>
          <div className="px-6 py-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{zkStats.zkProtectedRecords}</div>
                <div className="text-sm text-gray-500">ZK Protected Records</div>
                <div className="mt-2">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-600 h-2 rounded-full" 
                      style={{ width: `${zkStats.totalRecords > 0 ? (zkStats.zkProtectedRecords / zkStats.totalRecords) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{zkStats.legacyRecords}</div>
                <div className="text-sm text-gray-500">Legacy Access Records</div>
                <div className="mt-2">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-yellow-600 h-2 rounded-full" 
                      style={{ width: `${zkStats.totalRecords > 0 ? (zkStats.legacyRecords / zkStats.totalRecords) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{zkStats.successfulAccess}</div>
                <div className="text-sm text-gray-500">Accessible Documents</div>
                <div className="mt-2">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{ width: `${zkStats.totalRecords > 0 ? (zkStats.successfulAccess / zkStats.totalRecords) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
            
            {zkStats.legacyRecords > 0 && (
              <div className="mt-6 bg-yellow-50 border-l-4 border-yellow-400 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-yellow-700">
                      You have {zkStats.legacyRecords} records using legacy access. Consider upgrading them to ZK protection for enhanced security.
                    </p>
                  </div>
                </div>
              </div>
            )}
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Student Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date Issued
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Access Status
                  </th>
                  <th className="relative px-6 py-3">
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
                      <span className="px-2 py-1 rounded-md text-xs font-medium bg-teal-100 text-teal-800">
                        {record.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {record.dateIssued}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 rounded-md text-xs font-medium flex items-center ${
                          record.hasZKAccess 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {record.hasZKAccess ? (
                            <>
                              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                              </svg>
                              ZK Secured
                            </>
                          ) : (
                            <>
                              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zM8 9V5.5a2 2 0 114 0V9H8z" clipRule="evenodd" />
                              </svg>
                              Legacy Access
                            </>
                          )}
                        </span>
                        <span className="px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
                          University Access
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        className="text-blue-600 hover:text-blue-900 mr-4"
                        onClick={() => router.push(`/records/${record.id}`)}
                      >
                        View
                      </button>
                      {record.documentUrl && (
                        <button
                          className="text-green-600 hover:text-green-900 mr-4"
                          onClick={() => window.open(record.documentUrl, '_blank')}
                        >
                          Document
                        </button>
                      )}
                      <button className="text-red-600 hover:text-red-900">
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {error && <div className="p-4 text-sm text-red-600">{error}</div>}
          </div>
        </div>
      </div>
      <ZKDebugPanel />
    </MainLayout>
  );
}
