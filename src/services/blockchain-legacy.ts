/**
 * @deprecated Legacy Blockchain Service - Use modular services instead
 *
 * This file provides backward compatibility for the old blockchain.ts interface.
 * For new development, use the modular services:
 *
 * Individual Services:
 * - walletService from "./blockchain/wallet.service"
 * - roleManagementService from "./blockchain/role-management.service"
 * - universityManagementService from "./blockchain/university-management.service"
 * - studentManagementService from "./blockchain/student-management.service"
 * - recordsManagementService from "./blockchain/records-management.service"
 * - zkpService from "./zkp/zkp.service"
 * - encryptedIPFSService from "./zkp/encrypted-ipfs.service"
 *
 * Unified Service:
 * - blockchainService from "./blockchain" (recommended for most use cases)
 *
 * Migration Guide:
 * Replace: import { blockchainService } from "./services/blockchain"
 * With: import { blockchainService } from "./services/blockchain"
 * Or: import { blockchainService } from "./services"
 */

import { walletService } from "./blockchain/wallet.service";
import {
  roleManagementService,
  UserRole,
} from "./blockchain/role-management.service";
import {
  universityManagementService,
  University,
} from "./blockchain/university-management.service";
import { studentManagementService } from "./blockchain/student-management.service";
import { recordsManagementService } from "./blockchain/records-management.service";
import { zkpService, initializeZKPService } from "./zkp/zkp.service";
import { encryptedIPFSService } from "./zkp/encrypted-ipfs.service";
import { Record, CustomRecordType } from "../types/records";
import {
  ZKPServiceConfig,
  EncryptedIPFSData,
  ZKAccessType,
} from "../types/zkp";

/**
 * Main Blockchain Service
 * Orchestrates all modular services and provides a unified interface
 */
export class BlockchainService {
  private isInitialized = false;

  /**
   * Initialize all blockchain services
   * @returns Promise<boolean> - success status
   */
  async init(): Promise<boolean> {
    try {
      // Initialize wallet connection first
      const walletConnected = await walletService.connect();
      if (!walletConnected) {
        console.error("Failed to connect wallet");
        return false;
      }

      // Initialize all contract services
      const initPromises = [
        roleManagementService.init(),
        universityManagementService.init(),
        studentManagementService.init(),
        recordsManagementService.init(),
      ];

      const initResults = await Promise.all(initPromises);
      if (initResults.some((result) => !result)) {
        console.error("Failed to initialize some contract services");
        return false;
      }

      // Initialize ZKP service
      await this.initializeZKPService();

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error("Blockchain service initialization failed:", error);
      return false;
    }
  }

  /**
   * Initialize ZKP service with configuration
   */
  private async initializeZKPService(): Promise<void> {
    const zkpConfig: ZKPServiceConfig = {
      accessVerificationCircuit: {
        wasmPath: "/circuits/access_verification.wasm",
        zkeyPath: "/circuits/access_verification_final.zkey",
        verificationKeyPath:
          "/circuits/access_verification_verification_key.json",
      },
      recordSharingCircuit: {
        wasmPath: "/circuits/record_sharing.wasm",
        zkeyPath: "/circuits/record_sharing_final.zkey",
        verificationKeyPath: "/circuits/record_sharing_verification_key.json",
      },
      contractAddress:
        process.env.NEXT_PUBLIC_ZKP_MANAGER_CONTRACT_ADDRESS || "",
      keyStorageContract:
        process.env.NEXT_PUBLIC_KEY_STORAGE_CONTRACT_ADDRESS || "",
    };

    initializeZKPService(zkpConfig);
    await zkpService.init();
  }

  /**
   * Ensure service is initialized
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error("Blockchain service not initialized. Call init() first.");
    }
  }

  // ============================================================================
  // WALLET OPERATIONS
  // ============================================================================

  /**
   * Get current connected address
   */
  async getCurrentAddress(): Promise<string> {
    return await walletService.getCurrentAddress();
  }

  /**
   * Check if wallet is connected
   */
  isWalletConnected(): boolean {
    return walletService.isConnected();
  }

  /**
   * Disconnect wallet
   */
  disconnectWallet(): void {
    walletService.disconnect();
    this.isInitialized = false;
  }

  // ============================================================================
  // ROLE MANAGEMENT
  // ============================================================================

  /**
   * Check if user has a specific role
   */
  async hasRole(role: UserRole, address: string): Promise<boolean> {
    this.ensureInitialized();
    return await roleManagementService.hasRole(role, address);
  }

  /**
   * Add a new admin
   */
  async addAdmin(adminAddress: string): Promise<void> {
    this.ensureInitialized();
    return await roleManagementService.addAdmin(adminAddress);
  }

  /**
   * Remove an admin
   */
  async removeAdmin(adminAddress: string): Promise<void> {
    this.ensureInitialized();
    return await roleManagementService.removeAdmin(adminAddress);
  }

  /**
   * Get all admins
   */
  async getAllAdmins(): Promise<string[]> {
    this.ensureInitialized();
    return await roleManagementService.getAllAdmins();
  }

