/**
 * Zero-Knowledge Proof Types and Interfaces
 * Defines types for ZKP functionality in the academic records system
 */

/**
 * ZKP Proof structure
 */
export interface ZKProof {
  a: [string, string];
  b: [[string, string], [string, string]];
  c: [string, string];
}

/**
 * Public signals for ZKP verification
 */
export interface ZKPublicSignals {
  userAddress: string;
  recordId: string;
  accessType: string;
  timestamp: string;
}

/**
 * ZKP Circuit inputs for proof generation
 */
export interface ZKCircuitInputs {
  // Private inputs (not revealed in proof)
  userPrivateKey: string;
  recordSecret: string;

  // Public inputs (revealed in proof)
  userAddress: string;
  recordId: string;
  accessType: string;
  timestamp: string;
}

/**
 * Access types for ZKP verification
 */
export enum ZKAccessType {
  STUDENT_ACCESS = "0", // Student accessing their own record
  SHARED_ACCESS = "1", // Someone accessing a shared record
  UNIVERSITY_ACCESS = "2", // University accessing their issued record
  VERIFIER_ACCESS = "3", // Third party verifying a record
}

/**
 * ZKP verification result
 */
export interface ZKVerificationResult {
  isValid: boolean;
  userAddress: string;
  recordId: number;
  accessType: ZKAccessType;
  timestamp: number;
  error?: string;
}

/**
 * Encrypted IPFS data structure
 */
export interface EncryptedIPFSData {
  encryptedHash: string;
  encryptionKey: string; // This will be encrypted with user's public key
  accessProof: ZKProof;
  publicSignals: ZKPublicSignals;
}

/**
 * Record access request for ZKP
 */
export interface RecordAccessRequest {
  recordId: number;
  requesterAddress: string;
  accessType: ZKAccessType;
  proof: ZKProof;
  publicSignals: ZKPublicSignals;
}

/**
 * ZKP circuit configuration
 */
export interface ZKCircuitConfig {
  wasmPath: string;
  zkeyPath: string;
  verificationKeyPath: string;
}

/**
 * Access verification circuit inputs
 */
export interface AccessVerificationInputs extends ZKCircuitInputs {
  // Additional inputs specific to access verification
  recordOwner: string;
  sharedWith?: string[];
  universityAddress?: string;
}

/**
 * Record sharing circuit inputs
 */
export interface RecordSharingInputs extends ZKCircuitInputs {
  // Additional inputs specific to record sharing
  shareWithAddress: string;
  sharePermissions: string;
  expirationTime?: string;
}

/**
 * ZKP service configuration
 */
export interface ZKPServiceConfig {
  accessVerificationCircuit: ZKCircuitConfig;
  recordSharingCircuit: ZKCircuitConfig;
  contractAddress: string;
  keyStorageContract: string;
}

/**
 * User encryption keys
 */
export interface UserEncryptionKeys {
  publicKey: string;
  privateKey?: string; // Only available to the user
  zkpIdentity: string; // ZKP identity commitment
}

/**
 * Record encryption metadata
 */
export interface RecordEncryptionMetadata {
  recordId: number;
  encryptedWith: string; // Public key used for encryption
  keyDerivationSalt: string;
  accessControlHash: string;
  createdAt: number;
}

/**
 * ZKP proof generation parameters
 */
export interface ProofGenerationParams {
  circuit: "accessVerification" | "recordSharing";
  inputs: ZKCircuitInputs;
  circuitConfig: ZKCircuitConfig;
}

/**
 * Batched access verification
 */
export interface BatchAccessRequest {
  requests: RecordAccessRequest[];
  batchProof?: ZKProof; // Optional batch proof for efficiency
}

/**
 * ZKP contract events
 */
export interface ZKPEvents {
  AccessVerified: {
    userAddress: string;
    recordId: number;
    accessType: ZKAccessType;
    timestamp: number;
  };

  RecordShared: {
    recordId: number;
    sharedBy: string;
    sharedWith: string;
    timestamp: number;
  };

  KeyGenerated: {
    userAddress: string;
    publicKey: string;
    timestamp: number;
  };
}

/**
 * ZKP error types
 */
export enum ZKPErrorType {
  INVALID_PROOF = "INVALID_PROOF",
  CIRCUIT_NOT_FOUND = "CIRCUIT_NOT_FOUND",
  KEY_GENERATION_FAILED = "KEY_GENERATION_FAILED",
  ENCRYPTION_FAILED = "ENCRYPTION_FAILED",
  DECRYPTION_FAILED = "DECRYPTION_FAILED",
  ACCESS_DENIED = "ACCESS_DENIED",
  INVALID_INPUTS = "INVALID_INPUTS",
  CONTRACT_ERROR = "CONTRACT_ERROR",
}

/**
 * ZKP error interface
 */
export interface ZKPError {
  type: ZKPErrorType;
  message: string;
  details?: any;
}

/**
 * Circuit witness data
 */
export interface CircuitWitness {
  [key: string]: string | number | bigint;
}

/**
 * Verification key structure
 */
export interface VerificationKey {
  protocol: string;
  curve: string;
  nPublic: number;
  vk_alpha_1: string[];
  vk_beta_2: string[][];
  vk_gamma_2: string[][];
  vk_delta_2: string[][];
  vk_alphabeta_12: string[][][];
  IC: string[][];
}

/**
 * ZKP metrics for monitoring
 */
export interface ZKPMetrics {
  proofsGenerated: number;
  proofsVerified: number;
  averageProofGenerationTime: number;
  averageVerificationTime: number;
  successRate: number;
  errorCounts: Record<ZKPErrorType, number>;
}
