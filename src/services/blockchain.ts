import { ethers } from "ethers";
import AcademicRecords from "../contracts/AcademicRecords.json";
import IAcademicRecords from "../contracts/IAcademicRecords.json";
import RoleManager from "../contracts/RoleManager.json";
import StudentManagement from "../contracts/StudentManagement.json";
import ZKPManager from "../contracts/ZKPManager.json";
import AccessManager from "../contracts/AccessManager.json";
import KeyStorage from "../contracts/KeyStorage.json";
import { Record, CustomRecordType } from "../types/records";
import { zkpService, ZKProof, AccessVerificationInput, RecordSharingInput } from "./zkp";
import { encryptionService, EncryptedData } from "./encryption";
import { accessTokenService, AccessToken, SharingTokenRequest, AccessAction } from "./accessToken";

export interface University {
  address: string;
  name: string;
}

class BlockchainService {
  private provider: ethers.BrowserProvider | null = null;
  private signer: ethers.Signer | null = null;
  private contract: ethers.Contract | null = null;
  private studentManagementContract: ethers.Contract | null = null;
  private zkpManagerContract: ethers.Contract | null = null;
  private accessManagerContract: ethers.Contract | null = null;
  private keyStorageContract: ethers.Contract | null = null;

  private contractAddress: string =
    process.env.NEXT_PUBLIC_ACADEMIC_RECORDS_CONTRACT_ADDRESS || "";
  private studentManagementAddress: string =
    process.env.NEXT_PUBLIC_STUDENT_MANAGEMENT_CONTRACT_ADDRESS || "";
  private zkpManagerAddress: string =
    process.env.NEXT_PUBLIC_ZKP_MANAGER_CONTRACT_ADDRESS || "";
  private accessManagerAddress: string =
    process.env.NEXT_PUBLIC_ACCESS_MANAGER_CONTRACT_ADDRESS || "";
  private keyStorageAddress: string =
    process.env.NEXT_PUBLIC_KEY_STORAGE_CONTRACT_ADDRESS || "";

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

      // Initialize ZKP contracts if addresses are available
      if (this.zkpManagerAddress) {
        this.zkpManagerContract = new ethers.Contract(
          this.zkpManagerAddress,
          ZKPManager.abi,
          this.signer
        );
      }

      if (this.accessManagerAddress) {
        this.accessManagerContract = new ethers.Contract(
          this.accessManagerAddress,
          AccessManager.abi,
          this.signer
        );
      }

      if (this.keyStorageAddress) {
        this.keyStorageContract = new ethers.Contract(
          this.keyStorageAddress,
          KeyStorage.abi,
          this.signer
        );
      }

      // Initialize ZKP service
      await zkpService.initialize();

