import { ethers } from "ethers";
import AcademicRecords from "../contracts/AcademicRecords.json";
import IAcademicRecords from "../contracts/IAcademicRecords.json";
import RoleManager from "../contracts/RoleManager.json";
import StudentManagement from "../contracts/StudentManagement.json";
import { Record, CustomRecordType } from "../types/records";
import { SecureRecord, SharedRecordInfo, ZKAccessResult } from "../types/zkTypes";
import { zkService } from "./zkService";
import { getGatewayUrl } from "../lib/pinata";

export interface University {
  address: string;
  name: string;
}

class BlockchainService {
  private provider: ethers.BrowserProvider | null = null;
  private signer: ethers.Signer | null = null;
  private contract: ethers.Contract | null = null;
  private studentManagementContract: ethers.Contract | null = null;
  private contractAddress: string =
    process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "";
  private studentManagementAddress: string =
    process.env.NEXT_PUBLIC_STUDENT_MANAGEMENT_CONTRACT_ADDRESS || "";
  private zkInitialized: boolean = false;

  private ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_ROLE"));
  private UNIVERSITY_ROLE = ethers.keccak256(
    ethers.toUtf8Bytes("UNIVERSITY_ROLE")
  );
  private SUPER_ADMIN_ROLE = ethers.keccak256(
    ethers.toUtf8Bytes("SUPER_ADMIN_ROLE")
  );

  async init(): Promise<boolean> {
    try {
      if (typeof window === "undefined" || !window.ethereum) {
        console.error("MetaMask is not installed");
        return false;
      }

      this.provider = new ethers.BrowserProvider(window.ethereum);
      await this.provider.send("eth_requestAccounts", []);
      this.signer = await this.provider.getSigner();

      if (!this.contractAddress) {
        console.error("Contract address not configured");
        return false;
      }

      this.contract = new ethers.Contract(
        this.contractAddress,
        AcademicRecords.abi,
        this.signer
      );

      this.studentManagementContract = new ethers.Contract(
        this.studentManagementAddress,
        StudentManagement.abi,
        this.signer
      );

      // Initialize ZK service
      await this.initZKService();

      return true;
    } catch (error) {
      console.error("Blockchain initialization failed:", error);
      return false;
    }
  }

  /**
   * Initialize ZK service for secure document access
   */
  private async initZKService(): Promise<void> {
    try {
      await zkService.init();
      this.zkInitialized = true;
      console.log("ZK service initialized successfully");
    } catch (error) {
      console.warn("ZK service initialization failed, falling back to legacy access:", error);
      this.zkInitialized = false;
    }
  }

  private ensureContract() {
    if (!this.contract) throw new Error("Contract not initialized");
  }

  async getCurrentAddress(): Promise<string> {
    if (!this.signer) throw new Error("Signer not available");
    return await this.signer.getAddress();
  }

  async hasRole(
    role: "ADMIN_ROLE" | "UNIVERSITY_ROLE" | "SUPER_ADMIN_ROLE",
    address: string
  ): Promise<boolean> {
    this.ensureContract();
    let roleHash;

    if (role === "ADMIN_ROLE") {
      roleHash = this.ADMIN_ROLE;
    } else if (role === "UNIVERSITY_ROLE") {
      roleHash = this.UNIVERSITY_ROLE;
    } else if (role === "SUPER_ADMIN_ROLE") {
      roleHash = this.SUPER_ADMIN_ROLE;
    } else {
      throw new Error("Invalid role");
    }

    return await this.contract!.hasRole(roleHash, address);
  }

  // University management
  async addUniversity(address: string, name: string): Promise<void> {
    this.ensureContract();
    const tx = await this.contract!.addUniversity(address, name);
    await tx.wait();
  }

  async setUniversityName(address: string, name: string): Promise<void> {
    this.ensureContract();
    const tx = await this.contract!.setUniversityName(address, name);
    await tx.wait();
  }

  async getUniversityName(address: string): Promise<string> {
    this.ensureContract();
    return await this.contract!.getUniversityName(address);
  }

  async getAllUniversities(): Promise<University[]> {
    this.ensureContract();
    const addresses: string[] = await this.contract!.getAllUniversities();

    const universities: University[] = await Promise.all(
      addresses.map(async (address: string) => {
        let name = "Unnamed University";
        try {
          name = await this.getUniversityName(address);
        } catch (err) {
          console.warn(`Failed to fetch name for ${address}`, err);
        }
        return { address, name };
      })
    );

    return universities;
  }

