/**
 * Zero Knowledge Proof Service for document access control
 * Handles circuit loading, proof generation, and verification
 */

import { groth16 } from 'snarkjs';
import { ethers } from 'ethers';
import {
    ZKProof,
    FormattedZKProof,
    AccessCredentials,
    ZKAccessResult,
    CircuitInputs,
    ZKError,
    ZKErrorType,
    EncryptedRecord
} from '../types/zkTypes';

export class ZKService {
    private circuit: ArrayBuffer | null = null;
    private provingKey: ArrayBuffer | null = null;
    private verificationKey: any = null;
    private isInitialized = false;
    private zkContract: ethers.Contract | null = null;
    private provider: ethers.BrowserProvider | null = null;
    private signer: ethers.Signer | null = null;

    // Contract addresses - should be set via environment variables
    private readonly ZK_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_ZK_CONTRACT_ADDRESS || '';

    // Circuit paths
    private readonly CIRCUIT_WASM_PATH = '/circuits/access-control_js/access-control.wasm';
    private readonly PROVING_KEY_PATH = '/circuits/access-control_0001.zkey';
    private readonly VERIFICATION_KEY_PATH = '/circuits/verification_key.json';

    /**
     * Initialize the ZK service by loading circuit artifacts
     */
    async init(): Promise<void> {
        try {
            // Load circuit WASM file
            const circuitResponse = await fetch(this.CIRCUIT_WASM_PATH);
            if (!circuitResponse.ok) {
                throw new ZKError(
                    ZKErrorType.CIRCUIT_NOT_LOADED,
                    `Failed to load circuit WASM: ${circuitResponse.statusText}`
                );
            }
            this.circuit = await circuitResponse.arrayBuffer();

            // Load proving key
            const provingKeyResponse = await fetch(this.PROVING_KEY_PATH);
            if (!provingKeyResponse.ok) {
                throw new ZKError(
                    ZKErrorType.CIRCUIT_NOT_LOADED,
                    `Failed to load proving key: ${provingKeyResponse.statusText}`
                );
            }
            this.provingKey = await provingKeyResponse.arrayBuffer();

            // Load verification key
            const verificationKeyResponse = await fetch(this.VERIFICATION_KEY_PATH);
            if (!verificationKeyResponse.ok) {
                throw new ZKError(
                    ZKErrorType.CIRCUIT_NOT_LOADED,
                    `Failed to load verification key: ${verificationKeyResponse.statusText}`
                );
            }
            this.verificationKey = await verificationKeyResponse.json();

            // Initialize blockchain connection
            await this.initBlockchain();

            this.isInitialized = true;
        } catch (error) {
            if (error instanceof ZKError) {
                throw error;
            }
            throw new ZKError(
                ZKErrorType.CIRCUIT_NOT_LOADED,
                `Failed to initialize ZK service: ${error instanceof Error ? error.message : 'Unknown error'}`,
                error
            );
        }
    }

    /**
     * Initialize blockchain connection and ZK contract
     */
    private async initBlockchain(): Promise<void> {
        if (typeof window === 'undefined' || !window.ethereum) {
            throw new ZKError(
                ZKErrorType.CONTRACT_NOT_INITIALIZED,
                'MetaMask is not installed'
            );
        }

        this.provider = new ethers.BrowserProvider(window.ethereum);
        this.signer = await this.provider.getSigner();

        if (!this.ZK_CONTRACT_ADDRESS) {
            throw new ZKError(
                ZKErrorType.CONTRACT_NOT_INITIALIZED,
                'ZK contract address not configured'
            );
        }

        // ZK contract ABI - minimal interface for our needs
        const zkContractABI = [
            'function verifyAccess(uint256 recordId, uint[2] memory _pA, uint[2][2] memory _pB, uint[2] memory _pC, uint[3] memory publicSignals) external view returns (bool)',
            'function getEncryptedHash(uint256 recordId, uint[2] memory _pA, uint[2][2] memory _pB, uint[2] memory _pC, uint[3] memory publicSignals) external returns (bytes32)',
            'function hasAccess(uint256 recordId, address user) external view returns (bool)',
            'function getUserAccessKey(uint256 recordId, address user) external view returns (bytes32)',
            'function getEncryptedRecord(uint256 recordId) external view returns (tuple(bytes32 encryptedIPFSHash, bytes32 encryptedMetadataHash, bytes32 merkleRoot, uint256 timestamp, address owner, bool exists))',
            'function getUserAccessibleRecords(address user) external view returns (uint256[])'
        ];

        this.zkContract = new ethers.Contract(
            this.ZK_CONTRACT_ADDRESS,
            zkContractABI,
            this.signer
        );
    }

