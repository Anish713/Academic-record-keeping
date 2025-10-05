import { zkpService } from "./zkp.service";
import {
  EncryptedIPFSData,
  RecordEncryptionMetadata,
  ZKProof,
  ZKPublicSignals,
  ZKAccessType,
} from "../../types/zkp";

/**
 * Encrypted IPFS Service
 * Handles secure storage and retrieval of documents using IPFS with ZKP-based access control
 */
export class EncryptedIPFSService {
  private pinataApiKey: string;
  private pinataSecretKey: string;
  private pinataGatewayUrl: string;

  constructor() {
    this.pinataApiKey = process.env.NEXT_PUBLIC_PINATA_API_KEY || "";
    this.pinataSecretKey = process.env.NEXT_PUBLIC_PINATA_API_SECRET_KEY || "";
    this.pinataGatewayUrl =
      process.env.NEXT_PUBLIC_PINATA_GATEWAY_URL ||
      "https://gateway.pinata.cloud";
  }

  /**
   * Upload and encrypt a file to IPFS
   * @param file - file to upload
   * @param recordId - associated record ID
   * @param ownerAddress - owner's wallet address
   * @returns Promise<EncryptedIPFSData>
   */
  async uploadEncryptedFile(
    file: File,
    recordId: number,
    ownerAddress: string
  ): Promise<EncryptedIPFSData> {
    try {
      // First, upload the original file to IPFS
      const originalIpfsHash = await this.uploadToIPFS(file);

      // Generate encryption key for this record
      const encryptionKey = await this.generateEncryptionKey();

      // Encrypt the IPFS hash
      const encryptedHash = await zkpService.encryptIPFSHash(
        originalIpfsHash,
        zkpService.getUserKeys()?.publicKey
      );

      // Generate access proof for the owner
      const { proof, publicSignals } = await zkpService.generateAccessProof(
        recordId,
        ZKAccessType.STUDENT_ACCESS,
        ownerAddress
      );

      // Create encrypted metadata
      const encryptedData: EncryptedIPFSData = {
        encryptedHash,
        encryptionKey,
        accessProof: proof,
        publicSignals,
      };

      // Store the encrypted metadata on IPFS as well
      const metadataHash = await this.uploadMetadataToIPFS(encryptedData);

      return {
        ...encryptedData,
        encryptedHash: metadataHash, // Return metadata hash instead of encrypted content hash
      };
    } catch (error) {
      console.error("Failed to upload encrypted file:", error);
      throw new Error("Encrypted file upload failed");
    }
  }

  /**
   * Retrieve and decrypt a file from IPFS
   * @param encryptedData - encrypted IPFS data
   * @param userAddress - requesting user's address
   * @returns Promise<string> - decrypted IPFS hash
   */
  async retrieveDecryptedFile(
    encryptedData: EncryptedIPFSData,
    userAddress: string
  ): Promise<string> {
    try {
      // Verify that the user has access using ZKP
      const verificationResult = await zkpService.verifyProof(
        encryptedData.accessProof,
        encryptedData.publicSignals,
        "accessVerification"
      );

      if (!verificationResult.isValid) {
        throw new Error("Access denied - invalid ZK proof");
      }

      // Check if the user address matches the proof
      if (
        verificationResult.userAddress.toLowerCase() !==
        userAddress.toLowerCase()
      ) {
        throw new Error("Access denied - user address mismatch");
      }

      // Decrypt the IPFS hash
      const decryptedHash = await zkpService.decryptIPFSHash(
        encryptedData.encryptedHash
      );

      return decryptedHash;
    } catch (error) {
      console.error("Failed to retrieve decrypted file:", error);
      throw new Error("Failed to access encrypted file");
    }
  }

