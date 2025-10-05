/**
 * Modular Blockchain Services
 * Export all services for easy importing
 */

// Core wallet and base services
export { walletService } from "./blockchain/wallet.service";
export { BaseContractService } from "./blockchain/base-contract.service";

// Blockchain services
export {
  roleManagementService,
  UserRole,
} from "./blockchain/role-management.service";
export {
  universityManagementService,
  University,
} from "./blockchain/university-management.service";
export { studentManagementService } from "./blockchain/student-management.service";
export { recordsManagementService } from "./blockchain/records-management.service";

// ZKP services
export { zkpService, initializeZKPService } from "./zkp/zkp.service";
export { encryptedIPFSService } from "./zkp/encrypted-ipfs.service";

// Main blockchain service
export { blockchainService } from "./blockchain";

// Types
export type { University } from "./blockchain/university-management.service";
export type { Student } from "./blockchain/student-management.service";
export type {
  RecordShare,
  RecordAccess,
} from "./blockchain/records-management.service";

// ZKP Types
export type {
  ZKProof,
  ZKPublicSignals,
  ZKCircuitInputs,
  ZKAccessType,
  ZKVerificationResult,
  EncryptedIPFSData,
  RecordAccessRequest,
  ZKPServiceConfig,
  UserEncryptionKeys,
  RecordEncryptionMetadata,
} from "../types/zkp";

// Legacy compatibility - for applications still using the old interface
export { blockchainService as default } from "./blockchain";