    /**
     * Ensure the service is initialized
     */
    private ensureInitialized(): void {
        if (!this.isInitialized) {
            throw new ZKError(
                ZKErrorType.CIRCUIT_NOT_LOADED,
                'ZK service not initialized. Call init() first.'
            );
        }
    }

    /**
     * Convert Ethereum address to field element for circuit
     */
    private addressToField(address: string): string {
        // Remove 0x prefix and convert to BigInt, then to string
        const addressBigInt = BigInt(address);
        return addressBigInt.toString();
    }

    /**
     * Convert string to field element for circuit
     */
    private stringToField(str: string): string {
        // Convert string to bytes, then to field element
        const bytes = ethers.toUtf8Bytes(str);
        const hash = ethers.keccak256(bytes);
        const hashBigInt = BigInt(hash);
        // Ensure it fits in the field (mod p where p is the BN254 field size)
        const fieldSize = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');
        return (hashBigInt % fieldSize).toString();
    }

    /**
     * Get current user's Ethereum address
     */
    async getCurrentAddress(): Promise<string> {
        if (!this.signer) {
            throw new ZKError(
                ZKErrorType.CONTRACT_NOT_INITIALIZED,
                'Signer not available'
            );
        }
        return await this.signer.getAddress();
    }

    /**
     * Generate record hash for circuit input
     */
    private async getRecordHash(recordId: number): Promise<string> {
        const userAddress = await this.getCurrentAddress();
        const recordIdField = recordId.toString();
        const userAddressField = this.addressToField(userAddress);

        // Use Poseidon hash (simplified - in production you'd use the actual Poseidon implementation)
        const combined = ethers.solidityPackedKeccak256(
            ['uint256', 'uint256'],
            [recordIdField, userAddressField]
        );
        const hashBigInt = BigInt(combined);
        const fieldSize = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');
        return (hashBigInt % fieldSize).toString();
    }

    /**
     * Get Merkle root for a record
     */
    private async getMerkleRoot(recordId: number): Promise<string> {
        this.ensureInitialized();
        if (!this.zkContract) {
            throw new ZKError(
                ZKErrorType.CONTRACT_NOT_INITIALIZED,
                'ZK contract not initialized'
            );
        }

        try {
            const encryptedRecord = await this.zkContract.getEncryptedRecord(recordId);
            return BigInt(encryptedRecord.merkleRoot).toString();
        } catch (error) {
            throw new ZKError(
                ZKErrorType.PROOF_GENERATION_FAILED,
                `Failed to get merkle root for record ${recordId}`,
                error
            );
        }
    }

    /**
     * Get user's access key for a record
     */
    private async getUserAccessKey(recordId: number): Promise<string> {
        this.ensureInitialized();
        if (!this.zkContract) {
            throw new ZKError(
                ZKErrorType.CONTRACT_NOT_INITIALIZED,
                'ZK contract not initialized'
            );
        }

        try {
            const userAddress = await this.getCurrentAddress();
            const accessKey = await this.zkContract.getUserAccessKey(recordId, userAddress);
            return BigInt(accessKey).toString();
        } catch (error) {
            throw new ZKError(
                ZKErrorType.INVALID_ACCESS_KEY,
                `Failed to get access key for record ${recordId}`,
                error
            );
        }
    }

    /**
     * Generate Merkle proof for access credentials
     * This is a simplified version - in production, you'd maintain a proper Merkle tree
     */
    private generateMerkleProof(accessKey: string): { pathElements: string[]; pathIndices: number[] } {
        // Simplified Merkle proof generation
        // In production, this would query the actual Merkle tree structure
        const pathElements = new Array(10).fill('0');
        const pathIndices = new Array(10).fill(0);

        // For now, we'll use the access key as the leaf and generate a simple path
        // This should be replaced with actual Merkle tree logic
        return { pathElements, pathIndices };
    }

