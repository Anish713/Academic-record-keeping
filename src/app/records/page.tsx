"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import MainLayout from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/Button";
import { blockchainService } from "@/services/blockchain";
import { type RecordItem, getRecordTypeName } from "@/types/records";

/**
 * Renders a table row displaying a student's record with actions to view or verify the record.
 *
 * The row is clickable and navigates to the record's detail page. Inline action links allow viewing or verifying the record without triggering row navigation.
 */
function RecordItem({ id, studentName, type, dateIssued }: RecordItem) {
  return (
    <tr
      className="border-b border-gray-200 hover:bg-gray-50 cursor-pointer"
      onClick={() => (window.location.href = `/records/${id}`)}
    >
      <td className="py-4 px-6 text-sm text-gray-900">{studentName}</td>
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
      </td>
      <td className="py-4 px-6 text-sm text-gray-500">{dateIssued}</td>
      <td className="py-4 px-6 text-sm text-right">
        <a
          href={`/records/${id}`}
          className="text-blue-600 hover:text-blue-900 mr-3"
          onClick={(e) => e.stopPropagation()}
        >
          <Button variant="outline" size="sm">
            View
          </Button>
        </a>
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
 * Displays a list of student records fetched from a blockchain service, handling wallet connection, loading, and error states.
 *
 * Redirects to the login page if the blockchain wallet is not connected. Once connected, retrieves and displays the student's records in a table format, with options to create a new record and view or verify existing records.
 *
 * @returns The rendered records page component.
 */
export default function RecordsPage() {
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [connectedAddress, setConnectedAddress] = useState("");
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
        const recordIds = await blockchainService.getStudentRecordsByAddress(
          connectedAddress
        );

        if (recordIds && recordIds.length > 0) {
          const recordPromises = recordIds.map(async (id: number) => {
            try {
              const record = await blockchainService.getRecord(id);
              return {
                id: id.toString(),
                studentName: record.studentName,
                type: getRecordTypeName(record.recordType),
                dateIssued: new Date(
                  record.timestamp * 1000
                ).toLocaleDateString(),
              };
            } catch (err) {
              console.error(`Error fetching record ${id}:`, err);
              return null;
            }
          });

          const recordsData = await Promise.all(recordPromises);
          const validRecords = recordsData.filter(
            (record) => record !== null
          ) as RecordItem[];
          setRecords(validRecords);
        } else {
          setRecords([]);
        }
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
        <div className="bg-white shadow overflow-hidden rounded-lg">
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
                    <span className="sr-only">Edit</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-4 px-6 text-center text-gray-500"
                    >
                      Loading records...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-4 px-6 text-center text-red-500"
                    >
                      {error}
                    </td>
                  </tr>
                ) : records.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-4 px-6 text-center text-gray-500"
                    >
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
