"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import MainLayout from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/Button";
import { blockchainService } from "@/services/blockchain";
import { ethers } from "ethers";

/**
 * React page component for universities to add new academic records to the blockchain.
 *
 * Initializes by connecting to the blockchain wallet, verifying university role, and fetching university and record type information. Renders a form for entering student details, selecting a record type, and providing an IPFS hash for the document. Validates input and submits the record to the blockchain. Handles loading, error, and submission states, and redirects on success or access failure.
 *
 * @returns The rendered page for adding a new academic record.
 */
export default function AddRecordPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isUniversity, setIsUniversity] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [studentName, setStudentName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [studentAddress, setStudentAddress] = useState("");
  const [recordType, setRecordType] = useState("0");
  const [ipfsHash, setIpfsHash] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [universityName, setUniversityName] = useState("");
  const [recordTypes, setRecordTypes] = useState<
    { id: number; name: string }[]
  >([]);

  useEffect(() => {
    const initWallet = async () => {
      try {
        const success = await blockchainService.init();
        if (!success) return router.push("/login");

        const address = await blockchainService.getCurrentAddress();
        const hasRole = await blockchainService.hasRole(
          "UNIVERSITY_ROLE",
          address
        );
        if (!hasRole) return router.push("/records");

        const uniName = await blockchainService.getUniversityName(address);
        setUniversityName(uniName);
        setIsUniversity(true);
        console.log("IsUniversity: ", isUniversity);

        const types = [];
        for (let i = 0; i < 36; i++) {
          // Based on the RecordType enum in IAcademicRecords.sol
          types.push({
            id: i,
            name: getRecordTypeName(i),
          });
        }
        setRecordTypes(types);
      } catch (err: any) {
        console.error("Initialization error:", err);
        setError("Failed to connect wallet or fetch university info.");
      } finally {
        setLoading(false);
      }
    };

    initWallet();
  }, [router]);

  const getRecordTypeName = (typeId: number): string => {
    const types = [
      // Academic Records
      "Transcript",
      "Degree",
      "Marksheet",
      "Diploma",
      "Certificate",
      "Provisional Certificate",
      // Identity & Personal Verification
      "Birth Certificate",
      "Citizenship",
      "National ID",
      "Passport Copy",
      "Character Certificate",
      // Admission & Examination Documents
      "Entrance Results",
      "Admit Card",
      "Counseling Letter",
      "Seat Allotment Letter",
      "Migration Certificate",
      "Transfer Certificate",
      // Administrative & Financial Records
      "Bills",
      "Fee Receipt",
      "Scholarship Letter",
      "Loan Document",
      "Hostel Clearance",
      // Academic Schedules & Communications
      "Routine",
      "Notice",
      "Circular",
      "News",
      // Miscellaneous & Supporting Documents
      "Recommendation Letter",
      "Internship Certificate",
      "Experience Letter",
      "Bonafide Certificate",
      "No Objection Certificate",
      // Fallback
      "Other",
    ];
    return types[typeId] || "Unknown";
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFile(e.target.files[0]);
      setUploadError("");
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setUploadError("");

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setIpfsHash(data.ipfsHash);
      } else {
        setUploadError(data.message || "Upload failed");
      }
    } catch (err) {
      console.error("Upload error:", err);
      setUploadError("An error occurred during upload.");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !studentName.trim() ||
      !studentId.trim() ||
      !studentAddress.trim() ||
      !ipfsHash.trim()
    ) {
      setError("Please fill in all required fields.");
      return;
    }

    if (!ethers.isAddress(studentAddress.trim())) {
      setError("Invalid Ethereum address format for student.");
      return;
    }

    //// TODO: Validation for ipfsHash
    // if (!/^Qm[a-zA-Z0-9]{44}$/.test(ipfsHash.trim())) {
    //   setError('Invalid IPFS hash format. It should start with "Qm..."');
    //   return;
    // }

    try {
      setSubmitting(true);
      setError("");

      const metadataHash = ethers.keccak256(
        ethers.toUtf8Bytes(ipfsHash.trim())
      );

      await blockchainService.addRecord(
        studentId.trim(),
        studentName.trim(),
        studentAddress.trim(),
        universityName,
        ipfsHash.trim(),
        metadataHash,
        parseInt(recordType, 10)
      );

      router.push("/dashboard?success=true");
    } catch (err: any) {
      console.error("Add record failed:", err);
      setError("Failed to add record. Please try again or contact support.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-lg text-gray-600">Connecting to blockchain...</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-4xl text-black mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-teal-500 mb-4">
            Add New Academic Record
          </h1>
          <p className="text-lg text-white max-w-2xl mx-auto">
            You are submitting a record on behalf of:{" "}
            <strong>{universityName}</strong>
          </p>
        </div>

        <div className="bg-white shadow-md rounded-lg p-6 mb-10">
          {error && (
            <div
              className="bg-red-50 border-l-4 border-red-400 p-4 mb-6"
              role="alert"
            >
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="studentName"
                className="block text-sm font-medium text-black"
              >
                Student Name *
              </label>
              <input
                type="text"
                id="studentName"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                disabled={submitting}
                required
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-navy-500 focus:border-navy-500"
              />
            </div>

            <div>
              <label
                htmlFor="studentId"
                className="block text-sm font-medium text-black"
              >
                Student ID *
              </label>
              <input
                type="text"
                id="studentId"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                disabled={submitting}
                required
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-navy-500 focus:border-navy-500"
              />
            </div>

            <div>
              <label
                htmlFor="studentAddress"
                className="block text-sm font-medium text-black"
              >
                Student Ethereum Address *
              </label>
              <input
                type="text"
                id="studentAddress"
                value={studentAddress}
                onChange={(e) => setStudentAddress(e.target.value)}
                disabled={submitting}
                required
                placeholder="0x..."
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-navy-500 focus:border-navy-500"
              />
              <p className="mt-1 text-sm text-gray-500">
                The Ethereum address of the student who will own this record.
              </p>
            </div>

            <div>
              <label
                htmlFor="recordType"
                className="block text-sm font-medium text-gray-700"
              >
                Record Type *
              </label>
              <select
                id="recordType"
                value={recordType}
                onChange={(e) => setRecordType(e.target.value)}
                disabled={submitting}
                required
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 text-black px-3 focus:ring-navy-500 focus:border-navy-500"
              >
                {recordTypes.map((type) => (
                  <option key={type.id} value={type.id.toString()}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="file-upload"
                className="block text-sm font-medium text-gray-700"
              >
                Upload Document
              </label>
              <div className="mt-1 flex items-center">
                <input
                  id="file-upload"
                  name="file-upload"
                  type="file"
                  className="sr-only"
                  onChange={handleFileChange}
                  disabled={submitting || uploading}
                />
                <label
                  htmlFor="file-upload"
                  className={`cursor-pointer bg-white py-2 px-3 border border-gray-300 rounded-md shadow-sm text-sm leading-4 font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 ${
                    submitting || uploading
                      ? "opacity-50 cursor-not-allowed"
                      : ""
                  }`}
                >
                  <span>
                    {selectedFile ? selectedFile.name : "Select file"}
                  </span>
                </label>
                <Button
                  type="button"
                  onClick={handleFileUpload}
                  disabled={!selectedFile || uploading || submitting}
                  className="ml-3"
                  variant="outline"
                >
                  {uploading ? "Uploading..." : "Upload to IPFS"}
                </Button>
              </div>
              {uploadError && (
                <p className="mt-2 text-sm text-red-600">{uploadError}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="ipfsHash"
                className="block text-sm font-medium text-gray-700"
              >
                IPFS Hash (Document) *
              </label>
              <input
                type="text"
                id="ipfsHash"
                value={ipfsHash}
                readOnly
                required
                placeholder="Upload a file to generate the hash"
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 bg-gray-100 focus:ring-navy-500 focus:border-navy-500"
              />
            </div>

            <div className="flex justify-end space-x-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/dashboard")}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" variant="outline" disabled={submitting}>
                {submitting ? "Submitting..." : "Add Record"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </MainLayout>
  );
}