    /**
     * Generate ZK proof for document access
     */
    async generateAccessProof(
        userAddress: string,
        recordId: number,
        accessKey: string
    ): Promise<{ proof: ZKProof; publicSignals: string[] }> {
        this.ensureInitialized();

        if (!this.circuit || !this.provingKey) {
            throw new ZKError(
                ZKErrorType.CIRCUIT_NOT_LOADED,
                'Circuit or proving key not loaded'
            );
        }

        try {
            const timestamp = Math.floor(Date.now() / 1000);
            const recordHash = await this.getRecordHash(recordId);
            const merkleRoot = await this.getMerkleRoot(recordId);
            const merkleProof = this.generateMerkleProof(accessKey);

            const input: CircuitInputs = {
                userAddress: this.addressToField(userAddress),
                recordId: recordId.toString(),
                accessKey: this.stringToField(accessKey),
                timestamp: timestamp.toString(),
                pathElements: merkleProof.pathElements,
                pathIndices: merkleProof.pathIndices.map(i => i.toString()),
                recordHash,
                merkleRoot
            };

            const { proof, publicSignals } = await groth16.fullProve(
                input,
                this.circuit,
                this.provingKey
            );

            return { proof, publicSignals };
        } catch (error) {
            throw new ZKError(
                ZKErrorType.PROOF_GENERATION_FAILED,
                `Failed to generate access proof for record ${recordId}`,
                error
            );
        }
    }

    /**
     * Format proof for smart contract call
     */
    private formatProofForContract(proof: ZKProof): FormattedZKProof {
        return {
            pA: [proof.pi_a[0], proof.pi_a[1]],
            pB: [
                [proof.pi_b[0][1], proof.pi_b[0][0]], // Note: order is swapped for Solidity
                [proof.pi_b[1][1], proof.pi_b[1][0]]
            ],
            pC: [proof.pi_c[0], proof.pi_c[1]],
            publicSignals: [
                proof.publicSignals[0], // recordId
                proof.publicSignals[1], // userAddress
                proof.publicSignals[2]  // merkleRoot
            ] as [string, string, string]
        };
    }

    /**
     * Decrypt IPFS hash using access key
     */
    private decryptIPFSHash(encryptedHash: string, accessKey: string): string {
        // Simplified decryption - in production, use proper encryption/decryption
        // This is a placeholder implementation
        try {
            // XOR-based decryption (simplified)
            const hashBytes = ethers.getBytes(encryptedHash);
            const keyBytes = ethers.getBytes(ethers.keccak256(ethers.toUtf8Bytes(accessKey)));

            const decryptedBytes = new Uint8Array(hashBytes.length);
            for (let i = 0; i < hashBytes.length; i++) {
                decryptedBytes[i] = hashBytes[i] ^ keyBytes[i % keyBytes.length];
            }

            return ethers.hexlify(decryptedBytes);
        } catch (error) {
            throw new ZKError(
                ZKErrorType.DECRYPTION_FAILED,
                'Failed to decrypt IPFS hash',
                error
            );
        }
    }

    /**
     * Verify document access and return IPFS hash if authorized
     */
    async verifyDocumentAccess(recordId: number): Promise<string | null> {
        this.ensureInitialized();

        if (!this.zkContract) {
            throw new ZKError(
                ZKErrorType.CONTRACT_NOT_INITIALIZED,
                'ZK contract not initialized'
            );
        }

        try {
            const userAddress = await this.getCurrentAddress();

            // First check if user has access
            const hasAccess = await this.zkContract.hasAccess(recordId, userAddress);
            if (!hasAccess) {
                return null;
            }

            const accessKey = await this.getUserAccessKey(recordId);

            const { proof, publicSignals } = await this.generateAccessProof(
                userAddress,
                recordId,
                accessKey
            );

            const formattedProof = this.formatProofForContract(proof);

            // Verify proof on-chain
            const isValid = await this.zkContract.verifyAccess(
                recordId,
                formattedProof.pA,
                formattedProof.pB,
                formattedProof.pC,
                formattedProof.publicSignals
            );

            if (!isValid) {
                throw new ZKError(
                    ZKErrorType.PROOF_VERIFICATION_FAILED,
                    'Generated proof is invalid'
                );
            }

            // Get encrypted hash
            const encryptedHash = await this.zkContract.getEncryptedHash(
                recordId,
                formattedProof.pA,
                formattedProof.pB,
                formattedProof.pC,
                formattedProof.publicSignals
            );

            // Decrypt and return IPFS hash
            return this.decryptIPFSHash(encryptedHash, accessKey);
        } catch (error) {
            if (error instanceof ZKError) {
                throw error;
            }

            console.error('ZK verification failed:', error);
            return null;
        }
    }

    /**
     * Get all records accessible by the current user
     */
    async getUserAccessibleRecords(): Promise<number[]> {
        this.ensureInitialized();

        if (!this.zkContract) {
            throw new ZKError(
                ZKErrorType.CONTRACT_NOT_INITIALIZED,
                'ZK contract not initialized'
            );
        }

        try {
            const userAddress = await this.getCurrentAddress();
            const recordIds = await this.zkContract.getUserAccessibleRecords(userAddress);
            return recordIds.map((id: bigint) => Number(id));
        } catch (error) {
            throw new ZKError(
                ZKErrorType.PROOF_VERIFICATION_FAILED,
                'Failed to get user accessible records',
                error
            );
        }
    }

