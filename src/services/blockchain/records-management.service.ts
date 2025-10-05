import { BaseContractService } from "./base-contract.service";
import AcademicRecords from "../../contracts/AcademicRecords.json";
import { Record, CustomRecordType } from "../../types/records";
import { ethers } from "ethers";

/**
 * Record sharing information interface
 */
export interface RecordShare {
  recordId: number;
  sharedWith: string;
  sharedBy: string;
  sharedAt: number;
}

/**
 * Record access information interface
 */
export interface RecordAccess {
  recordId: number;
  accessedBy: string;
  accessedAt: number;
}

/**
 * Records Management Service
 * Handles academic record creation, retrieval, sharing, and access control
 */
export class RecordsManagementService extends BaseContractService {
  constructor(contractAddress: string) {
    super(contractAddress, AcademicRecords.abi);
  }

  /**
   * Add a new academic record
   * @param studentId - student identifier
   * @param studentName - student name
   * @param studentAddress - student wallet address
   * @param universityName - issuing university name
   * @param ipfsHash - IPFS hash of the document (will be encrypted with ZKP)
   * @param metadataHash - IPFS hash of metadata
   * @param recordType - type of record (see RecordType enum)
   * @returns Promise<number> - record ID
   */
  async addRecord(
    studentId: string,
    studentName: string,
    studentAddress: string,
    universityName: string,
    ipfsHash: string,
    metadataHash: string,
    recordType: number
  ): Promise<number> {
    const receipt = await this.executeTransaction(
      "addRecord",
      studentId,
      studentName,
      studentAddress,
      universityName,
      ipfsHash,
      metadataHash,
      recordType
    );

    const event = this.getEvent(receipt, "RecordAdded");
    if (!event) {
      throw new Error("RecordAdded event not found");
    }

    return Number(event.args.recordId);
  }

  /**
   * Get a record by ID
   * @param recordId - record identifier
   * @returns Promise<Record>
   */
  async getRecord(recordId: number): Promise<Record> {
    const record = await this.executeCall("getRecord", recordId);

    return {
      id: recordId,
      studentName: record.studentName,
      studentId: record.studentId,
      studentAddress: record.studentAddress,
      universityName: record.universityName,
      recordType: Number(record.recordType),
      ipfsHash: record.ipfsHash,
      timestamp: Number(record.timestamp),
      university: record.issuer,
      isValid: record.isVerified,
    };
  }

  /**
   * Get records by student ID
   * @param studentId - student identifier
   * @returns Promise<number[]> - array of record IDs
   */
  async getStudentRecords(studentId: string): Promise<number[]> {
    // Check if studentId is an address
    if (ethers.isAddress(studentId)) {
      return this.getStudentRecordsByAddress(studentId);
    }

    const recordIds = await this.executeCall("getStudentRecords", studentId);
    return recordIds.map((id: bigint) => Number(id));
  }

  /**
   * Get records by student address
   * @param address - student wallet address
   * @returns Promise<number[]> - array of record IDs
   */
  async getStudentRecordsByAddress(address: string): Promise<number[]> {
    const recordIds = await this.executeCall(
      "getStudentRecordsByAddress",
      address
    );
    return recordIds.map((id: bigint) => Number(id));
  }

  /**
   * Get records issued by a university
   * @param universityAddress - university address (optional, defaults to current user)
   * @returns Promise<number[]> - array of record IDs
   */
  async getUniversityRecords(universityAddress?: string): Promise<number[]> {
    const address = universityAddress || (await this.getCurrentAddress());
    const recordIds = await this.executeCall("getUniversityRecords", address);
    return recordIds.map((id: bigint) => Number(id));
  }

  /**
   * Share a record with another address
   * @param recordId - record identifier
   * @param sharedWithAddress - address to share with
   * @returns Promise<void>
   */
  async shareRecord(
    recordId: number,
    sharedWithAddress: string
  ): Promise<void> {
    await this.executeTransaction("shareRecord", recordId, sharedWithAddress);
  }

  /**
   * Unshare a record (revoke access)
   * @param recordId - record identifier
   * @param sharedWithAddress - address to revoke access from
   * @returns Promise<void>
   */
  async unshareRecord(
    recordId: number,
    sharedWithAddress: string
  ): Promise<void> {
    await this.executeTransaction("unshareRecord", recordId, sharedWithAddress);
  }

  /**
   * Get records shared with an address
   * @param sharedWithAddress - address to check
   * @returns Promise<number[]> - array of record IDs
   */
  async getSharedRecords(sharedWithAddress: string): Promise<number[]> {
    const recordIds = await this.executeCall(
      "getSharedRecords",
      sharedWithAddress
    );
    return recordIds.map((id: bigint) => Number(id));
  }

  /**
   * Check if a record is shared with a specific address
   * @param recordId - record identifier
   * @param userAddress - address to check
   * @returns Promise<boolean>
   */
  async isRecordSharedWith(
    recordId: number,
    userAddress: string
  ): Promise<boolean> {
    return await this.executeCall("isRecordSharedWith", recordId, userAddress);
  }

