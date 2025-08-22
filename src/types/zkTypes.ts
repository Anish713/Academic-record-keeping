/**
 * Zero Knowledge Proof types for document access control
 */

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
export interface CircuitInputs {
    userAddress: string;
    recordId: string;
    accessKey: string;
    timestamp: string;
    pathElements: string[];
    pathIndices: string[];
    recordHash: string;
    merkleRoot: string;
}

// ZK error types
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
    TIMESTAMP_EXPIRED = 'TIMESTAMP_EXPIRED'
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
export interface SecureRecord {
    id: number;
    studentName: string;
    studentId: string;
    studentAddress: string;
    universityName: string;
    recordType: number;
    ipfsHash?: string; // Only available after ZK verification
    timestamp: number;
    university: string;
    isValid: boolean;
    hasZKAccess: boolean;
    documentUrl?: string;
    accessLevel: 'owner' | 'shared' | 'university' | 'admin' | 'none';
}

// Information about shared records
export interface SharedRecordInfo {
    recordId: number;
    sharedBy: string;
    sharedAt: number;
    accessLevel: string;
    record: SecureRecord;
}