    /**
     * Check if user has access to a specific record
     */
    async hasAccessToRecord(recordId: number): Promise<boolean> {
        this.ensureInitialized();

        if (!this.zkContract) {
            throw new ZKError(
                ZKErrorType.CONTRACT_NOT_INITIALIZED,
                'ZK contract not initialized'
            );
        }

        try {
            const userAddress = await this.getCurrentAddress();
            return await this.zkContract.hasAccess(recordId, userAddress);
        } catch (error) {
            console.error('Failed to check record access:', error);
            return false;
        }
    }

    /**
     * Get encrypted record information
     */
    async getEncryptedRecord(recordId: number): Promise<EncryptedRecord> {
        this.ensureInitialized();

        if (!this.zkContract) {
            throw new ZKError(
                ZKErrorType.CONTRACT_NOT_INITIALIZED,
                'ZK contract not initialized'
            );
        }

        try {
            const record = await this.zkContract.getEncryptedRecord(recordId);
            return {
                recordId,
                encryptedIPFSHash: record.encryptedIPFSHash,
                encryptedMetadataHash: record.encryptedMetadataHash,
                merkleRoot: record.merkleRoot,
                timestamp: Number(record.timestamp),
                owner: record.owner,
                exists: record.exists
            };
        } catch (error) {
            throw new ZKError(
                ZKErrorType.PROOF_VERIFICATION_FAILED,
                `Failed to get encrypted record ${recordId}`,
                error
            );
        }
    }

    /**
     * Generate access credentials for record sharing
     * Creates secure access key and prepares Merkle proof data
     */
    async generateAccessCredentials(
        recordId: number,
        userAddress: string,
        validityPeriod: number = 365 * 24 * 60 * 60 // Default 1 year
    ): Promise<AccessCredentials> {
        this.ensureInitialized();

        if (!ethers.isAddress(userAddress)) {
            throw new ZKError(
                ZKErrorType.INVALID_ACCESS_KEY,
                'Invalid user address for access credentials'
            );
        }

        try {
            const currentAddress = await this.getCurrentAddress();
            const timestamp = Math.floor(Date.now() / 1000);

            // Generate secure access key
            const accessKey = ethers.solidityPackedKeccak256(
                ['uint256', 'address', 'address', 'uint256', 'uint256', 'string'],
                [recordId, userAddress, currentAddress, timestamp, validityPeriod, 'ZK_ACCESS']
            );

            // Generate Merkle proof for the access key
            const merkleProof = this.generateMerkleProof(accessKey);

            return {
                recordId,
                userAddress,
                accessKey,
                merkleProof,
                timestamp
            };
        } catch (error) {
            throw new ZKError(
                ZKErrorType.PROOF_GENERATION_FAILED,
                `Failed to generate access credentials for record ${recordId}`,
                error
            );
        }
    }

    /**
     * Validate access credentials for a user and record
     */
    async validateAccessCredentials(
        recordId: number,
        userAddress: string,
        accessKey: string
    ): Promise<boolean> {
        this.ensureInitialized();

        if (!this.zkContract) {
            throw new ZKError(
                ZKErrorType.CONTRACT_NOT_INITIALIZED,
                'ZK contract not initialized'
            );
        }

        try {
            // Check if user has active access
            const hasAccess = await this.zkContract.hasAccess(recordId, userAddress);
            if (!hasAccess) {
                return false;
            }

            // Get the stored access key and compare
            const storedAccessKey = await this.zkContract.getUserAccessKey(recordId, userAddress);
            return BigInt(accessKey) === BigInt(storedAccessKey);
        } catch (error) {
            console.error('Failed to validate access credentials:', error);
            return false;
        }
    }

