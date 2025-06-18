import { ethers } from 'ethers';
import AcademicRecordsABI from '@/contracts/AcademicRecords.json';

// Types
export enum RecordType {
  TRANSCRIPT = 0,
  CERTIFICATE = 1,
  DEGREE = 2,
  OTHER = 3,
}

export interface Record {
  id: number;
  studentId: string;
  studentName: string;
  universityName: string;
  ipfsHash: string;
  metadataHash: string;
  recordType: RecordType;
  timestamp: number;
  isVerified: boolean;
  issuer: string;
}

class BlockchainService {
  private provider: ethers.BrowserProvider | null = null;
  private contract: ethers.Contract | null = null;
  private signer: ethers.Signer | null = null;
  
  // Contract address from environment variable
  private contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '';

  /**
   * Initialize the blockchain service
   */
  async init() {
    if (typeof window === 'undefined' || !window.ethereum) {
      throw new Error('MetaMask is not installed');
    }

    try {
      this.provider = new ethers.BrowserProvider(window.ethereum);
      this.signer = await this.provider.getSigner();
      this.contract = new ethers.Contract(
        this.contractAddress,
        AcademicRecordsABI.abi,
        this.signer
      );
      return true;
    } catch (error) {
      console.error('Failed to initialize blockchain service:', error);
      return false;
    }
  }

  /**
   * Get the connected wallet address
   */
  async getAddress(): Promise<string> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }
    return await this.signer.getAddress();
  }

  /**
   * Check if the user has a specific role
   */
  async hasRole(role: string, address: string): Promise<boolean> {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }
    return await this.contract.hasRole(ethers.keccak256(ethers.toUtf8Bytes(role)), address);
  }

  /**
   * Add a new academic record
   */
  async addRecord(
    studentId: string,
    studentName: string,
    universityName: string,
    ipfsHash: string,
    metadataHash: string,
    recordType: RecordType
  ): Promise<number> {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    const tx = await this.contract.addRecord(
      studentId,
      studentName,
      universityName,
      ipfsHash,
      metadataHash,
      recordType
    );

    const receipt = await tx.wait();
    const event = receipt.events.find((e: any) => e.event === 'RecordAdded');
    return event.args.recordId.toNumber();
  }

  /**
   * Get a record by ID
   */
  async getRecord(recordId: number): Promise<Record> {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    const record = await this.contract.getRecord(recordId);
    return this.formatRecord(record);
  }

  /**
   * Get all records for a student
   */
  async getStudentRecords(studentId: string): Promise<number[]> {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    const recordIds = await this.contract.getStudentRecords(studentId);
    return recordIds.map((id: ethers.BigNumberish) => Number(id));
  }

  /**
   * Get all records issued by the connected university
   */
  async getUniversityRecords(): Promise<number[]> {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    const recordIds = await this.contract.getUniversityRecords();
    return recordIds.map((id: ethers.BigNumberish) => Number(id));
  }

  /**
   * Verify a record
   */
  async verifyRecord(recordId: number): Promise<boolean> {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    return await this.contract.verifyRecord(recordId);
  }

  /**
   * Record an access to a document
   */
  async recordAccess(recordId: number): Promise<void> {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    const tx = await this.contract.recordAccess(recordId);
    await tx.wait();
  }

  /**
   * Format a record from the blockchain
   */
  private formatRecord(record: any): Record {
    return {
      id: Number(record.id),
      studentId: record.studentId,
      studentName: record.studentName,
      universityName: record.universityName,
      ipfsHash: record.ipfsHash,
      metadataHash: record.metadataHash,
      recordType: Number(record.recordType),
      timestamp: Number(record.timestamp),
      isVerified: record.isVerified,
      issuer: record.issuer,
    };
  }
}

// Export as singleton
export const blockchainService = new BlockchainService();