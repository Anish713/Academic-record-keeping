/**
 * Zero Knowledge Proof types for document access control
 * These types support the ZKP-based document access system
 */

import { Record } from './records';

// ZK Proof structure matching snarkjs format
export interface ZKProof {
    pi_a: [string, string];
    pi_b: [[string, string], [string, string]];
    pi_c: [string, string];
    publicSignals: string[];
}

// Formatted proof for smart contract calls
export interface FormattedZKProof {
    pA: [string, string];
    pB: [[string, string], [string, string]];
    pC: [string, string];
    publicSignals: [string, string, string]; // [recordId, userAddress, merkleRoot]
}

// Access credentials for ZK proof generation
export interface AccessCredentials {
    recordId: number;
    userAddress: string;
    accessKey: string;
    merkleProof: {
        pathElements: string[];
        pathIndices: number[];
    };
    timestamp: number;
}

// Encrypted record data from blockchain
export interface EncryptedRecord {
    recordId: number;
    encryptedIPFSHash: string;
    encryptedMetadataHash: string;
    merkleRoot: string;
    timestamp: number;
    owner: string;
    exists: boolean;
}

// Result of ZK access verification
export interface ZKAccessResult {
    hasAccess: boolean;
    ipfsHash?: string;
    error?: string;
    proof?: FormattedZKProof;
}

// ZK circuit inputs for proof generation
// This interface matches the access-control.circom circuit inputs exactly
export interface CircuitInputs {
    // Private inputs
    userAddress: string;
    recordId: string;
    accessKey: string;
    timestamp: string;
    pathElements: string[]; // Array of exactly 10 elements for Merkle proof
    pathIndices: number[];  // Array of exactly 10 elements for Merkle proof

    // Public inputs
    recordHash: string;
    merkleRoot: string;
}

// ZK error types for comprehensive error handling
export enum ZKErrorType {
    CIRCUIT_NOT_LOADED = 'CIRCUIT_NOT_LOADED',
    PROOF_GENERATION_FAILED = 'PROOF_GENERATION_FAILED',
    PROOF_VERIFICATION_FAILED = 'PROOF_VERIFICATION_FAILED',
    ACCESS_DENIED = 'ACCESS_DENIED',
    ENCRYPTION_FAILED = 'ENCRYPTION_FAILED',
    DECRYPTION_FAILED = 'DECRYPTION_FAILED',
    INVALID_ACCESS_KEY = 'INVALID_ACCESS_KEY',
    CONTRACT_NOT_INITIALIZED = 'CONTRACT_NOT_INITIALIZED',
    INVALID_MERKLE_PROOF = 'INVALID_MERKLE_PROOF',
    TIMESTAMP_EXPIRED = 'TIMESTAMP_EXPIRED',
    NETWORK_ERROR = 'NETWORK_ERROR',
    WALLET_NOT_CONNECTED = 'WALLET_NOT_CONNECTED',
    INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
    INVALID_INPUT = 'INVALID_INPUT'
}

// ZK-specific error class
export class ZKError extends Error {
    constructor(
        public type: ZKErrorType,
        message: string,
        public details?: any
    ) {
        super(message);
        this.name = 'ZKError';
    }
}

// Enhanced record types with ZK access information
// Extends the base Record interface with ZK-specific fields
export interface SecureRecord extends Record {
    hasZKAccess: boolean;
    documentUrl?: string;
    accessLevel: 'owner' | 'shared' | 'university' | 'admin' | 'none';
    issueDate?: string;
    verified?: boolean;
    issuer?: string;
}

// Information about shared records
export interface SharedRecordInfo {
    recordId: number;
    sharedBy: string;
    sharedAt: number;
    accessLevel: string;
    record: SecureRecord;
}

// Sharing operation result
export interface SharingResult {
    success: boolean;
    recordId: number;
    sharedWith: string;
    accessKey?: string;
    merkleRoot?: string;
    error?: string;
}

// Batch sharing operation result
export interface BatchSharingResult {
    totalRecords: number;
    successfulShares: number;
    failedShares: number;
    results: SharingResult[];
    errors: string[];
}

// Access key generation options
export interface AccessKeyOptions {
    validityPeriod?: number; // in seconds
    accessLevel?: 'read' | 'full';
    customSalt?: string;
}

// Merkle tree update information
export interface MerkleTreeUpdate {
    recordId: number;
    oldMerkleRoot: string;
    newMerkleRoot: string;
    operation: 'share' | 'unshare';
    affectedUser: string;
    timestamp: number;
}