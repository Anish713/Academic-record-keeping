"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import MainLayout from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/Button";
import { truncateAddress } from "@/lib/utils";
import { blockchainService } from "@/services/blockchain";
import { RecordItem, getRecordTypeName } from "@/types/records";

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
        const recordIds = await blockchainService.getUniversityRecords();

        const recordsData = await Promise.all(
          recordIds.map(async (id: number) => {
            const record = await blockchainService.getRecord(id);
            return {
              id: id.toString(),
              studentName: record.studentName,
              type: getRecordTypeName(record.recordType),
              dateIssued: new Date(
                record.timestamp * 1000
              ).toLocaleDateString(),
            };
          })
        );

        setRecords(recordsData);
      } catch (err) {
        console.error("Error fetching records:", err);
        setError("Failed to fetch records. Please try again.");
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
                <Button
                  variant="outline"
                  onClick={() => router.push("/records/add")}
                >
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
                  {records.filter((r) => r.type === "Transcript").length}
                </dd>
              </div>
            </div>

            <div className="bg-gray-50 overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Certificates
                </dt>
                <dd className="mt-1 text-3xl font-semibold text-gray-900">
                  {records.filter((r) => r.type === "Certificate").length}
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
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        className="text-blue-600 hover:text-blue-900 mr-4"
                        onClick={() => router.push(`/records/${record.id}`)}
                      >
                        View
                      </button>
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
    </MainLayout>
  );
}