      return true;
    } catch (error) {
      console.error("Blockchain initialization failed:", error);
      return false;
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

  // ZKP-enabled secure record creation
  async addSecureRecord(
    studentId: string,
    studentName: string,
    studentAddress: string,
    universityName: string,
    ipfsHash: string,
    metadataHash: string,
    recordType: number
  ): Promise<number> {
    try {
      this.ensureContract();
      const currentAddress = await this.getCurrentAddress();

      // First create the regular record
      const recordId = await this.addRecord(
        studentId,
        studentName,
        studentAddress,
        universityName,
        ipfsHash,
        metadataHash,
        recordType
      );

      // If ZKP contracts are available, add encryption and access control
      if (this.zkpManagerContract && this.keyStorageContract) {
        // Encrypt the IPFS hash
        const encryptedIPFS = await encryptionService.encryptIPFSHash(
          ipfsHash,
          recordId,
          currentAddress
        );

        // Encrypt metadata if provided
        let encryptedMetadata: EncryptedData | undefined;
        if (metadataHash) {
          encryptedMetadata = await encryptionService.encryptIPFSHash(
            metadataHash,
            recordId,
            currentAddress
          );
        }

        // Store encryption keys with authorized users
        const authorizedUsers = [currentAddress, studentAddress];
        await this.storeEncryptionKey(recordId, encryptedIPFS, authorizedUsers);

        // Grant access permissions
        if (this.accessManagerContract) {
          // Grant access to student
          await this.grantRecordAccess(recordId, studentAddress, 0, 0); // OWNER type, no expiry

          // Grant access to issuer (university)
          await this.grantRecordAccess(recordId, currentAddress, 0, 0); // OWNER type, no expiry
        }

        console.log(`✅ Secure record created with ID: ${recordId}`);
      }

      return recordId;
    } catch (error) {
      console.error('❌ Failed to create secure record:', error);
      throw error;
    }
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

  // ZKP-enabled secure record retrieval
  async getSecureRecord(recordId: number, accessToken?: string): Promise<Record> {
    try {
      const currentAddress = await this.getCurrentAddress();

      // Verify access using ZKP
      const hasAccess = await this.verifyRecordAccess(recordId, currentAddress, accessToken);

      if (!hasAccess) {
        throw new Error('Access denied: Invalid ZK proof or insufficient permissions');
      }

      // Get the basic record
      const record = await this.getRecord(recordId);

      // If ZKP contracts are available, decrypt the IPFS hash
      if (this.keyStorageContract && this.zkpManagerContract) {
        try {
          // Get encrypted key
          const encryptedKey = await this.getEncryptionKey(recordId, currentAddress);

          if (encryptedKey && encryptedKey.length > 0) {
            // Decrypt IPFS hash
            const decryptedIPFS = await encryptionService.decryptIPFSHash(
              JSON.parse(ethers.toUtf8String(encryptedKey)),
              recordId,
              currentAddress,
              record.university
            );

            // Update record with decrypted IPFS hash
            record.ipfsHash = decryptedIPFS;
          }
        } catch (decryptError) {
          console.warn('⚠️ Failed to decrypt IPFS hash, using original:', decryptError);
          // Fallback to original record data
        }
      }

      // Log access event
      await this.logRecordAccess(recordId, currentAddress, 'VIEW');

      return record;
    } catch (error) {
      console.error('❌ Failed to get secure record:', error);
      throw error;
    }
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

  // ZKP-enabled secure record retrieval methods with fallback mechanisms

  async getSecureStudentRecords(studentId: string, accessToken?: string): Promise<Record[]> {
    try {
      const recordIds = await this.getStudentRecords(studentId);
      const records: Record[] = [];

      for (const recordId of recordIds) {
        try {
          const record = await this.getSecureRecord(recordId, accessToken);
          records.push(record);
        } catch (error) {
          console.warn(`⚠️ Failed to get secure record ${recordId}, trying fallback:`, error);

          // Fallback to regular record retrieval
          try {
            const fallbackRecord = await this.getRecord(recordId);
            records.push(fallbackRecord);
          } catch (fallbackError) {
            console.error(`❌ Failed to get record ${recordId} even with fallback:`, fallbackError);
            // Skip this record but continue with others
          }
        }
      }

      return records;
    } catch (error) {
      console.error('❌ Failed to get secure student records:', error);

      // Complete fallback to regular method
      const recordIds = await this.getStudentRecords(studentId);
      const fallbackRecords: Record[] = [];

      for (const recordId of recordIds) {
        try {
          const record = await this.getRecord(recordId);
          fallbackRecords.push(record);
        } catch (recordError) {
          console.error(`❌ Failed to get fallback record ${recordId}:`, recordError);
        }
      }

      return fallbackRecords;
    }
  }

  async getSecureStudentRecordsByAddress(address: string, accessToken?: string): Promise<Record[]> {
    try {
      const recordIds = await this.getStudentRecordsByAddress(address);
      const records: Record[] = [];

      for (const recordId of recordIds) {
        try {
          const record = await this.getSecureRecord(recordId, accessToken);
          records.push(record);
        } catch (error) {
          console.warn(`⚠️ Failed to get secure record ${recordId}, trying fallback:`, error);

          // Fallback to regular record retrieval
          try {
            const fallbackRecord = await this.getRecord(recordId);
            records.push(fallbackRecord);
          } catch (fallbackError) {
            console.error(`❌ Failed to get record ${recordId} even with fallback:`, fallbackError);
          }
        }
      }

      return records;
    } catch (error) {
      console.error('❌ Failed to get secure student records by address:', error);

      // Complete fallback to regular method
      const recordIds = await this.getStudentRecordsByAddress(address);
      const fallbackRecords: Record[] = [];

      for (const recordId of recordIds) {
        try {
          const record = await this.getRecord(recordId);
          fallbackRecords.push(record);
        } catch (recordError) {
          console.error(`❌ Failed to get fallback record ${recordId}:`, recordError);
        }
      }

      return fallbackRecords;
    }
  }

  async getSecureUniversityRecords(accessToken?: string): Promise<Record[]> {
    try {
      const recordIds = await this.getUniversityRecords();
      const records: Record[] = [];

      for (const recordId of recordIds) {
        try {
          const record = await this.getSecureRecord(recordId, accessToken);
          records.push(record);
        } catch (error) {
          console.warn(`⚠️ Failed to get secure record ${recordId}, trying fallback:`, error);

          // Fallback to regular record retrieval
          try {
            const fallbackRecord = await this.getRecord(recordId);
            records.push(fallbackRecord);
          } catch (fallbackError) {
            console.error(`❌ Failed to get record ${recordId} even with fallback:`, fallbackError);
          }
        }
      }

      return records;
    } catch (error) {
      console.error('❌ Failed to get secure university records:', error);

      // Complete fallback to regular method
      const recordIds = await this.getUniversityRecords();
      const fallbackRecords: Record[] = [];

      for (const recordId of recordIds) {
        try {
          const record = await this.getRecord(recordId);
          fallbackRecords.push(record);
        } catch (recordError) {
          console.error(`❌ Failed to get fallback record ${recordId}:`, recordError);
        }
      }

      return fallbackRecords;
    }
  }

  // Get shared records with ZKP access verification
  async getSecureSharedRecords(sharedWithAddress: string, accessToken?: string): Promise<Record[]> {
    try {
      const recordIds = await this.getSharedRecords(sharedWithAddress);
      const records: Record[] = [];

      for (const recordId of recordIds) {
        try {
          // Verify access before retrieving
          const hasAccess = await this.verifyRecordAccess(recordId, sharedWithAddress, accessToken);

          if (hasAccess) {
            const record = await this.getSecureRecord(recordId, accessToken);
            records.push(record);
          } else {
            console.warn(`⚠️ Access denied for shared record ${recordId}`);
          }
        } catch (error) {
          console.warn(`⚠️ Failed to get secure shared record ${recordId}:`, error);

          // Fallback to regular record retrieval if user has basic sharing access
          try {
            const isShared = await this.isRecordSharedWith(recordId, sharedWithAddress);
            if (isShared) {
              const fallbackRecord = await this.getRecord(recordId);
              records.push(fallbackRecord);
            }
          } catch (fallbackError) {
            console.error(`❌ Failed to get shared record ${recordId} even with fallback:`, fallbackError);
          }
        }
      }

      return records;
    } catch (error) {
      console.error('❌ Failed to get secure shared records:', error);

      // Complete fallback to regular method
      try {
        const recordIds = await this.getSharedRecords(sharedWithAddress);
        const fallbackRecords: Record[] = [];

        for (const recordId of recordIds) {
          try {
            const record = await this.getRecord(recordId);
            fallbackRecords.push(record);
          } catch (recordError) {
            console.error(`❌ Failed to get fallback shared record ${recordId}:`, recordError);
          }
        }

        return fallbackRecords;
      } catch (fallbackError) {
        console.error('❌ Complete fallback failed for shared records:', fallbackError);
        return [];
      }
    }
  }

  // Enhanced record verification with ZKP
  async verifySecureRecord(recordId: number, accessToken?: string): Promise<boolean> {
    try {
      const currentAddress = await this.getCurrentAddress();

      // First verify access
      const hasAccess = await this.verifyRecordAccess(recordId, currentAddress, accessToken);
      if (!hasAccess) {
        return false;
      }

      // Then verify the record itself
      const isValid = await this.verifyRecord(recordId);

      // Log verification event
      await this.logRecordAccess(recordId, currentAddress, 'VERIFY');

      return isValid;
    } catch (error) {
      console.error('❌ Failed to verify secure record:', error);

      // Fallback to regular verification
      try {
        return await this.verifyRecord(recordId);
      } catch (fallbackError) {
        console.error('❌ Fallback verification failed:', fallbackError);
        return false;
      }
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

  // ZKP Contract Interaction Methods

  private ensureZKPContracts() {
    if (!this.zkpManagerContract) {
      throw new Error('ZKP Manager contract not initialized');
    }
    if (!this.accessManagerContract) {
      throw new Error('Access Manager contract not initialized');
    }
    if (!this.keyStorageContract) {
      throw new Error('Key Storage contract not initialized');
    }
  }

  // Generate and store ZK proof for record access
  async generateAccessProof(recordId: number, accessType: number = 0): Promise<string> {
    try {
      this.ensureZKPContracts();
      const currentAddress = await this.getCurrentAddress();
      const record = await this.getRecord(recordId);

      // Prepare ZK proof input
      const accessInput: AccessVerificationInput = {
        recordId: recordId.toString(),
        userAddress: currentAddress,
        issuerAddress: record.university,
        studentAddress: record.studentAddress,
        accessType: accessType.toString(),
        timestamp: Math.floor(Date.now() / 1000).toString(),
        accessSecret: this.generateAccessSecret()
      };

      // Generate ZK proof
      const zkProof = await zkpService.generateAccessProof(accessInput);

      // Convert proof to contract format
      const proofArgs = this.formatProofForContract(zkProof);

      // Submit proof to contract
      const tx = await this.zkpManagerContract!.generateAccessProof(
        recordId,
        currentAddress,
        proofArgs.a,
        proofArgs.b,
        proofArgs.c,
        proofArgs.publicInputs
      );

      const receipt = await tx.wait();
      const event = receipt.logs?.find((log: any) => {
        try {
          const parsed = this.zkpManagerContract!.interface.parseLog(log);
          return parsed?.name === "ProofGenerated";
        } catch {
          return false;
        }
      });

      if (!event) throw new Error("ProofGenerated event not found");
      const parsedEvent = this.zkpManagerContract!.interface.parseLog(event);
      return parsedEvent?.args.proofHash;
    } catch (error) {
      console.error('❌ Failed to generate access proof:', error);
      throw error;
    }
  }

  // Verify ZK proof for record access
  async verifyRecordAccess(recordId: number, userAddress: string, accessToken?: string): Promise<boolean> {
    try {
      // If access token is provided, validate it first
      if (accessToken) {
        const tokenValidation = await accessTokenService.validateAccessToken(
          accessToken,
          userAddress,
          AccessAction.VIEW
        );

        if (tokenValidation.isValid) {
          return true;
        }
      }

      // Check direct access permissions
      if (this.accessManagerContract) {
        const hasDirectAccess = await this.accessManagerContract.hasAccess(recordId, userAddress);
        if (hasDirectAccess) {
          return true;
        }
      }

      // For fallback, check if user is owner or issuer
      const record = await this.getRecord(recordId);
      const currentAddress = await this.getCurrentAddress();

      return (
        userAddress.toLowerCase() === record.studentAddress.toLowerCase() ||
        userAddress.toLowerCase() === record.university.toLowerCase() ||
        userAddress.toLowerCase() === currentAddress.toLowerCase()
      );
    } catch (error) {
      console.error('❌ Failed to verify record access:', error);
      return false;
    }
  }

  // Store encryption key for record
  async storeEncryptionKey(recordId: number, encryptedData: EncryptedData, authorizedUsers: string[]): Promise<void> {
    try {
      this.ensureZKPContracts();

      const encryptedKeyBytes = ethers.toUtf8Bytes(JSON.stringify(encryptedData));

      const tx = await this.keyStorageContract!.storeEncryptedKey(
        recordId,
        encryptedKeyBytes,
        authorizedUsers
      );

      await tx.wait();
      console.log(`✅ Encryption key stored for record ${recordId}`);
    } catch (error) {
      console.error('❌ Failed to store encryption key:', error);
      throw error;
    }
  }

  // Get encryption key for record
  async getEncryptionKey(recordId: number, userAddress: string): Promise<Uint8Array | null> {
    try {
      this.ensureZKPContracts();

      const encryptedKey = await this.keyStorageContract!.getEncryptedKey(recordId, userAddress);
      return encryptedKey;
    } catch (error) {
      console.error('❌ Failed to get encryption key:', error);
      return null;
    }
  }

  // Grant access to a record
  async grantRecordAccess(recordId: number, userAddress: string, accessType: number, duration: number): Promise<void> {
    try {
      this.ensureZKPContracts();

      if (duration > 0) {
        const tx = await this.accessManagerContract!.grantAccess(recordId, userAddress, duration, accessType);
        await tx.wait();
      } else {
        const tx = await this.accessManagerContract!.grantAccessWithDefaultDuration(recordId, userAddress, accessType);
        await tx.wait();
      }

      console.log(`✅ Access granted to ${userAddress} for record ${recordId}`);
    } catch (error) {
      console.error('❌ Failed to grant record access:', error);
      throw error;
    }
  }

  // Revoke access to a record
  async revokeRecordAccess(recordId: number, userAddress: string): Promise<void> {
    try {
      this.ensureZKPContracts();

      const tx = await this.accessManagerContract!.revokeAccess(recordId, userAddress);
      await tx.wait();

      console.log(`✅ Access revoked for ${userAddress} on record ${recordId}`);
    } catch (error) {
      console.error('❌ Failed to revoke record access:', error);
      throw error;
    }
  }

  // Log access event
  async logRecordAccess(recordId: number, userAddress: string, action: string): Promise<void> {
    try {
      if (this.accessManagerContract) {
        const proofHash = ethers.keccak256(ethers.toUtf8Bytes(`${recordId}-${userAddress}-${action}-${Date.now()}`));
        const tx = await this.accessManagerContract.logAccess(recordId, userAddress, action, proofHash);
        await tx.wait();
      }
    } catch (error) {
      console.warn('⚠️ Failed to log access event:', error);
      // Don't throw here as this is non-critical
    }
  }

  // Helper methods
  private generateAccessSecret(): string {
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    return Array.from(randomBytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  private formatProofForContract(zkProof: ZKProof): any {
    return {
      a: [zkProof.proof.pi_a[0], zkProof.proof.pi_a[1]],
      b: [[zkProof.proof.pi_b[0][1], zkProof.proof.pi_b[0][0]], [zkProof.proof.pi_b[1][1], zkProof.proof.pi_b[1][0]]],
      c: [zkProof.proof.pi_c[0], zkProof.proof.pi_c[1]],
      publicInputs: [zkProof.publicSignals[0] || "0", zkProof.publicSignals[1] || "0"]
    };
  }

  // ZKP-enabled sharing and access control methods

  // Create secure sharing token with ZK proof
  async createSecureSharingToken(
    recordId: number,
    sharedWithAddress: string,
    duration: number,
    permissions: AccessAction[] = [AccessAction.VIEW, AccessAction.VERIFY]
  ): Promise<AccessToken> {
    try {
      const currentAddress = await this.getCurrentAddress();
      const record = await this.getRecord(recordId);

      // Verify that current user can share this record
      const canShare = await this.verifyRecordAccess(recordId, currentAddress);
      if (!canShare) {
        throw new Error('Access denied: Cannot share record without proper permissions');
      }

      // Generate sharing proof
      const sharingInput: RecordSharingInput = {
        recordId: recordId.toString(),
        ownerAddress: currentAddress,
        sharedWithAddress: sharedWithAddress,
        expiryTime: (Math.floor(Date.now() / 1000) + duration).toString(),
        currentTime: Math.floor(Date.now() / 1000).toString(),
        shareSecret: this.generateAccessSecret(),
        userAddress: currentAddress
      };

      const sharingProof = await zkpService.generateSharingProof(sharingInput);

      // Create sharing token using access token service
      const tokenRequest: SharingTokenRequest = {
        recordId,
        sharedWithAddress,
        duration,
        permissions,
        ownerAddress: currentAddress,
        shareSecret: sharingInput.shareSecret
      };

      const accessToken = await accessTokenService.createSharingToken(tokenRequest);

      // If ZKP contracts are available, create on-chain sharing token
      if (this.zkpManagerContract) {
        try {
          const proofArgs = this.formatProofForContract(sharingProof);
          const proofHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(proofArgs)));

          const tx = await this.zkpManagerContract.createSharingToken(
            recordId,
            sharedWithAddress,
            duration,
            100, // maxUsage
            proofHash
          );

          await tx.wait();
          console.log(`✅ On-chain sharing token created for record ${recordId}`);
        } catch (contractError) {
          console.warn('⚠️ Failed to create on-chain sharing token, using off-chain only:', contractError);
        }
      }

      // Grant temporary access if access manager is available
      if (this.accessManagerContract) {
        try {
          await this.grantRecordAccess(recordId, sharedWithAddress, 1, duration); // SHARED type
        } catch (accessError) {
          console.warn('⚠️ Failed to grant on-chain access:', accessError);
        }
      }

      // Log sharing event
      await this.logRecordAccess(recordId, currentAddress, 'SHARE');

      console.log(`✅ Secure sharing token created: ${accessToken.tokenId}`);
      return accessToken;
    } catch (error) {
      console.error('❌ Failed to create secure sharing token:', error);
      throw error;
    }
  }

  // Validate sharing token and grant access
  async validateSharingToken(tokenId: string, userAddress: string, action: AccessAction): Promise<boolean> {
    try {
      const validation = await accessTokenService.validateAccessToken(tokenId, userAddress, action);

      if (validation.isValid && validation.token) {
        // Log token usage
        await this.logRecordAccess(validation.token.recordId, userAddress, `TOKEN_${action}`);
        return true;
      }

      return false;
    } catch (error) {
      console.error('❌ Failed to validate sharing token:', error);
      return false;
    }
  }

  // Revoke sharing token
  async revokeSharingToken(tokenId: string, reason?: string): Promise<boolean> {
    try {
      const currentAddress = await this.getCurrentAddress();
      const success = await accessTokenService.revokeAccessToken(tokenId, currentAddress, reason);

      if (success) {
        console.log(`✅ Sharing token revoked: ${tokenId}`);
      }

      return success;
    } catch (error) {
      console.error('❌ Failed to revoke sharing token:', error);
      return false;
    }
  }

  // Get sharing tokens for a record
  async getRecordSharingTokens(recordId: number): Promise<AccessToken[]> {
    try {
      const currentAddress = await this.getCurrentAddress();
      return accessTokenService.getTokensForRecord(recordId, currentAddress);
    } catch (error) {
      console.error('❌ Failed to get record sharing tokens:', error);
      return [];
    }
  }

  // Get tokens shared with current user
  async getUserSharingTokens(): Promise<AccessToken[]> {
    try {
      const currentAddress = await this.getCurrentAddress();
      return accessTokenService.getTokensForUser(currentAddress);
    } catch (error) {
      console.error('❌ Failed to get user sharing tokens:', error);
      return [];
    }
  }

  // Enhanced record sharing with ZKP
  async shareSecureRecord(
    recordId: number,
    sharedWithAddress: string,
    duration: number = 7 * 24 * 60 * 60, // 7 days default
    permissions: AccessAction[] = [AccessAction.VIEW, AccessAction.VERIFY]
  ): Promise<AccessToken> {
    try {
      // Create secure sharing token
      const accessToken = await this.createSecureSharingToken(recordId, sharedWithAddress, duration, permissions);

      // Also use the original sharing mechanism as fallback
      try {
        await this.shareRecord(recordId, sharedWithAddress);
      } catch (fallbackError) {
        console.warn('⚠️ Failed to create fallback sharing:', fallbackError);
      }

      return accessToken;
    } catch (error) {
      console.error('❌ Failed to share secure record:', error);
      throw error;
    }
  }

  // Enhanced record unsharing with ZKP
  async unshareSecureRecord(recordId: number, sharedWithAddress: string): Promise<void> {
    try {
      // Revoke access permissions
      if (this.accessManagerContract) {
        await this.revokeRecordAccess(recordId, sharedWithAddress);
      }

      // Revoke any active sharing tokens
      const currentAddress = await this.getCurrentAddress();
      const tokens = accessTokenService.getTokensForRecord(recordId, currentAddress);

      for (const token of tokens) {
        if (token.sharedWithAddress.toLowerCase() === sharedWithAddress.toLowerCase()) {
          await this.revokeSharingToken(token.tokenId, 'Record unshared');
        }
      }

      // Also use the original unsharing mechanism
      try {
        await this.unshareRecord(recordId, sharedWithAddress);
      } catch (fallbackError) {
        console.warn('⚠️ Failed to remove fallback sharing:', fallbackError);
      }

      // Log unsharing event
      await this.logRecordAccess(recordId, currentAddress, 'UNSHARE');

      console.log(`✅ Record ${recordId} unshared with ${sharedWithAddress}`);
    } catch (error) {
      console.error('❌ Failed to unshare secure record:', error);
      throw error;
    }
  }

  // Get access history for a record
  async getRecordAccessHistory(recordId: number): Promise<any[]> {
    try {
      if (this.accessManagerContract) {
        const history = await this.accessManagerContract.getAccessHistory(recordId);
        return history;
      }

      // Fallback to access token service audit log
      return accessTokenService.getAuditLog(recordId);
    } catch (error) {
      console.error('❌ Failed to get record access history:', error);
      return [];
    }
  }

  // Get user access statistics
  async getUserAccessStats(userAddress?: string): Promise<any> {
    try {
      const address = userAddress || await this.getCurrentAddress();

      if (this.accessManagerContract) {
        const stats = await this.accessManagerContract.getUserAccessStats(address);
        return {
          totalAccess: Number(stats.totalAccess),
          accessibleRecords: Number(stats.accessibleRecords),
          sharingTokenCount: Number(stats.sharingTokenCount)
        };
      }

      // Fallback to local statistics
      const tokens = accessTokenService.getTokensForUser(address);
      return {
        totalAccess: 0,
        accessibleRecords: 0,
        sharingTokenCount: tokens.length
      };
    } catch (error) {
      console.error('❌ Failed to get user access stats:', error);
      return {
        totalAccess: 0,
        accessibleRecords: 0,
        sharingTokenCount: 0
      };
    }
  }

  // Refresh sharing token (extend expiry)
  async refreshSharingToken(tokenId: string, additionalDuration: number): Promise<AccessToken> {
    try {
      const currentAddress = await this.getCurrentAddress();
      return await accessTokenService.refreshAccessToken(tokenId, currentAddress, additionalDuration);
    } catch (error) {
      console.error('❌ Failed to refresh sharing token:', error);
      throw error;
    }
  }

  // Cleanup expired tokens and access permissions
  async cleanupExpiredAccess(): Promise<number> {
    try {
      let cleanedCount = 0;

      // Cleanup access token service
      cleanedCount += accessTokenService.cleanupExpiredTokens();

      // If ZKP contracts are available, cleanup on-chain data
      if (this.zkpManagerContract) {
        try {
          // This would require getting expired proof hashes first
          // Implementation depends on contract design
          console.log('🧹 On-chain cleanup would be performed here');
        } catch (contractError) {
          console.warn('⚠️ Failed to cleanup on-chain data:', contractError);
        }
      }

      console.log(`🧹 Cleaned up ${cleanedCount} expired access items`);
      return cleanedCount;
    } catch (error) {
      console.error('❌ Failed to cleanup expired access:', error);
      return 0;
    }
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
}

export const blockchainService = new BlockchainService();