  /**
   * Check if current user is admin
   */
  async isCurrentUserAdmin(): Promise<boolean> {
    this.ensureInitialized();
    return await roleManagementService.isCurrentUserAdmin();
  }

  /**
   * Check if current user is university
   */
  async isCurrentUserUniversity(): Promise<boolean> {
    this.ensureInitialized();
    return await roleManagementService.isCurrentUserUniversity();
  }

  // ============================================================================
  // UNIVERSITY MANAGEMENT
  // ============================================================================

  /**
   * Add a new university
   */
  async addUniversity(address: string, name: string): Promise<void> {
    this.ensureInitialized();
    return await universityManagementService.addUniversity(address, name);
  }

  /**
   * Set university name
   */
  async setUniversityName(address: string, name: string): Promise<void> {
    this.ensureInitialized();
    return await universityManagementService.setUniversityName(address, name);
  }

  /**
   * Get university name
   */
  async getUniversityName(address: string): Promise<string> {
    this.ensureInitialized();
    return await universityManagementService.getUniversityName(address);
  }

  /**
   * Get all universities
   */
  async getAllUniversities(): Promise<University[]> {
    this.ensureInitialized();
    return await universityManagementService.getAllUniversities();
  }

  /**
   * Remove a university
   */
  async removeUniversity(universityAddress: string): Promise<void> {
    this.ensureInitialized();
    return await universityManagementService.removeUniversity(
      universityAddress
    );
  }

  /**
   * Get university records
   */
  async getUniversityRecords(): Promise<number[]> {
    this.ensureInitialized();
    return await universityManagementService.getUniversityRecords();
  }

  // ============================================================================
  // STUDENT MANAGEMENT
  // ============================================================================

  /**
   * Register a student
   */
  async registerStudent(
    studentId: string,
    studentAddress?: string
  ): Promise<void> {
    this.ensureInitialized();
    return await studentManagementService.registerStudent(
      studentId,
      studentAddress
    );
  }

  /**
   * Get student ID by address
   */
  async getStudentId(address: string): Promise<string> {
    this.ensureInitialized();
    return await studentManagementService.getStudentId(address);
  }

  /**
   * Check if current user is registered student
   */
  async isCurrentUserRegistered(): Promise<boolean> {
    this.ensureInitialized();
    return await studentManagementService.isCurrentUserRegistered();
  }

  // ============================================================================
  // RECORD MANAGEMENT WITH ZKP
  // ============================================================================

  /**
   * Add a new record with ZKP encryption
   */
  async addRecord(
    studentId: string,
    studentName: string,
    studentAddress: string,
    universityName: string,
    file: File,
    metadataHash: string,
    recordType: number
  ): Promise<number> {
    this.ensureInitialized();

    try {
      // Upload file with encryption
      const encryptedData = await encryptedIPFSService.uploadEncryptedFile(
        file,
        0, // Temporary record ID, will be updated
        studentAddress
      );

      // Add record to blockchain with encrypted hash
      const recordId = await recordsManagementService.addRecord(
        studentId,
        studentName,
        studentAddress,
        universityName,
        encryptedData.encryptedHash, // Store encrypted IPFS hash
        metadataHash,
        recordType
      );

      return recordId;
    } catch (error) {
      console.error("Failed to add encrypted record:", error);
      throw new Error("Failed to add record with encryption");
    }
  }

  /**
   * Get a record with ZKP access verification
   */
  async getRecord(recordId: number): Promise<Record> {
    this.ensureInitialized();
    return await recordsManagementService.getRecord(recordId);
  }

  /**
   * Get student records
   */
  async getStudentRecords(studentId: string): Promise<number[]> {
    this.ensureInitialized();
    return await recordsManagementService.getStudentRecords(studentId);
  }

  /**
   * Get student records by address
   */
  async getStudentRecordsByAddress(address: string): Promise<number[]> {
    this.ensureInitialized();
    return await recordsManagementService.getStudentRecordsByAddress(address);
  }

  /**
   * Access encrypted record using ZKP
   */
  async accessEncryptedRecord(recordId: number): Promise<string> {
    this.ensureInitialized();

    try {
      const userAddress = await this.getCurrentAddress();

      // Request access using ZKP
      const accessGranted = await zkpService.requestRecordAccess(
        recordId,
        ZKAccessType.STUDENT_ACCESS
      );

      if (!accessGranted) {
        throw new Error("Access denied by ZKP verification");
      }

      // Get the record to retrieve encrypted IPFS hash
      const record = await this.getRecord(recordId);

      // Create encrypted data structure (this would normally come from contract)
      const encryptedData: EncryptedIPFSData = {
        encryptedHash: record.ipfsHash,
        encryptionKey: "key", // This would come from access manager contract
        accessProof: zkpService.getUserKeys()?.zkpIdentity as any, // Simplified
        publicSignals: {
          userAddress,
          recordId: recordId.toString(),
          accessType: ZKAccessType.STUDENT_ACCESS,
          timestamp: Date.now().toString(),
        },
      };

      // Decrypt and return the original IPFS hash
      return await encryptedIPFSService.retrieveDecryptedFile(
        encryptedData,
        userAddress
      );
    } catch (error) {
      console.error("Failed to access encrypted record:", error);
      throw new Error("Failed to access encrypted record");
    }
  }

