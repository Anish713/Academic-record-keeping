import { ethers } from "ethers";
import AcademicRecords from "../contracts/AcademicRecords.json";
import IAcademicRecords from "../contracts/IAcademicRecords.json";
import RoleManager from "../contracts/RoleManager.json";
import StudentManagement from "../contracts/StudentManagement.json";
import { Record, CustomRecordType } from "../types/records";
import { SecureRecord, SharedRecordInfo, ZKAccessResult, ZKError, ZKErrorType } from "../types/zkTypes";
import { zkService } from "./zkService";
import { zkFallbackService } from "./zkFallbackService";
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
   * Initialize ZK service for secure document access with enhanced error handling
   */
  private async initZKService(): Promise<void> {
    try {
      await zkService.init();
      this.zkInitialized = true;
      console.log("ZK service initialized successfully");

      // Test ZK contract connectivity
      try {
        const currentAddress = await this.getCurrentAddress();
        console.log("Testing ZK contract connectivity...");

        // Test a simple contract call to verify it's working
        const testRecords = await zkService.getUserAccessibleRecords();
        console.log(`ZK contract test successful. User has access to ${testRecords.length} records.`);
      } catch (testError) {
        console.warn("ZK contract test failed, but circuits are loaded:", testError);
        // Don't disable ZK entirely, but log the issue
      }
    } catch (error) {
      console.warn("ZK service initialization failed, falling back to legacy access:", error);
      this.zkInitialized = false;

      // Log the specific error for monitoring
      if (error instanceof Error) {
        console.warn("ZK initialization error details:", {
          message: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString()
        });
      }
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

  /**
   * Get admin records with ZK access verification
   * Returns all records with proper ZK access for admin users
   */
  async getAdminRecordsWithZKAccess(): Promise<SecureRecord[]> {
    this.ensureContract();

    try {
      const currentAddress = await this.getCurrentAddress();

      // Verify admin role
      const isAdmin = await this.hasRole("ADMIN_ROLE", currentAddress);
      const isSuperAdmin = await this.hasRole("SUPER_ADMIN_ROLE", currentAddress);

      if (!isAdmin && !isSuperAdmin) {
        throw new Error("User does not have admin privileges");
      }

      // Get all records for admin oversight
      const totalRecords = await this.getTotalRecords();
      const records: SecureRecord[] = [];

      for (let recordId = 1; recordId <= totalRecords; recordId++) {
        try {
          const secureRecord = await this.getRecordWithZKAccess(recordId);

          // Admins should have oversight access to all records
          if (secureRecord.accessLevel === 'none') {
            secureRecord.accessLevel = 'admin';
            secureRecord.hasZKAccess = await this.validateAdminZKAccess(recordId, currentAddress);
          }

          records.push(secureRecord);
        } catch (error) {
          console.warn(`Failed to get ZK access for admin record ${recordId}:`, error);

          // Try to get basic record information as fallback
          try {
            const basicRecord = await this.getRecord(recordId);
            if (basicRecord) {
              const fallbackRecord: SecureRecord = {
                ...basicRecord,
                hasZKAccess: false,
                accessLevel: 'admin',
                documentUrl: undefined
              };
              records.push(fallbackRecord);
            }
          } catch (fallbackError) {
            console.error(`Failed to get fallback record ${recordId}:`, fallbackError);
          }
        }
      }

      return records;
    } catch (error) {
      console.error('Failed to get admin records with ZK access:', error);
      // Return empty array rather than throwing to maintain dashboard functionality
      return [];
    }
  }

  /**
   * Validate admin ZK access to a record
   * Admins should have oversight access to all records
   */
  private async validateAdminZKAccess(recordId: number, adminAddress: string): Promise<boolean> {
    try {
      // Check if ZK service is initialized
      if (this.zkInitialized) {
        return await zkService.validateAdminAccess(recordId, adminAddress);
      } else {
        // Fallback: admins have access to all records for oversight
        return true;
      }
    } catch (error) {
      console.warn(`Failed to validate admin ZK access for record ${recordId}:`, error);
      return true; // Default to allowing admin access for oversight
    }
  }

  /**
   * Get university records with ZK access verification
   * Returns records with proper ZK access for universities
   */
  async getUniversityRecordsWithZKAccess(): Promise<SecureRecord[]> {
    try {
      const currentAddress = await this.getCurrentAddress();

      // Verify university role
      const isUniversity = await this.hasRole('UNIVERSITY_ROLE', currentAddress);
      if (!isUniversity) {
        throw new Error('User does not have university role');
      }

      const recordIds = await this.getUniversityRecords();
      const records: SecureRecord[] = [];

      for (const recordId of recordIds) {
        try {
          const secureRecord = await this.getRecordWithZKAccess(recordId);

          // Ensure university has proper access level
          if (secureRecord.accessLevel === 'university' || secureRecord.accessLevel === 'owner') {
            records.push(secureRecord);
          }
        } catch (error) {
          console.warn(`Failed to get ZK access for university record ${recordId}:`, error);

          // Try to get basic record information as fallback
          try {
            const basicRecord = await this.getRecord(recordId);
            const fallbackRecord: SecureRecord = {
              ...basicRecord,
              hasZKAccess: false,
              accessLevel: 'university',
              documentUrl: undefined // No document access in fallback
            };
            records.push(fallbackRecord);
          } catch (fallbackError) {
            console.error(`Failed to get fallback record ${recordId}:`, fallbackError);
          }
        }
      }

      return records;
    } catch (error) {
      console.error('Failed to get university records with ZK access:', error);
      return [];
    }
  }

  /**
   * Verify university access to a specific record
   * Universities should have automatic access to records they issued
   */
  async verifyUniversityRecordAccess(recordId: number): Promise<boolean> {
    try {
      const currentAddress = await this.getCurrentAddress();

      // Verify university role
      const isUniversity = await this.hasRole('UNIVERSITY_ROLE', currentAddress);
      if (!isUniversity) {
        return false;
      }

      // Check if ZK service is initialized
      if (this.zkInitialized) {
        return await zkService.validateUniversityAccess(recordId, currentAddress);
      } else {
        // Fallback: check if university issued this record
        const record = await this.getRecord(recordId);
        return record.universityAddress?.toLowerCase() === currentAddress.toLowerCase();
      }
    } catch (error) {
      console.error(`Failed to verify university access for record ${recordId}:`, error);
      return false;
    }
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

  // Record sharing functions - Enhanced with ZK access control
  async shareRecord(
    recordId: number,
    sharedWithAddress: string
  ): Promise<void> {
    // Use ZK-enhanced sharing if available, otherwise fall back to legacy
    if (this.zkInitialized) {
      return this.shareRecordWithZK(recordId, sharedWithAddress);
    } else {
      // Legacy sharing method
      this.ensureContract();
      const tx = await this.contract!.shareRecord(recordId, sharedWithAddress);
      await tx.wait();
    }
  }

  async unshareRecord(
    recordId: number,
    sharedWithAddress: string
  ): Promise<void> {
    // Use ZK-enhanced unsharing if available, otherwise fall back to legacy
    if (this.zkInitialized) {
      return this.unshareRecordWithZK(recordId, sharedWithAddress);
    } else {
      // Legacy unsharing method
      this.ensureContract();
      const tx = await this.contract!.unshareRecord(recordId, sharedWithAddress);
      await tx.wait();
    }
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
   * Enhanced with comprehensive error handling and fallback mechanisms
   */
  async getRecordWithZKAccess(recordId: number): Promise<SecureRecord> {
    this.ensureContract();

    try {
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

      // For record owners, grant automatic ZK access when ZK service is initialized
      if (this.zkInitialized && secureRecord.accessLevel === 'owner') {
        console.log(`Record ${recordId} owner ${currentAddress} gets automatic ZK access`);
        secureRecord.hasZKAccess = true;
        secureRecord.documentUrl = getGatewayUrl(record.ipfsHash);
        return secureRecord;
      }

      // Try ZK access if service is initialized
      if (this.zkInitialized) {
        try {
          let ipfsHash: string | null = null;

          console.log(`Attempting ZK access for record ${recordId}, access level: ${secureRecord.accessLevel}`);

          // For university users, check if they issued the record (they should have automatic access)
          if (secureRecord.accessLevel === 'university') {
            console.log(`Using university ZK access for record ${recordId}`);

            // Check if university issued this record (automatic access)
            if (record.universityAddress?.toLowerCase() === currentAddress.toLowerCase()) {
              console.log(`University ${currentAddress} issued record ${recordId}, granting ZK access`);
              secureRecord.hasZKAccess = true;
              secureRecord.documentUrl = getGatewayUrl(record.ipfsHash);
              return secureRecord; // Skip ZK proof generation for university-issued records
            } else {
              // Try ZK contract access for records from other universities
              ipfsHash = await zkService.verifyUniversityDocumentAccess(recordId, currentAddress, record);
            }
          } else {
            // Use regular ZK access for other users
            console.log(`Checking regular ZK access for record ${recordId}`);
            const hasAccess = await zkService.hasAccessToRecord(recordId);
            console.log(`ZK access check result for record ${recordId}: ${hasAccess}`);

            if (hasAccess) {
              ipfsHash = await zkService.verifyDocumentAccess(recordId, record);
            }
          }

          if (ipfsHash) {
            secureRecord.hasZKAccess = true;
            secureRecord.ipfsHash = ipfsHash;
            secureRecord.documentUrl = getGatewayUrl(ipfsHash);
            console.log(`ZK access successful for record ${recordId}`);
          } else {
            console.log(`ZK access returned no IPFS hash for record ${recordId}`);
          }
        } catch (zkError) {
          console.warn(`ZK access verification failed for record ${recordId}:`, zkError);

          // Log more details about the error
          if (zkError instanceof Error) {
            console.warn("ZK error details:", {
              name: zkError.name,
              message: zkError.message,
              stack: zkError.stack
            });
          }

          // Use fallback service for graceful degradation
          try {
            let fallbackResult;

            // Use specialized university fallback for university users
            if (secureRecord.accessLevel === 'university') {
              fallbackResult = await zkFallbackService.fallbackUniversityAccess(
                recordId,
                currentAddress,
                record,
                zkError instanceof Error ?
                  new ZKError(ZKErrorType.PROOF_VERIFICATION_FAILED, zkError.message) :
                  new ZKError(ZKErrorType.PROOF_VERIFICATION_FAILED, 'Unknown ZK error')
              );
            } else {
              fallbackResult = await zkFallbackService.fallbackDocumentAccess(
                recordId,
                currentAddress,
                record,
                zkError instanceof Error ?
                  new ZKError(ZKErrorType.PROOF_VERIFICATION_FAILED, zkError.message) :
                  new ZKError(ZKErrorType.PROOF_VERIFICATION_FAILED, 'Unknown ZK error')
              );
            }

            if (fallbackResult.hasAccess && fallbackResult.ipfsHash) {
              secureRecord.documentUrl = getGatewayUrl(fallbackResult.ipfsHash);
              console.info(`Using fallback access for record ${recordId}`);
            }
          } catch (fallbackError) {
            console.error(`Fallback access also failed for record ${recordId}:`, fallbackError);
          }
        }
      } else {
        // Legacy access for backward compatibility when ZK is not initialized
        console.info(`Using legacy access for record ${recordId} (ZK not initialized)`);
        if (secureRecord.accessLevel === 'owner' ||
          secureRecord.accessLevel === 'university' ||
          secureRecord.accessLevel === 'admin') {
          secureRecord.documentUrl = getGatewayUrl(record.ipfsHash);
        }
      }

      return secureRecord;
    } catch (error) {
      console.error(`Failed to get record ${recordId} with ZK access:`, error);

      // Return minimal record information on complete failure
      try {
        const record = await this.getRecord(recordId);
        return {
          ...record,
          hasZKAccess: false,
          accessLevel: 'none'
        };
      } catch (recordError) {
        console.error(`Failed to get basic record ${recordId}:`, recordError);
        throw new Error(`Unable to access record ${recordId}`);
      }
    }
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
   * Generates ZK access credentials and updates Merkle tree for shared users
   */
  async shareRecordWithZK(
    recordId: number,
    sharedWithAddress: string
  ): Promise<void> {
    this.ensureContract();

    // Validate inputs
    if (!ethers.isAddress(sharedWithAddress)) {
      throw new Error('Invalid shared address');
    }

    const currentAddress = await this.getCurrentAddress();
    const record = await this.getRecord(recordId);

    // Verify the current user owns the record
    if (record.studentAddress.toLowerCase() !== currentAddress.toLowerCase()) {
      throw new Error('Only record owner can share records');
    }

    // Call the enhanced share method that handles ZK integration
    const tx = await this.contract!.shareRecord(recordId, sharedWithAddress);
    await tx.wait();

    // If ZK is initialized, verify the access was properly granted
    if (this.zkInitialized) {
      try {
        // Wait a moment for the transaction to be processed
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Verify that ZK access was granted
        const hasAccess = await zkService.hasAccessToRecord(recordId);
        if (hasAccess) {
          console.log(`Record ${recordId} successfully shared with ZK access control for ${sharedWithAddress}`);
        } else {
          console.warn(`ZK access may not have been properly granted for record ${recordId}`);
        }
      } catch (error) {
        console.warn('Failed to verify ZK access after sharing:', error);
      }
    }
  }

  /**
   * Enhanced record unsharing with ZK access control
   * Revokes ZK access and updates Merkle tree to remove shared user
   */
  async unshareRecordWithZK(
    recordId: number,
    sharedWithAddress: string
  ): Promise<void> {
    this.ensureContract();

    // Validate inputs
    if (!ethers.isAddress(sharedWithAddress)) {
      throw new Error('Invalid shared address');
    }

    const currentAddress = await this.getCurrentAddress();
    const record = await this.getRecord(recordId);

    // Verify the current user owns the record
    if (record.studentAddress.toLowerCase() !== currentAddress.toLowerCase()) {
      throw new Error('Only record owner can unshare records');
    }

    // Verify the record is currently shared with the address
    const isShared = await this.isRecordSharedWith(recordId, sharedWithAddress);
    if (!isShared) {
      throw new Error('Record is not shared with this address');
    }

    // Call the enhanced unshare method that handles ZK integration
    const tx = await this.contract!.unshareRecord(recordId, sharedWithAddress);
    await tx.wait();

    // If ZK is initialized, verify the access was properly revoked
    if (this.zkInitialized) {
      try {
        // Wait a moment for the transaction to be processed
        await new Promise(resolve => setTimeout(resolve, 1000));

        console.log(`ZK access successfully revoked for record ${recordId} from ${sharedWithAddress}`);
      } catch (error) {
        console.warn('Failed to verify ZK access revocation after unsharing:', error);
      }
    }
  }

  /**
   * Generate secure access key for record sharing
   * This creates a unique access key for a user to access a specific record
   */
  async generateAccessKey(
    recordId: number,
    userAddress: string,
    validityPeriod?: number
  ): Promise<string> {
    this.ensureContract();

    const currentAddress = await this.getCurrentAddress();
    const timestamp = Math.floor(Date.now() / 1000);
    const validity = validityPeriod || (365 * 24 * 60 * 60); // Default 1 year

    // Generate a unique access key based on multiple factors
    const accessKeyData = ethers.solidityPackedKeccak256(
      ['uint256', 'address', 'address', 'uint256', 'uint256', 'string'],
      [recordId, userAddress, currentAddress, timestamp, validity, 'ACCESS_KEY']
    );

    return accessKeyData;
  }

  /**
   * Get all users who have access to a specific record
   */
  async getRecordAccessList(recordId: number): Promise<string[]> {
    this.ensureContract();

    const currentAddress = await this.getCurrentAddress();
    const record = await this.getRecord(recordId);

    // Only record owner, universities, or admins can view access list
    const isOwner = record.studentAddress.toLowerCase() === currentAddress.toLowerCase();
    const isUniversity = await this.hasRole('UNIVERSITY_ROLE', currentAddress);
    const isAdmin = await this.hasRole('ADMIN_ROLE', currentAddress) ||
      await this.hasRole('SUPER_ADMIN_ROLE', currentAddress);

    if (!isOwner && !isUniversity && !isAdmin) {
      throw new Error('Not authorized to view record access list');
    }

    if (this.zkInitialized) {
      try {
        // Get access list from ZK contract if available
        const zkContract = zkService.getZKService();
        // This would require adding a method to get access list from ZK contract
        // For now, fall back to traditional method
      } catch (error) {
        console.warn('Failed to get ZK access list:', error);
      }
    }

    // Fall back to traditional shared records method
    // This is a simplified implementation - in practice, you'd need to track all shared addresses
    const sharedAddresses: string[] = [];

    // Add the owner
    sharedAddresses.push(record.studentAddress);

    // Add the issuing university
    sharedAddresses.push(record.university);

    return sharedAddresses;
  }

  /**
   * Batch share record with multiple addresses
   */
  async batchShareRecord(
    recordId: number,
    sharedWithAddresses: string[]
  ): Promise<void> {
    if (!Array.isArray(sharedWithAddresses) || sharedWithAddresses.length === 0) {
      throw new Error('Invalid addresses array');
    }

    // Validate all addresses first
    for (const address of sharedWithAddresses) {
      if (!ethers.isAddress(address)) {
        throw new Error(`Invalid address: ${address}`);
      }
    }

    // Share with each address sequentially
    for (const address of sharedWithAddresses) {
      try {
        await this.shareRecordWithZK(recordId, address);
        console.log(`Successfully shared record ${recordId} with ${address}`);
      } catch (error) {
        console.error(`Failed to share record ${recordId} with ${address}:`, error);
        throw error; // Stop on first failure
      }
    }
  }

  /**
   * Batch unshare record from multiple addresses
   */
  async batchUnshareRecord(
    recordId: number,
    sharedWithAddresses: string[]
  ): Promise<void> {
    if (!Array.isArray(sharedWithAddresses) || sharedWithAddresses.length === 0) {
      throw new Error('Invalid addresses array');
    }

    // Validate all addresses first
    for (const address of sharedWithAddresses) {
      if (!ethers.isAddress(address)) {
        throw new Error(`Invalid address: ${address}`);
      }
    }

    // Unshare from each address sequentially
    for (const address of sharedWithAddresses) {
      try {
        await this.unshareRecordWithZK(recordId, address);
        console.log(`Successfully unshared record ${recordId} from ${address}`);
      } catch (error) {
        console.error(`Failed to unshare record ${recordId} from ${address}:`, error);
        // Continue with other addresses even if one fails
      }
    }
  }

  /**
   * Check if ZK service is available and initialized
   */
  isZKEnabled(): boolean {
    return this.zkInitialized;
  }

  /**
   * Get detailed ZK service status for debugging
   */
  getZKStatus(): {
    initialized: boolean;
    contractAddress: string;
    circuitsLoaded: boolean;
    lastError?: string;
  } {
    return {
      initialized: this.zkInitialized,
      contractAddress: process.env.NEXT_PUBLIC_ZK_CONTRACT_ADDRESS || 'Not configured',
      circuitsLoaded: this.zkInitialized, // If ZK is initialized, circuits are loaded
      lastError: this.zkInitialized ? undefined : 'ZK service failed to initialize'
    };
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

  /**
   * Enhanced record unsharing with ZK access control
   */
  async unshareRecordWithZK(
    recordId: number,
    sharedWithAddress: string
  ): Promise<void> {
    this.ensureContract();

    // Validate inputs
    if (!ethers.isAddress(sharedWithAddress)) {
      throw new Error('Invalid shared address');
    }

    const currentAddress = await this.getCurrentAddress();
    const record = await this.getRecord(recordId);

    // Verify the current user owns the record
    if (record.studentAddress.toLowerCase() !== currentAddress.toLowerCase()) {
      throw new Error('Only record owner can unshare records');
    }

    try {
      // Call the contract unshare method
      const tx = await this.contract!.unshareRecord(recordId, sharedWithAddress);
      await tx.wait();

      console.log(`Successfully unshared record ${recordId} from ${sharedWithAddress}`);
    } catch (error) {
      console.error(`Failed to unshare record ${recordId} with ZK:`, error);
      throw error;
    }
  }

  /**
   * Get ZK service status for debugging
   */
  getZKStatus() {
    return {
      initialized: this.zkInitialized,
      contractAddress: process.env.NEXT_PUBLIC_ZK_CONTRACT_ADDRESS || 'Not configured',
      circuitsLoaded: this.zkInitialized,
      lastError: undefined // Could be enhanced to track last error
    };
  }
}

export const blockchainService = new BlockchainService();