  /**
   * Share encrypted access with another user
   * @param recordId - record ID
   * @param originalEncryptedData - original encrypted data
   * @param sharedWithAddress - address to share with
   * @param sharedWithPublicKey - recipient's public key
   * @returns Promise<EncryptedIPFSData>
   */
  async shareEncryptedAccess(
    recordId: number,
    originalEncryptedData: EncryptedIPFSData,
    sharedWithAddress: string,
    sharedWithPublicKey: string
  ): Promise<EncryptedIPFSData> {
    try {
      // Generate sharing proof
      const userAddress = await this.getCurrentAddress();
      const { proof, publicSignals } = await zkpService.generateSharingProof(
        recordId,
        sharedWithAddress,
        userAddress
      );

      // Decrypt the original hash with current user's key
      const originalHash = await zkpService.decryptIPFSHash(
        originalEncryptedData.encryptedHash
      );

      // Re-encrypt with the shared user's public key
      const reencryptedHash = await zkpService.encryptIPFSHash(
        originalHash,
        sharedWithPublicKey
      );

      // Create new encrypted data for the shared user
      const sharedEncryptedData: EncryptedIPFSData = {
        encryptedHash: reencryptedHash,
        encryptionKey: originalEncryptedData.encryptionKey, // Same encryption key
        accessProof: proof,
        publicSignals: {
          ...publicSignals,
          userAddress: sharedWithAddress, // Update to shared user's address
        },
      };

      return sharedEncryptedData;
    } catch (error) {
      console.error("Failed to share encrypted access:", error);
      throw new Error("Failed to share encrypted access");
    }
  }

  /**
   * Revoke encrypted access from a user
   * @param recordId - record ID
   * @param revokeFromAddress - address to revoke access from
   * @returns Promise<boolean>
   */
  async revokeEncryptedAccess(
    recordId: number,
    revokeFromAddress: string
  ): Promise<boolean> {
    try {
      // In a real implementation, this would:
      // 1. Generate a new encryption key
      // 2. Re-encrypt the content with the new key
      // 3. Update access for all authorized users except the revoked one
      // 4. Invalidate the old encryption key

      console.log(
        `Revoking access for record ${recordId} from ${revokeFromAddress}`
      );

      // For demo purposes, return true
      return true;
    } catch (error) {
      console.error("Failed to revoke encrypted access:", error);
      return false;
    }
  }

  /**
   * Verify user's access to encrypted content
   * @param encryptedData - encrypted IPFS data
   * @param userAddress - user's address
   * @returns Promise<boolean>
   */
  async verifyAccess(
    encryptedData: EncryptedIPFSData,
    userAddress: string
  ): Promise<boolean> {
    try {
      const verificationResult = await zkpService.verifyProof(
        encryptedData.accessProof,
        encryptedData.publicSignals,
        "accessVerification"
      );

      return (
        verificationResult.isValid &&
        verificationResult.userAddress.toLowerCase() ===
          userAddress.toLowerCase()
      );
    } catch (error) {
      console.error("Failed to verify access:", error);
      return false;
    }
  }

