import { ethers } from "ethers";
import AcademicRecordsABI from "@/contracts/AcademicRecords.json";

export interface Record {
  id: number;
  studentName: string;
  studentId: string;
  recordType: number;
  dataHash: string;
  timestamp: number;
  university: string;
  isValid: boolean;
  universityName: string;
}

export interface University {
  address: string;
  name: string;
}

class BlockchainService {
  private provider: ethers.BrowserProvider | null = null;
  private signer: ethers.Signer | null = null;
  private contract: ethers.Contract | null = null;
  private contractAddress: string =
    process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "";

  private ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_ROLE"));
  private UNIVERSITY_ROLE = ethers.keccak256(
    ethers.toUtf8Bytes("UNIVERSITY_ROLE")
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
        AcademicRecordsABI.abi,
        this.signer
      );

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
    role: "ADMIN_ROLE" | "UNIVERSITY_ROLE",
    address: string
  ): Promise<boolean> {
    this.ensureContract();
    const roleHash =
      role === "ADMIN_ROLE" ? this.ADMIN_ROLE : this.UNIVERSITY_ROLE;
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
    universityName: string,
    ipfsHash: string,
    metadataHash: string,
    recordType: number
  ): Promise<number> {
    this.ensureContract();
    const tx = await this.contract!.addRecord(
      studentId,
      studentName,
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
      recordType: Number(record.recordType),
      dataHash: record.ipfsHash,
      timestamp: Number(record.timestamp),
      university: record.issuer,
      isValid: record.isVerified,
      universityName: record.universityName,
    };
  }

  async getStudentRecords(studentId: string): Promise<number[]> {
    this.ensureContract();
    const recordIds = await this.contract!.getStudentRecords(studentId);
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
}

export const blockchainService = new BlockchainService();