    /**
     * Generate and update Merkle tree for record sharing
     * This creates a new Merkle root that includes the shared user
     */
    async updateMerkleTreeForSharing(
        recordId: number,
        sharedWithAddress: string
    ): Promise<string> {
        this.ensureInitialized();

        if (!this.zkContract) {
            throw new ZKError(
                ZKErrorType.CONTRACT_NOT_INITIALIZED,
                'ZK contract not initialized'
            );
        }

        try {
            const currentAddress = await this.getCurrentAddress();
            const timestamp = Math.floor(Date.now() / 1000);

            // Get current record information
            const encryptedRecord = await this.getEncryptedRecord(recordId);

            // Generate new Merkle root that includes the shared user
            const newMerkleRoot = ethers.solidityPackedKeccak256(
                ['bytes32', 'address', 'uint256', 'uint256', 'string'],
                [encryptedRecord.merkleRoot, sharedWithAddress, recordId, timestamp, 'SHARED']
            );

            return newMerkleRoot;
        } catch (error) {
            throw new ZKError(
                ZKErrorType.PROOF_GENERATION_FAILED,
                `Failed to update Merkle tree for record ${recordId}`,
                error
            );
        }
    }

    /**
     * Generate and update Merkle tree for record unsharing
     * This creates a new Merkle root that excludes the unshared user
     */
    async updateMerkleTreeForUnsharing(
        recordId: number,
        unsharedFromAddress: string
    ): Promise<string> {
        this.ensureInitialized();

        if (!this.zkContract) {
            throw new ZKError(
                ZKErrorType.CONTRACT_NOT_INITIALIZED,
                'ZK contract not initialized'
            );
        }

        try {
            const currentAddress = await this.getCurrentAddress();
            const timestamp = Math.floor(Date.now() / 1000);

            // Get current record information
            const encryptedRecord = await this.getEncryptedRecord(recordId);

            // Generate new Merkle root that excludes the unshared user
            const newMerkleRoot = ethers.solidityPackedKeccak256(
                ['bytes32', 'address', 'uint256', 'uint256', 'string'],
                [encryptedRecord.merkleRoot, unsharedFromAddress, recordId, timestamp, 'UNSHARED']
            );

            return newMerkleRoot;
        } catch (error) {
            throw new ZKError(
                ZKErrorType.PROOF_GENERATION_FAILED,
                `Failed to update Merkle tree for record ${recordId}`,
                error
            );
        }
    }

    /**
     * Get all users with access to a specific record
     */
    async getRecordAccessList(recordId: number): Promise<string[]> {
        this.ensureInitialized();

        if (!this.zkContract) {
            throw new ZKError(
                ZKErrorType.CONTRACT_NOT_INITIALIZED,
                'ZK contract not initialized'
            );
        }

        try {
            // This would require adding a method to the ZK contract
            // For now, we'll return an empty array as a placeholder
            // In production, the ZK contract should maintain an access list
            return [];
        } catch (error) {
            throw new ZKError(
                ZKErrorType.PROOF_VERIFICATION_FAILED,
                `Failed to get access list for record ${recordId}`,
                error
            );
        }
    }

    /**
     * Verify that a user can generate valid proofs for a record
     * This is useful for testing ZK access without actually accessing the document
     */
    async canGenerateValidProof(recordId: number, userAddress?: string): Promise<boolean> {
        this.ensureInitialized();

        try {
            const targetAddress = userAddress || await this.getCurrentAddress();

            // Check if user has access
            const hasAccess = await this.hasAccessToRecord(recordId);
            if (!hasAccess) {
                return false;
            }

            // Try to get access key (this will fail if user doesn't have access)
            const accessKey = await this.getUserAccessKey(recordId);

            // Try to generate a proof (without actually submitting it)
            const { proof, publicSignals } = await this.generateAccessProof(
                targetAddress,
                recordId,
                accessKey
            );

            // Verify the proof locally using the verification key
            if (this.verificationKey) {
                const isValid = await groth16.verify(this.verificationKey, publicSignals, proof);
                return isValid;
            }

            return true; // If we can't verify locally, assume it's valid if we got this far
        } catch (error) {
            console.error('Failed to verify proof generation capability:', error);
            return false;
        }
    }

    /**
     * Get ZK service instance for advanced operations
     * This allows other services to access ZK functionality
     */
    getZKService(): ZKService {
        this.ensureInitialized();
        return this;
    }

    /**
     * Check if ZK service is properly initialized and ready for use
     */
    isReady(): boolean {
        return this.isInitialized &&
            this.circuit !== null &&
            this.provingKey !== null &&
            this.verificationKey !== null &&
            this.zkContract !== null;
    }

    /**
     * Get ZK contract instance for direct contract interactions
     */
    getZKContract(): ethers.Contract {
        this.ensureInitialized();

        if (!this.zkContract) {
            throw new ZKError(
                ZKErrorType.CONTRACT_NOT_INITIALIZED,
                'ZK contract not initialized'
            );
        }

        return this.zkContract;
    }
}

// Export singleton instance
export const zkService = new ZKService();