  /**
   * Record access to a document (for analytics)
   * @param recordId - record identifier
   * @returns Promise<void>
   */
  async recordAccess(recordId: number): Promise<void> {
    await this.executeTransaction("recordAccess", recordId);
  }

  /**
   * Verify a record's authenticity
   * @param recordId - record identifier
   * @returns Promise<boolean>
   */
  async verifyRecord(recordId: number): Promise<boolean> {
    return await this.executeCall("verifyRecord", recordId);
  }

  /**
   * Get total number of records in the system
   * @returns Promise<number>
   */
  async getTotalRecords(): Promise<number> {
    const total: bigint = await this.executeCall("getTotalRecords");
    return Number(total);
  }

  /**
   * Add a custom record type
   * @param name - record type name
   * @param description - record type description
   * @returns Promise<number> - custom type ID
   */
  async addCustomRecordType(
    name: string,
    description: string
  ): Promise<number> {
    const receipt = await this.executeTransaction(
      "addCustomRecordType",
      name,
      description
    );

    const event = this.getEvent(receipt, "CustomRecordTypeCreated");
    if (!event) {
      throw new Error("CustomRecordTypeCreated event not found");
    }

    return Number(event.args.typeId);
  }

  /**
   * Get total number of custom record types
   * @returns Promise<number>
   */
  async getTotalCustomTypes(): Promise<number> {
    const total: bigint = await this.executeCall("getTotalCustomTypes");
    return Number(total);
  }

  /**
   * Check if current user can access a record
   * @param recordId - record identifier
   * @returns Promise<boolean>
   */
  async canCurrentUserAccessRecord(recordId: number): Promise<boolean> {
    const currentAddress = await this.getCurrentAddress();
    const record = await this.getRecord(recordId);

    // Student can access their own records
    if (record.studentAddress.toLowerCase() === currentAddress.toLowerCase()) {
      return true;
    }

    // University can access records they issued
    if (record.university.toLowerCase() === currentAddress.toLowerCase()) {
      return true;
    }

    // Check if record is shared with current user
    return await this.isRecordSharedWith(recordId, currentAddress);
  }

  /**
   * Get current user's accessible records
   * @returns Promise<number[]>
   */
  async getCurrentUserAccessibleRecords(): Promise<number[]> {
    const currentAddress = await this.getCurrentAddress();

    // Get records owned by user
    const ownedRecords = await this.getStudentRecordsByAddress(currentAddress);

    // Get records shared with user
    const sharedRecords = await this.getSharedRecords(currentAddress);

    // Get records issued by user (if they're a university)
    let issuedRecords: number[] = [];
    try {
      issuedRecords = await this.getUniversityRecords(currentAddress);
    } catch {
      // User is not a university, which is fine
    }

    // Combine and deduplicate
    const allRecords = [...ownedRecords, ...sharedRecords, ...issuedRecords];
    return [...new Set(allRecords)];
  }

  /**
   * Bulk get records by IDs
   * @param recordIds - array of record IDs
   * @returns Promise<Record[]>
   */
  async getRecordsBatch(recordIds: number[]): Promise<Record[]> {
    const records = await Promise.all(
      recordIds.map(async (id) => {
        try {
          return await this.getRecord(id);
        } catch (error) {
          console.error(`Failed to fetch record ${id}:`, error);
          return null;
        }
      })
    );

    return records.filter((record): record is Record => record !== null);
  }

  /**
   * Search records by student name or ID
   * @param searchTerm - search term
   * @param recordIds - optional array of record IDs to search within
   * @returns Promise<Record[]>
   */
  async searchRecords(
    searchTerm: string,
    recordIds?: number[]
  ): Promise<Record[]> {
    const idsToSearch =
      recordIds || (await this.getCurrentUserAccessibleRecords());
    const records = await this.getRecordsBatch(idsToSearch);

    if (!searchTerm.trim()) {
      return records;
    }

    const term = searchTerm.toLowerCase();
    return records.filter(
      (record) =>
        record.studentName.toLowerCase().includes(term) ||
        record.studentId.toLowerCase().includes(term) ||
        record.universityName.toLowerCase().includes(term)
    );
  }

  /**
   * Get records by type
   * @param recordType - record type to filter by
   * @param recordIds - optional array of record IDs to search within
   * @returns Promise<Record[]>
   */
  async getRecordsByType(
    recordType: number,
    recordIds?: number[]
  ): Promise<Record[]> {
    const idsToSearch =
      recordIds || (await this.getCurrentUserAccessibleRecords());
    const records = await this.getRecordsBatch(idsToSearch);

    return records.filter((record) => record.recordType === recordType);
  }

  /**
   * Helper method to get current address from wallet service
   * @returns Promise<string>
   */
  private async getCurrentAddress(): Promise<string> {
    const walletService = await import("./wallet.service");
    return await walletService.walletService.getCurrentAddress();
  }
}

// Export singleton instance
export const recordsManagementService = new RecordsManagementService(
  process.env.NEXT_PUBLIC_ACADEMIC_RECORDS_CONTRACT_ADDRESS || ""
);