  // Record operations
  async addRecord(
    studentId: string,
    studentName: string,
    studentAddress: string,
    universityName: string,
    ipfsHash: string,
    metadataHash: string,
    recordType: number
  ): Promise<number> {
    this.ensureContract();
    const tx = await this.contract!.addRecord(
      studentId,
      studentName,
      studentAddress,
      universityName,
      ipfsHash,
      metadataHash,
      recordType
    );
    const receipt = await tx.wait();
    const event = receipt.logs?.find((log: any) => {
      try {
        const parsed = this.contract!.interface.parseLog(log);
        return parsed?.name === "RecordAdded";
      } catch {
        return false;
      }
    });
    if (!event) throw new Error("RecordAdded event not found");
    const parsedEvent = this.contract!.interface.parseLog(event);
    return Number(parsedEvent?.args.recordId);
  }

  async getRecord(recordId: number): Promise<Record> {
    this.ensureContract();
    const record = await this.contract!.getRecord(recordId);
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

  async getStudentRecords(studentId: string): Promise<number[]> {
    this.ensureContract();
    if (ethers.isAddress(studentId)) {
      return this.getStudentRecordsByAddress(studentId);
    }
    const recordIds = await this.contract!.getStudentRecords(studentId);
    return recordIds.map((id: bigint) => Number(id));
  }

  async getStudentRecordsByAddress(address: string): Promise<number[]> {
    this.ensureContract();
    const recordIds = await this.contract!.getStudentRecordsByAddress(address);
    return recordIds.map((id: bigint) => Number(id));
  }

  async getUniversityRecords(): Promise<number[]> {
    this.ensureContract();
    const recordIds = await this.contract!.getUniversityRecords();
    return recordIds.map((id: bigint) => Number(id));
  }

  async verifyRecord(recordId: number): Promise<boolean> {
    this.ensureContract();
    return await this.contract!.verifyRecord(recordId);
  }

  async recordAccess(recordId: number): Promise<void> {
    this.ensureContract();
    const tx = await this.contract!.recordAccess(recordId);
    await tx.wait();
  }

  // Record sharing functions
  async shareRecord(
    recordId: number,
    sharedWithAddress: string
  ): Promise<void> {
    this.ensureContract();
    const tx = await this.contract!.shareRecord(recordId, sharedWithAddress);
    await tx.wait();
  }

  async unshareRecord(
    recordId: number,
    sharedWithAddress: string
  ): Promise<void> {
    this.ensureContract();
    const tx = await this.contract!.unshareRecord(recordId, sharedWithAddress);
    await tx.wait();
  }

  async getSharedRecords(sharedWithAddress: string): Promise<number[]> {
    this.ensureContract();
    const recordIds = await this.contract!.getSharedRecords(sharedWithAddress);
    return recordIds.map((id: bigint) => Number(id));
  }

  async isRecordSharedWith(
    recordId: number,
    userAddress: string
  ): Promise<boolean> {
    this.ensureContract();
    return await this.contract!.isRecordSharedWith(recordId, userAddress);
  }

  // Student registration
  async registerStudent(
    studentId: string,
    studentAddress?: string
  ): Promise<void> {
    if (!this.studentManagementContract) {
      throw new Error("StudentManagement contract not initialized");
    }
    // If studentAddress is provided, use it (admin registering a student)
    // Otherwise, use the current user's address (student self-registration)
    const address = studentAddress || (await this.getCurrentAddress());
    const tx = await this.studentManagementContract.registerStudent(
      studentId,
      address
    );
    await tx.wait();
  }

  async getStudentId(address: string): Promise<string> {
    if (!this.studentManagementContract) {
      throw new Error("StudentManagement contract not initialized");
    }
    return await this.studentManagementContract.getStudentId(address);
  }

  // Pause control
  async pauseContract(): Promise<void> {
    this.ensureContract();
    const tx = await this.contract!.pause();
    await tx.wait();
  }

  async unpauseContract(): Promise<void> {
    this.ensureContract();
    const tx = await this.contract!.unpause();
    await tx.wait();
  }

  async isPaused(): Promise<boolean> {
    this.ensureContract();
    return await this.contract!.paused();
  }

  // Returns the total number of records stored
  async getTotalRecords(): Promise<number> {
    this.ensureContract();
    const total: bigint = await this.contract!.getTotalRecords();
    return Number(total);
  }

  // Returns the total number of custom record types added
  async getTotalCustomTypes(): Promise<number> {
    this.ensureContract();
    const total: bigint = await this.contract!.getTotalCustomTypes();
    return Number(total);
  }

  // Returns a list of all admin addresses
  async getAllAdmins(): Promise<string[]> {
    this.ensureContract();
    return await this.contract!.getAllAdmins();
  }

  // Adds a new admin to the system
  async addAdmin(adminAddress: string): Promise<void> {
    this.ensureContract();
    const tx = await this.contract!.addAdmin(adminAddress);
    await tx.wait();
  }

  // Removes an existing admin
  async removeAdmin(adminAddress: string): Promise<void> {
    this.ensureContract();
    const tx = await this.contract!.removeAdmin(adminAddress);
    await tx.wait();
  }

  // Removes a university from the system
  async removeUniversity(universityAddress: string): Promise<void> {
    this.ensureContract();
    const tx = await this.contract!.removeUniversity(universityAddress);
    await tx.wait();
  }

  // Adds a new custom record type and returns its type ID
  async addCustomRecordType(
    name: string,
    description: string
  ): Promise<number> {
    this.ensureContract();
    const tx = await this.contract!.addCustomRecordType(name, description);
    const receipt = await tx.wait();
    const event = receipt.logs?.find((log: any) => {
      try {
        const parsed = this.contract!.interface.parseLog(log);
        console.log("Parsed event:", parsed);
        return parsed?.name === "CustomRecordTypeCreated";
      } catch {
        return false;
      }
    });
    if (!event) {
      throw new Error("CustomRecordTypeCreated event not found");
    }
    const parsedEvent = this.contract!.interface.parseLog(event);
    return Number(parsedEvent?.args.typeId);
  }

  // ===== ZK-Enhanced Methods =====

  /**
   * Get record with ZK access control - returns record with document URL only if user has access
   */
  async getRecordWithZKAccess(recordId: number): Promise<SecureRecord> {
    this.ensureContract();

    // Get basic record data
    const record = await this.getRecord(recordId);
    const currentAddress = await this.getCurrentAddress();

    // Initialize secure record with basic data
    const secureRecord: SecureRecord = {
      ...record,
      hasZKAccess: false,
      accessLevel: 'none'
    };

    // Determine access level
    if (record.studentAddress.toLowerCase() === currentAddress.toLowerCase()) {
      secureRecord.accessLevel = 'owner';
    } else if (await this.hasRole('UNIVERSITY_ROLE', currentAddress)) {
      secureRecord.accessLevel = 'university';
    } else if (await this.hasRole('ADMIN_ROLE', currentAddress) || await this.hasRole('SUPER_ADMIN_ROLE', currentAddress)) {
      secureRecord.accessLevel = 'admin';
    } else if (await this.isRecordSharedWith(recordId, currentAddress)) {
      secureRecord.accessLevel = 'shared';
    }

    // Try ZK access if service is initialized
    if (this.zkInitialized) {
      try {
        const hasAccess = await zkService.hasAccessToRecord(recordId);
        if (hasAccess) {
          const ipfsHash = await zkService.verifyDocumentAccess(recordId);
          if (ipfsHash) {
            secureRecord.hasZKAccess = true;
            secureRecord.ipfsHash = ipfsHash;
            secureRecord.documentUrl = getGatewayUrl(ipfsHash);
          }
        }
      } catch (error) {
        console.warn(`ZK access verification failed for record ${recordId}:`, error);
        // Fall back to legacy access for owners, universities, and admins
        if (secureRecord.accessLevel === 'owner' ||
          secureRecord.accessLevel === 'university' ||
          secureRecord.accessLevel === 'admin') {
          secureRecord.documentUrl = getGatewayUrl(record.ipfsHash);
        }
      }
    } else {
      // Legacy access for backward compatibility
      if (secureRecord.accessLevel === 'owner' ||
        secureRecord.accessLevel === 'university' ||
        secureRecord.accessLevel === 'admin') {
        secureRecord.documentUrl = getGatewayUrl(record.ipfsHash);
      }
    }

    return secureRecord;
  }

  /**
   * Get shared records with proper ZK access validation
   */
  async getSharedRecordsWithAccess(userAddress?: string): Promise<SharedRecordInfo[]> {
    this.ensureContract();

    const currentAddress = userAddress || await this.getCurrentAddress();
    const sharedRecordInfos: SharedRecordInfo[] = [];

    if (this.zkInitialized) {
      try {
        // Get all records accessible via ZK proofs
        const accessibleRecordIds = await zkService.getUserAccessibleRecords();

        for (const recordId of accessibleRecordIds) {
          try {
            const record = await this.getRecord(recordId);

            // Skip if user owns the record
            if (record.studentAddress.toLowerCase() === currentAddress.toLowerCase()) {
              continue;
            }

            // Get ZK access for the record
            const secureRecord = await this.getRecordWithZKAccess(recordId);

            if (secureRecord.hasZKAccess) {
              sharedRecordInfos.push({
                recordId,
                sharedBy: record.studentAddress,
                sharedAt: record.timestamp,
                accessLevel: 'shared',
                record: secureRecord
              });
            }
          } catch (error) {
            console.warn(`Failed to process shared record ${recordId}:`, error);
          }
        }
      } catch (error) {
        console.warn("Failed to get ZK accessible records, falling back to legacy method:", error);
        // Fall back to legacy shared records
        return this.getLegacySharedRecords(currentAddress);
      }
    } else {
      // Use legacy shared records method
      return this.getLegacySharedRecords(currentAddress);
    }

    return sharedRecordInfos;
  }

  /**
   * Legacy method to get shared records without ZK
   */
  private async getLegacySharedRecords(userAddress: string): Promise<SharedRecordInfo[]> {
    const sharedRecordIds = await this.getSharedRecords(userAddress);
    const sharedRecordInfos: SharedRecordInfo[] = [];

    for (const recordId of sharedRecordIds) {
      try {
        const record = await this.getRecord(recordId);
        const secureRecord: SecureRecord = {
          ...record,
          hasZKAccess: false,
          accessLevel: 'shared',
          documentUrl: getGatewayUrl(record.ipfsHash) // Legacy access
        };

        sharedRecordInfos.push({
          recordId,
          sharedBy: record.studentAddress,
          sharedAt: record.timestamp,
          accessLevel: 'shared',
          record: secureRecord
        });
      } catch (error) {
        console.warn(`Failed to process legacy shared record ${recordId}:`, error);
      }
    }

    return sharedRecordInfos;
  }

  /**
   * Validate ZK proof before generating document URL
   */
  async validateZKAccessAndGetURL(recordId: number): Promise<ZKAccessResult> {
    if (!this.zkInitialized) {
      return {
        hasAccess: false,
        error: 'ZK service not initialized'
      };
    }

    try {
      const hasAccess = await zkService.hasAccessToRecord(recordId);
      if (!hasAccess) {
        return {
          hasAccess: false,
          error: 'Access denied - user does not have permission to view this document'
        };
      }

      const ipfsHash = await zkService.verifyDocumentAccess(recordId);
      if (!ipfsHash) {
        return {
          hasAccess: false,
          error: 'ZK proof verification failed'
        };
      }

      return {
        hasAccess: true,
        ipfsHash
      };
    } catch (error) {
      console.error('ZK access validation failed:', error);
      return {
        hasAccess: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Enhanced record sharing with ZK access control
   * Note: This extends the existing shareRecord method with ZK integration
   */
  async shareRecordWithZK(
    recordId: number,
    sharedWithAddress: string
  ): Promise<void> {
    // Call the existing share method
    this.ensureContract();
    const tx = await this.contract!.shareRecord(recordId, sharedWithAddress);
    await tx.wait();

    // If ZK is initialized, the ZK contract should handle access credential generation
    // This is handled by the smart contract integration
    if (this.zkInitialized) {
      console.log(`Record ${recordId} shared with ZK access control for ${sharedWithAddress}`);
    }
  }

  /**
   * Enhanced record unsharing with ZK access control
   */
  async unshareRecordWithZK(
    recordId: number,
    sharedWithAddress: string
  ): Promise<void> {
    // Call the existing unshare method
    this.ensureContract();
    const tx = await this.contract!.unshareRecord(recordId, sharedWithAddress);
    await tx.wait();

    // ZK access revocation is handled by the smart contract
    if (this.zkInitialized) {
      console.log(`ZK access revoked for record ${recordId} from ${sharedWithAddress}`);
    }
  }

  /**
   * Check if ZK service is available and initialized
   */
  isZKEnabled(): boolean {
    return this.zkInitialized;
  }

  /**
   * Get ZK service instance for advanced operations
   */
  getZKService() {
    if (!this.zkInitialized) {
      throw new Error('ZK service not initialized');
    }
    return zkService;
  }
}

export const blockchainService = new BlockchainService();
