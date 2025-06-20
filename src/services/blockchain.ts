import { ethers } from "ethers";
import AcademicRecordsABI from "@/contracts/AcademicRecords.json";

interface Record {
  id: number;
  studentName: string;
  studentId: string;
  recordType: number;
  dataHash: string;
  timestamp: number;
  university: string;
  isValid: boolean;
  universityName?: string;
}

interface University {
  address: string;
  name: string;
}

class BlockchainService {
  private provider: ethers.BrowserProvider | null = null;
  private signer: ethers.Signer | null = null;
  private contract: ethers.Contract | null = null;
  private contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "";
  private connected = false;

  // Role constants
  private ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_ROLE"));
  private UNIVERSITY_ROLE = ethers.keccak256(
    ethers.toUtf8Bytes("UNIVERSITY_ROLE")
  );

  // University name mapping (in a real app, this would come from a database)
  private universityNames: Map<string, string> = new Map();

  constructor() {
    // Initialize on class instantiation
  }

  async init(): Promise<boolean> {
    try {
      // Check if MetaMask is installed
      if (typeof window === "undefined" || !window.ethereum) {
        console.error("MetaMask is not installed");
        return false;
      }

      // Initialize provider
      this.provider = new ethers.BrowserProvider(window.ethereum);

      // Request account access
      await this.provider.send("eth_requestAccounts", []);

      // Get signer
      this.signer = await this.provider.getSigner();

      // Initialize contract
      if (!this.contractAddress) {
        console.error("Contract address not provided");
        return false;
      }

      this.contract = new ethers.Contract(
        this.contractAddress,
        AcademicRecordsABI.abi,
        this.signer
      );

      this.connected = true;
      return true;
    } catch (error) {
      console.error("Error initializing blockchain service:", error);
      return false;
    }
  }

  async getAddress(): Promise<string> {
    if (!this.signer) {
      throw new Error("Blockchain service not initialized");
    }

    return await this.signer.getAddress();
  }

  async hasRole(role: string, address: string): Promise<boolean> {
    if (!this.contract) {
      throw new Error("Contract not initialized");
    }

    const roleHash =
      role === "ADMIN_ROLE" ? this.ADMIN_ROLE : this.UNIVERSITY_ROLE;
    return await this.contract.hasRole(roleHash, address);
  }

  async getUniversityRecords(): Promise<number[]> {
    if (!this.contract || !this.signer) {
      throw new Error("Contract not initialized");
    }

    const address = await this.signer.getAddress();
    const recordIds = await this.contract.getUniversityRecords(address);
    return recordIds.map((id: bigint) => Number(id));
  }

  async getStudentRecords(studentId: string): Promise<number[]> {
    if (!this.contract) {
      throw new Error("Contract not initialized");
    }

    const recordIds = await this.contract.getStudentRecords(studentId);
    return recordIds.map((id: bigint) => Number(id));
  }

  async getRecord(recordId: number): Promise<Record> {
    if (!this.contract) {
      throw new Error("Contract not initialized");
    }

    const record = await this.contract.getRecord(recordId);
    return {
      id: recordId,
      studentName: record.studentName,
      studentId: record.studentId,
      recordType: Number(record.recordType),
      dataHash: record.ipfsHash,
      timestamp: Number(record.timestamp),
      university: record.issuer,
      isValid: record.isVerified,
      universityName: record.universityName
    };
  }

  async addRecord(
    studentName: string,
    studentId: string,
    recordType: number,
    dataHash: string
  ): Promise<number> {
    if (!this.contract) {
      throw new Error("Contract not initialized");
    }

    const tx = await this.contract.addRecord(
      studentName,
      studentId,
      recordType,
      dataHash
    );
    const receipt = await tx.wait();

    // Get the record ID from the event
    const event = receipt.logs?.find((log: any) => {
      try {
        const parsedLog = this.contract?.interface.parseLog(log);
        return parsedLog?.name === "RecordAdded";
      } catch {
        return false;
      }
    });

    if (!event) {
      throw new Error("Record added but event not found");
    }

    const parsedEvent = this.contract?.interface.parseLog(event);
    return Number(parsedEvent?.args.recordId);
  }

  async verifyRecord(recordId: number): Promise<boolean> {
    if (!this.contract) {
      throw new Error("Contract not initialized");
    }

    const record = await this.getRecord(recordId);
    return record.isValid;
  }

  async deleteRecord(recordId: number): Promise<void> {
    if (!this.contract) {
      throw new Error("Contract not initialized");
    }

    const tx = await this.contract.invalidateRecord(recordId);
    await tx.wait();
  }

  // Admin functions
  async addUniversity(universityAddress: string): Promise<void> {
    if (!this.contract) {
      throw new Error("Contract not initialized");
    }

    const tx = await this.contract.addUniversity(universityAddress);
    await tx.wait();
  }

  async removeUniversity(universityAddress: string): Promise<void> {
    if (!this.contract) {
      throw new Error("Contract not initialized");
    }

    const tx = await this.contract.removeUniversity(universityAddress);
    await tx.wait();
  }

  async pauseContract(): Promise<void> {
    if (!this.contract) {
      throw new Error("Contract not initialized");
    }

    const tx = await this.contract.pause();
    await tx.wait();
  }

  async unpauseContract(): Promise<void> {
    if (!this.contract) {
      throw new Error("Contract not initialized");
    }

    const tx = await this.contract.unpause();
    await tx.wait();
  }

  async isContractPaused(): Promise<boolean> {
    if (!this.contract) {
      throw new Error("Contract not initialized");
    }

    return await this.contract.paused();
  }

  // University name management (in a real app, this would use a database)
  setUniversityName(address: string, name: string): void {
    this.universityNames.set(address.toLowerCase(), name);
  }

  getUniversityName(address: string): string {
    return this.universityNames.get(address.toLowerCase()) || "Unknown University";
  }

  isConnected(): boolean {
    return this.connected;
  }
}

export const blockchainService = new BlockchainService();
