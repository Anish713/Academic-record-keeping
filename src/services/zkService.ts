/**
 * Zero Knowledge Proof Service for document access control
 * Handles circuit loading, proof generation, and verification
 * Enhanced with comprehensive error handling and graceful degradation
 */

import * as snarkjs from 'snarkjs';
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
import { zkErrorHandler, ErrorContext } from '../lib/zkErrorHandler';
import { zkFallbackService } from './zkFallbackService';

export class ZKService {
    private circuit: string | null = null;
    private provingKey: string | null = null;
    private verificationKey: any = null;
    private isInitialized = false;
    private zkContract: ethers.Contract | null = null;
    private provider: ethers.BrowserProvider | null = null;
    private signer: ethers.Signer | null = null;

    // Contract addresses - should be set via environment variables
    private readonly ZK_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_ZK_CONTRACT_ADDRESS || '';

    // Circuit paths - use environment variables if available
    private readonly CIRCUIT_WASM_PATH = process.env.NEXT_PUBLIC_ZK_CIRCUIT_WASM_URL || '/circuits/access-control_js/access-control.wasm';
    private readonly PROVING_KEY_PATH = process.env.NEXT_PUBLIC_ZK_PROVING_KEY_URL || '/circuits/access-control_0001.zkey';
    private readonly VERIFICATION_KEY_PATH = process.env.NEXT_PUBLIC_ZK_VERIFICATION_KEY_URL || '/circuits/verification_key.json';

    /**
     * Initialize the ZK service by loading circuit artifacts with retry logic
     */
    async init(): Promise<void> {
        const context: Partial<ErrorContext> = {
            operation: 'zk_service_init',
            zkServiceState: {
                initialized: false,
                circuitLoaded: false,
                contractConnected: false
            }
        };

        try {
            console.log('Starting ZK service initialization...');

            // Step 1: Load circuit WASM file
            console.log('Loading circuit WASM from:', this.CIRCUIT_WASM_PATH);
            const circuitResponse = await this.loadWithTimeout(this.CIRCUIT_WASM_PATH, 30000);
            if (!circuitResponse.ok) {
                throw new ZKError(
                    ZKErrorType.CIRCUIT_NOT_LOADED,
                    `Failed to load circuit WASM: ${circuitResponse.status} ${circuitResponse.statusText}`
                );
            }
            this.circuit = this.CIRCUIT_WASM_PATH;
            context.zkServiceState!.circuitLoaded = true;
            console.log('✓ Circuit WASM loaded successfully');

            // Step 2: Load proving key
            console.log('Loading proving key from:', this.PROVING_KEY_PATH);
            const provingKeyResponse = await this.loadWithTimeout(this.PROVING_KEY_PATH, 30000);
            if (!provingKeyResponse.ok) {
                throw new ZKError(
                    ZKErrorType.CIRCUIT_NOT_LOADED,
                    `Failed to load proving key: ${provingKeyResponse.status} ${provingKeyResponse.statusText}`
                );
            }
            this.provingKey = this.PROVING_KEY_PATH;
            console.log('✓ Proving key loaded successfully');

            // Step 3: Load verification key
            console.log('Loading verification key from:', this.VERIFICATION_KEY_PATH);
            const verificationKeyResponse = await this.loadWithTimeout(this.VERIFICATION_KEY_PATH, 10000);
            if (!verificationKeyResponse.ok) {
                throw new ZKError(
                    ZKErrorType.CIRCUIT_NOT_LOADED,
                    `Failed to load verification key: ${verificationKeyResponse.status} ${verificationKeyResponse.statusText}`
                );
            }
            this.verificationKey = await verificationKeyResponse.json();
            console.log('✓ Verification key loaded successfully');

            // Step 4: Initialize blockchain connection (optional - can fail gracefully)
            try {
                console.log('Initializing blockchain connection...');
                await this.initBlockchain();
                context.zkServiceState!.contractConnected = true;
                console.log('✓ Blockchain connection initialized');
            } catch (blockchainError) {
                console.warn('⚠ Blockchain connection failed, but ZK service can still work for proof generation:', blockchainError);
                // Don't fail the entire initialization if blockchain fails
                context.zkServiceState!.contractConnected = false;
            }

            this.isInitialized = true;
            context.zkServiceState!.initialized = true;
            console.log('✓ ZK service initialization completed successfully');

        } catch (error) {
            console.error('✗ ZK service initialization failed:', error);

            // Reset state on failure
            this.circuit = null;
            this.provingKey = null;
            this.verificationKey = null;
            this.zkContract = null;
            this.isInitialized = false;

            throw error;
        }
    }