  /**
   * Get file from IPFS using hash
   * @param ipfsHash - IPFS hash
   * @returns Promise<Blob>
   */
  async getFileFromIPFS(ipfsHash: string): Promise<Blob> {
    try {
      const response = await fetch(`${this.pinataGatewayUrl}/ipfs/${ipfsHash}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch from IPFS: ${response.statusText}`);
      }

      return await response.blob();
    } catch (error) {
      console.error("Failed to get file from IPFS:", error);
      throw new Error("Failed to retrieve file from IPFS");
    }
  }

  /**
   * Upload file to IPFS via Pinata
   * @param file - file to upload
   * @returns Promise<string> - IPFS hash
   */
  private async uploadToIPFS(file: File): Promise<string> {
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data.IpfsHash;
    } catch (error) {
      console.error("Failed to upload to IPFS:", error);
      throw new Error("IPFS upload failed");
    }
  }

  /**
   * Upload metadata to IPFS
   * @param metadata - metadata to upload
   * @returns Promise<string> - IPFS hash
   */
  private async uploadMetadataToIPFS(
    metadata: EncryptedIPFSData
  ): Promise<string> {
    try {
      const blob = new Blob([JSON.stringify(metadata, null, 2)], {
        type: "application/json",
      });
      const file = new File([blob], "metadata.json", {
        type: "application/json",
      });

      return await this.uploadToIPFS(file);
    } catch (error) {
      console.error("Failed to upload metadata to IPFS:", error);
      throw new Error("Metadata upload failed");
    }
  }

  /**
   * Generate encryption key for a record
   * @returns Promise<string>
   */
  private async generateEncryptionKey(): Promise<string> {
    // In a real implementation, this would generate a proper encryption key
    const key = crypto.getRandomValues(new Uint8Array(32));
    return Array.from(key, (byte) => byte.toString(16).padStart(2, "0")).join(
      ""
    );
  }

  /**
   * Get current user address
   */
  private async getCurrentAddress(): Promise<string> {
    const walletService = await import("../blockchain/wallet.service");
    return await walletService.walletService.getCurrentAddress();
  }

  /**
   * Batch upload multiple encrypted files
   * @param files - array of files with metadata
   * @returns Promise<EncryptedIPFSData[]>
   */
  async batchUploadEncryptedFiles(
    files: Array<{
      file: File;
      recordId: number;
      ownerAddress: string;
    }>
  ): Promise<EncryptedIPFSData[]> {
    const results: EncryptedIPFSData[] = [];

    for (const fileData of files) {
      try {
        const encryptedData = await this.uploadEncryptedFile(
          fileData.file,
          fileData.recordId,
          fileData.ownerAddress
        );
        results.push(encryptedData);
      } catch (error) {
        console.error(
          `Failed to upload file for record ${fileData.recordId}:`,
          error
        );
        // Continue with other files
      }
    }

    return results;
  }

  /**
   * Get encryption metadata for a record
   * @param recordId - record ID
   * @returns Promise<RecordEncryptionMetadata | null>
   */
  async getEncryptionMetadata(
    recordId: number
  ): Promise<RecordEncryptionMetadata | null> {
    try {
      // This would typically be stored in a contract or database
      // For demo purposes, return mock data
      return {
        recordId,
        encryptedWith: zkpService.getUserKeys()?.publicKey || "unknown",
        keyDerivationSalt: `salt_${recordId}`,
        accessControlHash: `access_${recordId}`,
        createdAt: Date.now(),
      };
    } catch (error) {
      console.error("Failed to get encryption metadata:", error);
      return null;
    }
  }

  /**
   * Validate encrypted IPFS data structure
   * @param data - data to validate
   * @returns boolean
   */
  validateEncryptedData(data: EncryptedIPFSData): boolean {
    return !!(
      data.encryptedHash &&
      data.encryptionKey &&
      data.accessProof &&
      data.publicSignals &&
      data.accessProof.a &&
      data.accessProof.b &&
      data.accessProof.c &&
      data.publicSignals.userAddress &&
      data.publicSignals.recordId
    );
  }

  /**
   * Clean up old encrypted data (admin function)
   * @param recordIds - array of record IDs to clean up
   * @returns Promise<number> - number of cleaned up records
   */
  async cleanupOldEncryptedData(recordIds: number[]): Promise<number> {
    let cleaned = 0;

    for (const recordId of recordIds) {
      try {
        // In a real implementation, this would:
        // 1. Check if record is still active
        // 2. Remove old encryption keys
        // 3. Clean up temporary files
        console.log(`Cleaning up encrypted data for record ${recordId}`);
        cleaned++;
      } catch (error) {
        console.error(`Failed to cleanup record ${recordId}:`, error);
      }
    }

    return cleaned;
  }
}

// Export singleton instance
export const encryptedIPFSService = new EncryptedIPFSService();