  /**
   * Share record with ZKP
   */
  async shareRecord(
    recordId: number,
    sharedWithAddress: string
  ): Promise<void> {
    this.ensureInitialized();

    try {
      // Use ZKP-based sharing
      const shared = await zkpService.shareRecord(recordId, sharedWithAddress);

      if (!shared) {
        throw new Error("Failed to share record using ZKP");
      }

      // Also share in the traditional contract (for backward compatibility)
      await recordsManagementService.shareRecord(recordId, sharedWithAddress);
    } catch (error) {
      console.error("Failed to share record:", error);
      throw new Error("Failed to share record");
    }
  }

  /**
   * Unshare record
   */
  async unshareRecord(
    recordId: number,
    sharedWithAddress: string
  ): Promise<void> {
    this.ensureInitialized();
    return await recordsManagementService.unshareRecord(
      recordId,
      sharedWithAddress
    );
  }

  /**
   * Get shared records
   */
  async getSharedRecords(sharedWithAddress: string): Promise<number[]> {
    this.ensureInitialized();
    return await recordsManagementService.getSharedRecords(sharedWithAddress);
  }

  /**
   * Check if record is shared with user
   */
  async isRecordSharedWith(
    recordId: number,
    userAddress: string
  ): Promise<boolean> {
    this.ensureInitialized();
    return await recordsManagementService.isRecordSharedWith(
      recordId,
      userAddress
    );
  }

  /**
   * Verify record authenticity
   */
  async verifyRecord(recordId: number): Promise<boolean> {
    this.ensureInitialized();
    return await recordsManagementService.verifyRecord(recordId);
  }

  /**
   * Record access for analytics
   */
  async recordAccess(recordId: number): Promise<void> {
    this.ensureInitialized();
    return await recordsManagementService.recordAccess(recordId);
  }

  // ============================================================================
  // ZKP OPERATIONS
  // ============================================================================

  /**
   * Generate user encryption keys
   */
  async generateUserKeys(): Promise<void> {
    this.ensureInitialized();
    await zkpService.generateUserKeys();
  }

  /**
   * Check if user has verified access to record
   */
  async hasVerifiedAccess(
    recordId: number,
    userAddress?: string
  ): Promise<boolean> {
    this.ensureInitialized();
    return await zkpService.hasVerifiedAccess(recordId, userAddress);
  }

  // ============================================================================
  // UTILITY OPERATIONS
  // ============================================================================

  /**
   * Get total records count
   */
  async getTotalRecords(): Promise<number> {
    this.ensureInitialized();
    return await recordsManagementService.getTotalRecords();
  }

  /**
   * Add custom record type
   */
  async addCustomRecordType(
    name: string,
    description: string
  ): Promise<number> {
    this.ensureInitialized();
    return await recordsManagementService.addCustomRecordType(
      name,
      description
    );
  }

  /**
   * Get current user's accessible records
   */
  async getCurrentUserAccessibleRecords(): Promise<number[]> {
    this.ensureInitialized();
    return await recordsManagementService.getCurrentUserAccessibleRecords();
  }

  /**
   * Search records
   */
  async searchRecords(
    searchTerm: string,
    recordIds?: number[]
  ): Promise<Record[]> {
    this.ensureInitialized();
    return await recordsManagementService.searchRecords(searchTerm, recordIds);
  }

  /**
   * Get records by type
   */
  async getRecordsByType(
    recordType: number,
    recordIds?: number[]
  ): Promise<Record[]> {
    this.ensureInitialized();
    return await recordsManagementService.getRecordsByType(
      recordType,
      recordIds
    );
  }

  /**
   * Batch get records
   */
  async getRecordsBatch(recordIds: number[]): Promise<Record[]> {
    this.ensureInitialized();
    return await recordsManagementService.getRecordsBatch(recordIds);
  }

  // ============================================================================
  // SERVICE HEALTH CHECK
  // ============================================================================

  /**
   * Check the health of all services
   */
  async healthCheck(): Promise<{
    wallet: boolean;
    roleManagement: boolean;
    universityManagement: boolean;
    studentManagement: boolean;
    recordsManagement: boolean;
    zkp: boolean;
  }> {
    return {
      wallet: walletService.isConnected(),
      roleManagement: roleManagementService.isInitialized(),
      universityManagement: universityManagementService.isInitialized(),
      studentManagement: studentManagementService.isInitialized(),
      recordsManagement: recordsManagementService.isInitialized(),
      zkp: zkpService?.getUserKeys() !== null,
    };
  }

  /**
   * Get service information
   */
  getServiceInfo(): {
    isInitialized: boolean;
    walletConnected: boolean;
    currentAddress?: string;
  } {
    return {
      isInitialized: this.isInitialized,
      walletConnected: walletService.isConnected(),
      currentAddress: walletService.isConnected() ? undefined : "Not connected",
    };
  }
}

// Export singleton instance
export const blockchainService = new BlockchainService();