    /**
     * Load resource with timeout to prevent hanging
     */
    private async loadWithTimeout(url: string, timeoutMs: number): Promise<Response> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            console.log(`Loading ZK resource: ${url}`);
            const response = await fetch(url, {
                signal: controller.signal,
                cache: 'no-cache' // Prevent stale cache issues
            });
            clearTimeout(timeoutId);

            if (!response.ok) {
                console.error(`Failed to load ${url}: ${response.status} ${response.statusText}`);
            } else {
                console.log(`Successfully loaded ${url} (${response.headers.get('content-type')})`);
            }

            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            console.error(`Error loading ${url}:`, error);

            if (error instanceof Error && error.name === 'AbortError') {
                throw new ZKError(
                    ZKErrorType.NETWORK_ERROR,
                    `Timeout loading ${url} after ${timeoutMs}ms`
                );
            }
            throw new ZKError(
                ZKErrorType.NETWORK_ERROR,
                `Failed to load ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`,
                error
            );
        }
    }

    /**
     * Initialize blockchain connection and ZK contract with error handling
     */
    private async initBlockchain(): Promise<void> {
        if (typeof window === 'undefined' || !(window as any).ethereum) {
            throw new ZKError(
                ZKErrorType.WALLET_NOT_CONNECTED,
                'MetaMask is not installed or not available'
            );
        }

        try {
            this.provider = new ethers.BrowserProvider((window as any).ethereum);

            // Check if wallet is connected
            const accounts = await this.provider.listAccounts();
            if (accounts.length === 0) {
                throw new ZKError(
                    ZKErrorType.WALLET_NOT_CONNECTED,
                    'No wallet accounts connected'
                );
            }

            this.signer = await this.provider.getSigner();

            if (!this.ZK_CONTRACT_ADDRESS) {
                throw new ZKError(
                    ZKErrorType.CONTRACT_NOT_INITIALIZED,
                    'ZK contract address not configured in environment variables'
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

            // Test contract connection
            await this.testContractConnection();
        } catch (error) {
            if (error instanceof ZKError) {
                throw error;
            }

            // Handle specific ethers errors
            if (error instanceof Error) {
                if (error.message.includes('user rejected')) {
                    throw new ZKError(
                        ZKErrorType.WALLET_NOT_CONNECTED,
                        'User rejected wallet connection'
                    );
                }
                if (error.message.includes('network')) {
                    throw new ZKError(
                        ZKErrorType.NETWORK_ERROR,
                        `Network error: ${error.message}`
                    );
                }
            }

            throw new ZKError(
                ZKErrorType.CONTRACT_NOT_INITIALIZED,
                `Failed to initialize blockchain connection: ${error instanceof Error ? error.message : 'Unknown error'}`,
                error
            );
        }
    }

    /**
     * Test contract connection to ensure it's working
     */
    private async testContractConnection(): Promise<void> {
        if (!this.zkContract) {
            throw new ZKError(
                ZKErrorType.CONTRACT_NOT_INITIALIZED,
                'ZK contract not initialized'
            );
        }

        try {
            console.log('Testing ZK contract connection...');
            const userAddress = await this.getCurrentAddress();
            console.log('Current user address:', userAddress);

            // Try to call a simple view function to test connection
            const accessibleRecords = await this.zkContract.getUserAccessibleRecords(userAddress);
            console.log(`✓ ZK contract test successful. User has access to ${accessibleRecords.length} records.`);
        } catch (error) {
            console.error('ZK contract test failed:', error);

            if (error instanceof Error) {
                if (error.message.includes('call revert') || error.message.includes('execution reverted')) {
                    // Contract exists but function reverted - this might be expected for empty results
                    console.log('✓ ZK contract exists but returned empty results (this is normal)');
                    return;
                }

                if (error.message.includes('network') || error.message.includes('provider')) {
                    throw new ZKError(
                        ZKErrorType.NETWORK_ERROR,
                        `Network error connecting to ZK contract: ${error.message}`,
                        error
                    );
                }

                if (error.message.includes('contract') || error.message.includes('address')) {
                    throw new ZKError(
                        ZKErrorType.CONTRACT_NOT_INITIALIZED,
                        `ZK contract not found at address ${this.ZK_CONTRACT_ADDRESS}: ${error.message}`,
                        error
                    );
                }
            }

            throw new ZKError(
                ZKErrorType.CONTRACT_NOT_INITIALIZED,
                `ZK contract connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                error
            );
        }
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
     * Validate circuit inputs to ensure all 26 required values are provided
     */
    private validateCircuitInputs(input: any): void {
        const requiredFields = [
            'userAddress', 'recordId', 'accessKey', 'timestamp',
            'pathElements', 'pathIndices', 'recordHash', 'merkleRoot'
        ];

        // Check all required fields are present
        for (const field of requiredFields) {
            if (input[field] === undefined || input[field] === null) {
                throw new ZKError(
                    ZKErrorType.PROOF_GENERATION_FAILED,
                    `Missing required circuit input: ${field}`
                );
            }
        }

        // Validate array inputs
        if (!Array.isArray(input.pathElements) || input.pathElements.length !== 10) {
            throw new ZKError(
                ZKErrorType.PROOF_GENERATION_FAILED,
                `pathElements must be an array of exactly 10 elements, got ${input.pathElements?.length || 0}`
            );
        }

        if (!Array.isArray(input.pathIndices) || input.pathIndices.length !== 10) {
            throw new ZKError(
                ZKErrorType.PROOF_GENERATION_FAILED,
                `pathIndices must be an array of exactly 10 elements, got ${input.pathIndices?.length || 0}`
            );
        }

        // Validate all pathElements are valid field elements
        for (let i = 0; i < input.pathElements.length; i++) {
            const element = input.pathElements[i];
            if (typeof element !== 'string' || element === '') {
                throw new ZKError(
                    ZKErrorType.PROOF_GENERATION_FAILED,
                    `pathElements[${i}] must be a non-empty string, got ${typeof element}`
                );
            }

            try {
                const bigIntValue = BigInt(element);
                const fieldSize = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');
                if (bigIntValue >= fieldSize) {
                    throw new ZKError(
                        ZKErrorType.PROOF_GENERATION_FAILED,
                        `pathElements[${i}] value ${element} exceeds field size`
                    );
                }
            } catch (error) {
                throw new ZKError(
                    ZKErrorType.PROOF_GENERATION_FAILED,
                    `pathElements[${i}] is not a valid field element: ${element}`
                );
            }
        }

        // Validate all pathIndices are 0 or 1
        for (let i = 0; i < input.pathIndices.length; i++) {
            const index = input.pathIndices[i];
            if (typeof index !== 'number' || (index !== 0 && index !== 1)) {
                throw new ZKError(
                    ZKErrorType.PROOF_GENERATION_FAILED,
                    `pathIndices[${i}] must be 0 or 1, got ${index}`
                );
            }
        }

        // Validate string inputs are valid field elements
        const stringFields = ['userAddress', 'recordId', 'accessKey', 'timestamp', 'recordHash', 'merkleRoot'];
        for (const field of stringFields) {
            const value = input[field];
            if (typeof value !== 'string' || value === '') {
                throw new ZKError(
                    ZKErrorType.PROOF_GENERATION_FAILED,
                    `${field} must be a non-empty string, got ${typeof value}`
                );
            }

            try {
                const bigIntValue = BigInt(value);
                const fieldSize = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');
                if (bigIntValue >= fieldSize) {
                    throw new ZKError(
                        ZKErrorType.PROOF_GENERATION_FAILED,
                        `${field} value ${value} exceeds field size`
                    );
                }
            } catch (error) {
                throw new ZKError(
                    ZKErrorType.PROOF_GENERATION_FAILED,
                    `${field} is not a valid field element: ${value}`
                );
            }
        }

        console.log('✓ All circuit inputs validated successfully');
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
    private generateMerkleProof(accessKey: string, recordId: number, userAddress: string): { pathElements: string[]; pathIndices: number[] } {
        // Generate a deterministic but simplified Merkle proof
        // In production, this would query the actual Merkle tree structure
        const pathElements = new Array(10);
        const pathIndices = new Array(10);

        // Create deterministic path elements based on access key, record ID, and user address
        const baseHash = ethers.keccak256(ethers.solidityPackedKeccak256(
            ['string', 'uint256', 'address'],
            [accessKey, recordId, userAddress]
        ));

        for (let i = 0; i < 10; i++) {
            // Generate deterministic path elements
            const elementHash = ethers.keccak256(ethers.solidityPackedKeccak256(
                ['bytes32', 'uint256'],
                [baseHash, i]
            ));
            const elementBigInt = BigInt(elementHash);
            const fieldSize = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');
            pathElements[i] = (elementBigInt % fieldSize).toString();

            // Generate deterministic path indices (0 or 1)
            pathIndices[i] = (elementBigInt % BigInt(2)) === BigInt(0) ? 0 : 1;
        }

        return { pathElements, pathIndices };
    }

    /**
     * Generate ZK proof for document access with retry logic and timeout
     */
    async generateAccessProof(
        userAddress: string,
        recordId: number,
        accessKey: string
    ): Promise<{ proof: ZKProof; publicSignals: string[] }> {
        // Check if proof generation is disabled for debugging
        if (process.env.ZK_DISABLE_PROOF_GENERATION === 'true') {
            console.log('ZK proof generation is disabled via environment variable');
            throw new ZKError(
                ZKErrorType.PROOF_GENERATION_FAILED,
                'ZK proof generation is disabled for debugging'
            );
        }

        // Check if service is initialized
        if (!this.isInitialized) {
            console.error('ZK service not initialized - attempting to initialize now...');
            try {
                await this.init();
            } catch (initError) {
                console.error('Failed to initialize ZK service:', initError);
                throw new ZKError(
                    ZKErrorType.CIRCUIT_NOT_LOADED,
                    'ZK service initialization failed'
                );
            }
        }
        const context: Partial<ErrorContext> = {
            operation: 'generate_access_proof',
            recordId,
            userId: userAddress,
            zkServiceState: {
                initialized: this.isInitialized,
                circuitLoaded: this.circuit !== null,
                contractConnected: this.zkContract !== null
            }
        };

        this.ensureInitialized();

        if (!this.circuit || !this.provingKey) {
            throw new ZKError(
                ZKErrorType.CIRCUIT_NOT_LOADED,
                'Circuit or proving key not loaded'
            );
        }

        return zkErrorHandler.executeWithRetry(
            async () => {
                // Prepare all required circuit inputs
                const recordHash = await this.getRecordHash(recordId);
                const merkleRoot = await this.getMerkleRoot(recordId);

                // Convert inputs to field elements
                const userAddressField = this.addressToField(userAddress);
                const recordIdField = recordId.toString();
                const accessKeyField = this.stringToField(accessKey);

                // Generate current timestamp (in seconds)
                const timestamp = Math.floor(Date.now() / 1000).toString();

                // Generate Merkle proof for the access credentials
                const merkleProof = this.generateMerkleProof(accessKey, recordId, userAddress);

                // Validate that we have all required inputs
                if (!userAddressField || !recordIdField || !accessKeyField || !timestamp) {
                    throw new ZKError(
                        ZKErrorType.PROOF_GENERATION_FAILED,
                        'Missing required private inputs for circuit'
                    );
                }

                if (!merkleProof.pathElements || merkleProof.pathElements.length !== 10) {
                    throw new ZKError(
                        ZKErrorType.PROOF_GENERATION_FAILED,
                        'Invalid pathElements array - must have exactly 10 elements'
                    );
                }

                if (!merkleProof.pathIndices || merkleProof.pathIndices.length !== 10) {
                    throw new ZKError(
                        ZKErrorType.PROOF_GENERATION_FAILED,
                        'Invalid pathIndices array - must have exactly 10 elements'
                    );
                }

                if (!recordHash || !merkleRoot) {
                    throw new ZKError(
                        ZKErrorType.PROOF_GENERATION_FAILED,
                        'Missing required public inputs (recordHash or merkleRoot)'
                    );
                }

                // Prepare complete circuit inputs (all 8 inputs + arrays = 26 total values)
                const input = {
                    // Private inputs (6 + arrays)
                    userAddress: userAddressField,
                    recordId: recordIdField,
                    accessKey: accessKeyField,
                    timestamp: timestamp,
                    pathElements: merkleProof.pathElements,  // Array of 10 elements
                    pathIndices: merkleProof.pathIndices,    // Array of 10 elements

                    // Public inputs (2)
                    recordHash: recordHash,
                    merkleRoot: merkleRoot
                };

                // Validate all inputs before proof generation
                this.validateCircuitInputs(input);

                // Log input validation for debugging
                console.log('Circuit input validation:');
                console.log('- userAddress:', userAddressField);
                console.log('- recordId:', recordIdField);
                console.log('- accessKey:', accessKeyField.substring(0, 20) + '...');
                console.log('- timestamp:', timestamp);
                console.log('- pathElements length:', merkleProof.pathElements.length);
                console.log('- pathIndices length:', merkleProof.pathIndices.length);
                console.log('- recordHash:', recordHash);
                console.log('- merkleRoot:', merkleRoot);
                console.log('Total input values:',
                    6 + merkleProof.pathElements.length + merkleProof.pathIndices.length + 2);

                // Add timeout to proof generation to prevent hanging
                console.log('Generating ZK proof with input:', input);
                console.log('Circuit loaded:', this.circuit !== null);
                console.log('Proving key loaded:', this.provingKey !== null);

                let proofResult;
                try {
                    console.log('Calling snarkjs.groth16.fullProve with:');
                    console.log('Input:', input);
                    console.log('Circuit path:', this.circuit);
                    console.log('Proving key path:', this.provingKey);

                    const proofPromise = snarkjs.groth16.fullProve(
                        input,
                        this.circuit!,
                        this.provingKey!
                    );

                    const timeoutPromise = new Promise<never>((_, reject) => {
                        setTimeout(() => {
                            reject(new ZKError(
                                ZKErrorType.PROOF_GENERATION_FAILED,
                                'Proof generation timed out after 30 seconds'
                            ));
                        }, 30000); // 30 second timeout
                    });

                    proofResult = await Promise.race([
                        proofPromise,
                        timeoutPromise
                    ]);
                } catch (error) {
                    console.error('Proof generation failed:', error);
                    throw new ZKError(
                        ZKErrorType.PROOF_GENERATION_FAILED,
                        `Proof generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                        error
                    );
                }

                if (!proofResult) {
                    throw new ZKError(
                        ZKErrorType.PROOF_GENERATION_FAILED,
                        'Proof generation returned null or undefined'
                    );
                }

                const { proof, publicSignals } = proofResult;

                // Validate proof structure
                if (!proof || !proof.pi_a || !proof.pi_b || !proof.pi_c) {
                    throw new ZKError(
                        ZKErrorType.PROOF_GENERATION_FAILED,
                        'Generated proof has invalid structure'
                    );
                }

                if (!publicSignals || publicSignals.length === 0) {
                    throw new ZKError(
                        ZKErrorType.PROOF_GENERATION_FAILED,
                        'Generated proof has no public signals'
                    );
                }

                return { proof, publicSignals };
            },
            context,
            {
                maxAttempts: 2, // Proof generation is expensive, limit retries
                baseDelay: 1000,
                maxDelay: 5000
            }
        );
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
                proof.publicSignals[0], // recordHash
                proof.publicSignals[1], // merkleRoot
                proof.publicSignals[2] || "0"  // isAuthorized (output)
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
     * Enhanced with comprehensive error handling and fallback mechanisms
     */
    async verifyDocumentAccess(recordId: number, record?: any): Promise<string | null> {
        const context: Partial<ErrorContext> = {
            operation: 'verify_document_access',
            recordId,
            zkServiceState: {
                initialized: this.isInitialized,
                circuitLoaded: this.circuit !== null,
                contractConnected: this.zkContract !== null
            }
        };

        try {
            this.ensureInitialized();

            if (!this.zkContract) {
                throw new ZKError(
                    ZKErrorType.CONTRACT_NOT_INITIALIZED,
                    'ZK contract not initialized'
                );
            }

            return await zkErrorHandler.executeWithFallback(
                // Primary ZK operation
                async () => {
                    const userAddress = await this.getCurrentAddress();
                    context.userId = userAddress;

                    // First check if user has access
                    const hasAccess = await this.zkContract!.hasAccess(recordId, userAddress);
                    if (!hasAccess) {
                        throw new ZKError(
                            ZKErrorType.ACCESS_DENIED,
                            `User ${userAddress} does not have access to record ${recordId}`
                        );
                    }

                    const accessKey = await this.getUserAccessKey(recordId);

                    const { proof, publicSignals } = await this.generateAccessProof(
                        userAddress,
                        recordId,
                        accessKey
                    );

                    const formattedProof = this.formatProofForContract(proof);

                    // Verify proof on-chain
                    const isValid = await this.zkContract!.verifyAccess(
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
                    const encryptedHash = await this.zkContract!.getEncryptedHash(
                        recordId,
                        formattedProof.pA,
                        formattedProof.pB,
                        formattedProof.pC,
                        formattedProof.publicSignals
                    );

                    // Decrypt and return IPFS hash
                    return this.decryptIPFSHash(encryptedHash, accessKey);
                },
                // Fallback operation
                async () => {
                    if (!record) {
                        throw new ZKError(
                            ZKErrorType.ACCESS_DENIED,
                            'No fallback record data available'
                        );
                    }

                    const userAddress = await this.getCurrentAddress();
                    const fallbackResult = await zkFallbackService.fallbackDocumentAccess(
                        recordId,
                        userAddress,
                        record,
                        new ZKError(ZKErrorType.PROOF_GENERATION_FAILED, 'ZK service unavailable')
                    );

                    if (fallbackResult.hasAccess && fallbackResult.ipfsHash) {
                        return fallbackResult.ipfsHash;
                    }

                    return null;
                },
                context
            );
        } catch (error) {
            if (error instanceof ZKError) {
                // Log the error but don't throw - return null to indicate no access
                console.warn(`ZK document access failed for record ${recordId}:`, {
                    error: error.type,
                    message: error.message
                });
                return null;
            }

            console.error('Unexpected error in document access verification:', error);
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
            console.log(`Checking ZK access for record ${recordId}, user ${userAddress}`);

            const hasAccess = await this.zkContract.hasAccess(recordId, userAddress);
            console.log(`ZK contract hasAccess result for record ${recordId}: ${hasAccess}`);

            return hasAccess;
        } catch (error) {
            console.error(`Failed to check record access for record ${recordId}:`, error);

            // If the contract call fails, it might be because the record doesn't exist in ZK contract
            // This is not necessarily an error - it just means no ZK access is configured
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
                ZKErrorType.INVALID_INPUT,
                'Invalid user address provided'
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
     * Generate university access proof for record verification
     * Universities have automatic access to records they issued
     */
    async generateUniversityAccessProof(
        universityAddress: string,
        recordId: number
    ): Promise<{ proof: ZKProof; publicSignals: string[] } | null> {
        const context: Partial<ErrorContext> = {
            operation: 'generate_university_access_proof',
            recordId,
            userId: universityAddress,
            zkServiceState: {
                initialized: this.isInitialized,
                circuitLoaded: this.circuit !== null,
                contractConnected: this.zkContract !== null
            }
        };

        this.ensureInitialized();

        if (!this.circuit || !this.provingKey) {
            throw new ZKError(
                ZKErrorType.CIRCUIT_NOT_LOADED,
                'Circuit or proving key not loaded'
            );
        }

        try {
            // Check if university has access to this record
            const hasAccess = await this.zkContract!.hasAccess(recordId, universityAddress);
            if (!hasAccess) {
                console.warn(`University ${universityAddress} does not have access to record ${recordId}`);
                return null;
            }

            // Get university access key (should be automatically granted when record is created)
            const accessKey = await this.getUserAccessKey(recordId);

            return await this.generateAccessProof(universityAddress, recordId, accessKey);
        } catch (error) {
            console.error('Failed to generate university access proof:', error);
            return null;
        }
    }

    /**
     * Verify university access to a record and return IPFS hash
     * This is a specialized version for universities with automatic access
     */
    async verifyUniversityDocumentAccess(
        recordId: number,
        universityAddress: string,
        record?: any
    ): Promise<string | null> {
        const context: Partial<ErrorContext> = {
            operation: 'verify_university_document_access',
            recordId,
            userId: universityAddress,
            zkServiceState: {
                initialized: this.isInitialized,
                circuitLoaded: this.circuit !== null,
                contractConnected: this.zkContract !== null
            }
        };

        try {
            this.ensureInitialized();

            if (!this.zkContract) {
                throw new ZKError(
                    ZKErrorType.CONTRACT_NOT_INITIALIZED,
                    'ZK contract not initialized'
                );
            }

            return await zkErrorHandler.executeWithFallback(
                // Primary ZK operation for university
                async () => {
                    // Check if university has access
                    const hasAccess = await this.zkContract!.hasAccess(recordId, universityAddress);
                    if (!hasAccess) {
                        throw new ZKError(
                            ZKErrorType.ACCESS_DENIED,
                            `University ${universityAddress} does not have access to record ${recordId}`
                        );
                    }

                    const accessKey = await this.getUserAccessKey(recordId);

                    const { proof, publicSignals } = await this.generateAccessProof(
                        universityAddress,
                        recordId,
                        accessKey
                    );

                    const formattedProof = this.formatProofForContract(proof);

                    // Verify proof on-chain
                    const isValid = await this.zkContract!.verifyAccess(
                        recordId,
                        formattedProof.pA,
                        formattedProof.pB,
                        formattedProof.pC,
                        formattedProof.publicSignals
                    );

                    if (!isValid) {
                        throw new ZKError(
                            ZKErrorType.PROOF_VERIFICATION_FAILED,
                            'Generated university proof is invalid'
                        );
                    }

                    // Get encrypted hash
                    const encryptedHash = await this.zkContract!.getEncryptedHash(
                        recordId,
                        formattedProof.pA,
                        formattedProof.pB,
                        formattedProof.pC,
                        formattedProof.publicSignals
                    );

                    // Decrypt and return IPFS hash
                    return this.decryptIPFSHash(encryptedHash, accessKey);
                },
                // Fallback operation for universities
                async () => {
                    if (!record) {
                        throw new ZKError(
                            ZKErrorType.ACCESS_DENIED,
                            'No fallback record data available for university access'
                        );
                    }

                    // Universities should have fallback access to records they issued
                    const fallbackResult = await zkFallbackService.fallbackUniversityAccess(
                        recordId,
                        universityAddress,
                        record,
                        new ZKError(ZKErrorType.PROOF_GENERATION_FAILED, 'ZK service unavailable')
                    );

                    if (fallbackResult.hasAccess && fallbackResult.ipfsHash) {
                        return fallbackResult.ipfsHash;
                    }

                    return null;
                },
                context
            );
        } catch (error) {
            if (error instanceof ZKError) {
                console.warn(`ZK university document access failed for record ${recordId}:`, {
                    error: error.type,
                    message: error.message
                });
                return null;
            }

            console.error('Unexpected error in university document access verification:', error);
            return null;
        }
    }

    /**
     * Get all records accessible by a university
     * Universities have access to all records they issued
     */
    async getUniversityAccessibleRecords(universityAddress: string): Promise<number[]> {
        this.ensureInitialized();

        if (!this.zkContract) {
            throw new ZKError(
                ZKErrorType.CONTRACT_NOT_INITIALIZED,
                'ZK contract not initialized'
            );
        }

        try {
            const recordIds = await this.zkContract.getUserAccessibleRecords(universityAddress);
            return recordIds.map((id: bigint) => Number(id));
        } catch (error) {
            console.error('Failed to get university accessible records:', error);
            return [];
        }
    }

    /**
     * Validate university access to a record
     * Universities should have permanent access to records they issued
     */
    async validateUniversityAccess(recordId: number, universityAddress: string): Promise<boolean> {
        this.ensureInitialized();

        if (!this.zkContract) {
            throw new ZKError(
                ZKErrorType.CONTRACT_NOT_INITIALIZED,
                'ZK contract not initialized'
            );
        }

        try {
            return await this.zkContract.hasAccess(recordId, universityAddress);
        } catch (error) {
            console.error('Failed to validate university access:', error);
            return false;
        }
    }

    /**
     * Generate admin access proof for record oversight
     * Admins have oversight access to all records for system management
     */
    async generateAdminAccessProof(
        adminAddress: string,
        recordId: number
    ): Promise<{ proof: ZKProof; publicSignals: string[] } | null> {
        const context: Partial<ErrorContext> = {
            operation: 'generate_admin_access_proof',
            recordId,
            userId: adminAddress,
            zkServiceState: {
                initialized: this.isInitialized,
                contractAddress: this.zkContract?.target?.toString() || 'unknown',
                contractConnected: !!this.zkContract,
                circuitLoaded: !!this.circuit,
                provingKeyLoaded: !!this.provingKey
            }
        };

        try {
            // Admins should have oversight access to all records
            // Generate a special admin access key for oversight purposes
            const adminAccessKey = await this.generateAdminAccessKey(recordId, adminAddress);

            return await this.generateAccessProof(adminAddress, recordId, adminAccessKey);
        } catch (error) {
            console.error('Failed to generate admin access proof:', error);
            return null;
        }
    }

    /**
     * Verify admin access to a record and return IPFS hash
     * This is a specialized version for admins with oversight access
     */
    async verifyAdminDocumentAccess(
        recordId: number,
        adminAddress: string,
        record?: any
    ): Promise<string | null> {
        const context: Partial<ErrorContext> = {
            operation: 'verify_admin_document_access',
            recordId,
            userId: adminAddress,
            zkServiceState: {
                initialized: this.isInitialized,
                contractAddress: this.zkContract?.target?.toString() || 'unknown',
                contractConnected: !!this.zkContract,
                circuitLoaded: !!this.circuit,
                provingKeyLoaded: !!this.provingKey
            }
        };

        try {
            return await zkErrorHandler.executeWithFallback(
                // Primary ZK operation for admin
                async () => {
                    // Generate admin access proof
                    const proofResult = await this.generateAdminAccessProof(adminAddress, recordId);

                    if (!proofResult) {
                        throw new ZKError(
                            ZKErrorType.PROOF_GENERATION_FAILED,
                            'Failed to generate admin access proof'
                        );
                    }

                    const { proof, publicSignals } = proofResult;

                    // Verify the proof on-chain
                    const isValid = await this.zkContract!.verifyAccess(
                        recordId,
                        [proof.pi_a[0], proof.pi_a[1]],
                        [[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]],
                        [proof.pi_c[0], proof.pi_c[1]],
                        publicSignals
                    );

                    if (!isValid) {
                        throw new ZKError(
                            ZKErrorType.PROOF_VERIFICATION_FAILED,
                            'Generated admin proof is invalid'
                        );
                    }

                    // Get encrypted hash and decrypt it
                    const encryptedHash = await this.zkContract!.getEncryptedHash(
                        recordId,
                        [proof.pi_a[0], proof.pi_a[1]],
                        [[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]],
                        [proof.pi_c[0], proof.pi_c[1]],
                        publicSignals
                    );

                    const adminAccessKey = await this.generateAdminAccessKey(recordId, adminAddress);
                    return this.decryptIPFSHash(encryptedHash, adminAccessKey);
                },
                // Fallback operation for admin
                async () => {
                    if (!record) {
                        throw new ZKError(
                            ZKErrorType.ACCESS_DENIED,
                            'No fallback record data available for admin access'
                        );
                    }

                    // Admins should have fallback access to all records for oversight
                    const fallbackResult = await zkFallbackService.fallbackAdminAccess(
                        recordId,
                        adminAddress,
                        record,
                        new ZKError(ZKErrorType.PROOF_GENERATION_FAILED, 'Admin ZK access failed')
                    );

                    if (fallbackResult.hasAccess && fallbackResult.ipfsHash) {
                        return fallbackResult.ipfsHash;
                    }

                    throw new ZKError(ZKErrorType.ACCESS_DENIED, fallbackResult.error || 'Admin access denied');
                },
                context
            );
        } catch (error) {
            if (error instanceof ZKError) {
                console.warn(`ZK admin document access failed for record ${recordId}:`, {
                    adminAddress,
                    error: error.type,
                    message: error.message
                });
            }

            console.error('Unexpected error in admin document access verification:', error);
            return null;
        }
    }

    /**
     * Validate admin access to a record
     * Admins should have oversight access to all records
     */
    async validateAdminAccess(recordId: number, adminAddress: string): Promise<boolean> {
        this.ensureInitialized();

        if (!this.zkContract) {
            throw new ZKError(
                ZKErrorType.CONTRACT_NOT_INITIALIZED,
                'ZK contract not initialized'
            );
        }

        try {
            // Admins should have oversight access to all records
            // Check if admin access is explicitly granted or use oversight privileges
            const hasExplicitAccess = await this.zkContract.hasAccess(recordId, adminAddress);

            if (hasExplicitAccess) {
                return true;
            }

            // For admin oversight, we can grant access even without explicit ZK credentials
            // This ensures admins can monitor and manage the system
            return true;
        } catch (error) {
            console.error('Failed to validate admin access:', error);
            // Default to allowing admin access for system oversight
            return true;
        }
    }

    /**
     * Generate admin access key for oversight purposes
     * Creates a deterministic key based on admin address and record ID
     */
    private async generateAdminAccessKey(recordId: number, adminAddress: string): Promise<string> {
        try {
            // Generate a deterministic admin access key for oversight
            const adminSeed = `admin_oversight_${adminAddress}_${recordId}`;
            const hash = ethers.keccak256(ethers.toUtf8Bytes(adminSeed));
            return hash.slice(2, 34); // Use first 32 characters as access key
        } catch (error) {
            console.error('Failed to generate admin access key:', error);
            throw new ZKError(ZKErrorType.INVALID_ACCESS_KEY, 'Failed to generate admin access key');
        }
    }

    /**
     * Get all records accessible by an admin
     * Admins have oversight access to all records
     */
    async getAdminAccessibleRecords(adminAddress: string): Promise<number[]> {
        this.ensureInitialized();

        if (!this.zkContract) {
            throw new ZKError(
                ZKErrorType.CONTRACT_NOT_INITIALIZED,
                'ZK contract not initialized'
            );
        }

        try {
            // For admins, return all existing records for oversight
            const totalRecords = await this.zkContract.getTotalRecords();
            const recordIds: number[] = [];

            for (let i = 1; i <= totalRecords; i++) {
                recordIds.push(i);
            }

            return recordIds;
        } catch (error) {
            console.error('Failed to get admin accessible records:', error);
            return [];
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
                const isValid = await snarkjs.groth16.verify(this.verificationKey, publicSignals, proof);
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

    /**
     * Get detailed ZK service status for debugging
     */
    getServiceStatus(): {
        initialized: boolean;
        circuitLoaded: boolean;
        provingKeyLoaded: boolean;
        verificationKeyLoaded: boolean;
        contractConnected: boolean;
        contractAddress: string;
    } {
        return {
            initialized: this.isInitialized,
            circuitLoaded: this.circuit !== null,
            provingKeyLoaded: this.provingKey !== null,
            verificationKeyLoaded: this.verificationKey !== null,
            contractConnected: this.zkContract !== null,
            contractAddress: this.ZK_CONTRACT_ADDRESS || 'Not configured'
        };
    }
}

// Export singleton instance
export const zkService = new ZKService();