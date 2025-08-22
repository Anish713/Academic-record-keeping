"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import MainLayout from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/Button";
import { blockchainService } from "@/services/blockchain";
import { getGatewayUrl } from "@/lib/pinata";
import { truncateAddress } from "@/lib/utils";
import { getRecordTypeName } from "@/types/records";
import { SecureRecord } from "@/types/zkTypes";
import { zkService } from "@/services/zkService";

/**
 * Displays detailed information about an academic record and provides sharing controls for the record owner.
 *
 * Fetches and renders record details based on the route parameter. If the connected user owns the record, enables sharing the record with other Ethereum addresses and revoking access. Handles blockchain initialization, loading states, and error messages.
 */
export default function RecordDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [record, setRecord] = useState<SecureRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [connectedAddress, setConnectedAddress] = useState("");

  // ZK verification states
  const [zkLoading, setZkLoading] = useState(false);
  const [zkError, setZkError] = useState("");
  const [documentAccess, setDocumentAccess] = useState<{
    hasAccess: boolean;
    documentUrl?: string;
  }>({ hasAccess: false });

  // Sharing functionality
  const [shareAddress, setShareAddress] = useState("");
  const [isSharing, setIsSharing] = useState(false);
  const [shareSuccess, setShareSuccess] = useState("");
  const [shareError, setShareError] = useState("");
  const [sharedWith, setSharedWith] = useState<string[]>([]);

  useEffect(() => {
    const init = async () => {
      try {
        const success = await blockchainService.init();
        if (!success) {
          router.push("/login");
          return;
        }

        const address = await blockchainService.getCurrentAddress();
        setConnectedAddress(address);
        setInitialized(true);
      } catch (err) {
        console.error("Error initializing blockchain service:", err);
        router.push("/login");
      }
    };

    init();
  }, [router]);

  useEffect(() => {
    const fetchRecord = async () => {
      if (!initialized || !params.id) return;

      setLoading(true);
      setError("");
      setZkError("");

      try {
        const recordIdParam = params.id as string;
        if (!recordIdParam) throw new Error("Record ID is missing");

        const parsedRecordId = parseInt(recordIdParam, 10);
        if (isNaN(parsedRecordId)) throw new Error("Invalid record ID");

        // Use ZK-enhanced record retrieval
        const secureRecord = await blockchainService.getRecordWithZKAccess(parsedRecordId);
        console.log("Fetched secure record data:", secureRecord);

        if (!secureRecord) {
          setError("Record not found");
          console.error("Record not found for recordId:", parsedRecordId);
          setLoading(false);
          return;
        }

        setRecord(secureRecord);

        // Set document access based on ZK verification
        setDocumentAccess({
          hasAccess: secureRecord.hasZKAccess,
          documentUrl: secureRecord.documentUrl
        });

        // Load shared addresses if user owns the record
        if (secureRecord.accessLevel === 'owner') {
          await loadSharedAddresses(parsedRecordId);
        }
      } catch (err) {
        console.error("Error fetching record:", err);
        setError("Failed to fetch record details. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchRecord();
  }, [initialized, params.id, connectedAddress]);

  const loadSharedAddresses = async (recordId: number) => {
    try {
      // TODO: Have a function to get all addresses this record is shared with
      // const sharedAddresses = await blockchainService.getSharedAddresses(recordId);
      // setSharedWith(sharedAddresses);

      setSharedWith([]);
    } catch (err) {
      console.error("Error loading shared addresses:", err);
    }
  };

  /**
   * Generate ZK proof and verify document access
   */
  const handleViewDocument = async () => {
    if (!record) return;

    setZkLoading(true);
    setZkError("");

    try {
      // Generate ZK proof and verify access
      const ipfsHash = await zkService.verifyDocumentAccess(record.id);
      
      if (ipfsHash) {
        const documentUrl = getGatewayUrl(ipfsHash);
        setDocumentAccess({
          hasAccess: true,
          documentUrl
        });
        
        // Open document in new tab
        window.open(documentUrl, '_blank', 'noopener,noreferrer');
      } else {
        setZkError("Access denied. You don't have permission to view this document.");
        setDocumentAccess({ hasAccess: false });
      }
    } catch (err: any) {
      console.error("ZK verification failed:", err);
      setZkError(
        err.message || "Failed to verify document access. Please try again."
      );
      setDocumentAccess({ hasAccess: false });
    } finally {
      setZkLoading(false);
    }
  };

  /**
   * Check if user can access the document
   */
  const canAccessDocument = (): boolean => {
    if (!record) return false;
    return record.hasZKAccess || record.accessLevel === 'owner';
  };

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareAddress || !record) return;

    setIsSharing(true);
    setShareSuccess("");
    setShareError("");

    try {
      if (!shareAddress.startsWith("0x") || shareAddress.length !== 42) {
        throw new Error("Invalid Ethereum address");
      }

      await blockchainService.shareRecord(record.id, shareAddress);

      setShareSuccess(
        `Record successfully shared with ${truncateAddress(shareAddress)}`
      );
      setShareAddress("");

      setSharedWith([...sharedWith, shareAddress]);
    } catch (err: any) {
      console.error("Error sharing record:", err);
      setShareError(err.message || "Failed to share record. Please try again.");
    } finally {
      setIsSharing(false);
    }
  };

  const handleUnshare = async (address: string) => {
    if (!record) return;

    setIsSharing(true);
    setShareSuccess("");
    setShareError("");

    try {
      await blockchainService.unshareRecord(record.id, address);

      setShareSuccess(`Record access revoked from ${truncateAddress(address)}`);

      setSharedWith(sharedWith.filter((a) => a !== address));
    } catch (err: any) {
      console.error("Error unsharing record:", err);
      setShareError(
        err.message || "Failed to revoke access. Please try again."
      );
    } finally {
      setIsSharing(false);
    }
  };

  const isOwnRecord = () => {
    if (!record || !connectedAddress) return false;
    return record.accessLevel === 'owner';
  };

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <button
            onClick={() => router.push("/records")}
            className="flex items-center text-navy-600 hover:text-navy-800"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-1"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                clipRule="evenodd"
              />
            </svg>
            Back to Records
          </button>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Record Details</h1>
          <p className="text-lg">View and manage your academic record</p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-navy-700 mb-4"></div>
            <p className="text-gray-600">Loading record details...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <svg
              className="h-12 w-12 text-red-500 mx-auto mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Error Loading Record
            </h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button variant="navy" onClick={() => router.push("/records")}>
              Return to Records
            </Button>
          </div>
        ) : record ? (
          <div className="bg-white shadow-md rounded-lg text-black overflow-hidden">
            {/* Record details section */}
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Record Information
              </h2>

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
                    <span
                      className={`px-2 py-1 rounded-md text-xs font-medium ${
                        getRecordTypeName(record.recordType) === "Transcript"
                          ? "bg-teal-100 text-teal-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {getRecordTypeName(record.recordType)}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Issue Date</p>
                  <p className="font-medium">{record.issueDate || new Date(record.timestamp * 1000).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Issuer</p>
                  <p className="font-medium">{truncateAddress(record.issuer || record.university)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Student Address</p>
                  <p className="font-medium">{record.studentAddress}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Document</p>
                  {canAccessDocument() ? (
                    <Button
                      variant="outline"
                      onClick={handleViewDocument}
                      disabled={zkLoading}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      {zkLoading ? (
                        <>
                          <div className="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-600 mr-2"></div>
                          Verifying Access...
                        </>
                      ) : (
                        "View Document"
                      )}
                    </Button>
                  ) : (
                    <p className="font-medium text-gray-500">
                      Access Restricted
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">
                    Verification Status
                  </p>
                  <p className="font-medium flex items-center">
                    {(record.verified ?? record.isValid) ? (
                      <>
                        <svg
                          className="h-5 w-5 text-green-500 mr-1"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        Verified
                      </>
                    ) : (
                      <>
                        <svg
                          className="h-5 w-5 text-red-500 mr-1"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        Not Verified
                      </>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* ZK Access Status and Error Messages */}
            {zkError && (
              <div className="p-6 border-t border-gray-200">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <svg
                      className="h-5 w-5 text-red-500 mr-2"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <div>
                      <h3 className="text-sm font-medium text-red-800">
                        Document Access Error
                      </h3>
                      <p className="text-sm text-red-700 mt-1">{zkError}</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <Button
                      variant="outline"
                      onClick={handleViewDocument}
                      disabled={zkLoading}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Try Again
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Access Level Information */}
            {record && (
              <div className="p-6 border-t border-gray-200">
                <h3 className="text-lg font-medium text-gray-900 mb-3">
                  Access Information
                </h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Your Access Level</p>
                      <p className="font-medium capitalize text-gray-900">
                        {record.accessLevel}
                      </p>
                    </div>
                    <div className="flex items-center">
                      {record.hasZKAccess ? (
                        <>
                          <svg
                            className="h-5 w-5 text-green-500 mr-2"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 12l2 2 4-4m5.5-2a11 11 0 11-18 0 11 11 0 0118 0z"
                            />
                          </svg>
                          <span className="text-sm text-green-700 font-medium">
                            ZK Access Verified
                          </span>
                        </>
                      ) : (
                        <>
                          <svg
                            className="h-5 w-5 text-red-500 mr-2"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          <span className="text-sm text-red-700 font-medium">
                            No ZK Access
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  {record.accessLevel !== 'owner' && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-xs text-gray-500">
                        {record.accessLevel === 'shared' 
                          ? 'This record has been shared with you by the owner.'
                          : record.accessLevel === 'university'
                          ? 'You have access as the issuing university.'
                          : record.accessLevel === 'admin'
                          ? 'You have administrative access to this record.'
                          : 'You do not have access to view this document.'
                        }
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Sharing section - only visible to the record owner */}
            {record && record.accessLevel === 'owner' && (
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Share Your Record
                </h2>
                <p className="text-gray-600 mb-6">
                  Share this record with other Ethereum addresses to grant them
                  access to view your record details.
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
                      variant="outline"
                      disabled={isSharing}
                    >
                      {isSharing ? "Sharing..." : "Share Record"}
                    </Button>
                  </div>
                </form>

                {shareSuccess && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                    <p className="text-green-800 flex items-center">
                      <svg
                        className="h-5 w-5 text-green-500 mr-2"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      {shareSuccess}
                    </p>
                  </div>
                )}

                {shareError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                    <p className="text-red-800 flex items-center">
                      <svg
                        className="h-5 w-5 text-red-500 mr-2"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      {shareError}
                    </p>
                  </div>
                )}

                {/* Shared with list */}
                <div className="mt-8">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    Shared With
                  </h3>

                  {sharedWith.length === 0 ? (
                    <p className="text-gray-500 italic">
                      This record hasn't been shared with anyone yet.
                    </p>
                  ) : (
                    <ul className="divide-y divide-gray-200 border border-gray-200 rounded-md">
                      {sharedWith.map((address, index) => (
                        <li
                          key={index}
                          className="flex items-center justify-between py-3 px-4"
                        >
                          <span className="text-gray-800">
                            {truncateAddress(address)}
                          </span>
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
