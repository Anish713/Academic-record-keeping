/**
 * ZKP Service for browser-compatible Zero Knowledge Proof operations
 * 
 * This service handles ZK proof generation and verification for access control
 * in the browser environment using WebAssembly circuits.
 */

import * as snarkjs from 'snarkjs';

// Error types for ZKP operations
export enum ZKPErrorType {
    PROOF_GENERATION_FAILED = "PROOF_GENERATION_FAILED",
    PROOF_VERIFICATION_FAILED = "PROOF_VERIFICATION_FAILED",
    CIRCUIT_LOADING_FAILED = "CIRCUIT_LOADING_FAILED",
    CIRCUIT_NOT_FOUND = "CIRCUIT_NOT_FOUND",
    INVALID_INPUT = "INVALID_INPUT",
    INITIALIZATION_FAILED = "INITIALIZATION_FAILED",
    NETWORK_ERROR = "NETWORK_ERROR"
}

export class ZKPError extends Error {
    constructor(
        public type: ZKPErrorType,
        public details: string,
        public recordId?: number
    ) {
        super(`ZKP Error [${type}]: ${details}`);
        this.name = 'ZKPError';
    }
}

export interface ZKProof {
    proof: {
        pi_a: string[];
        pi_b: string[][];
        pi_c: string[];
        protocol: string;
        curve: string;
    };
    publicSignals: string[];
}

export interface AccessVerificationInput {
    recordId: string;
    userAddress: string;
    issuerAddress: string;
    studentAddress: string;
    accessType: string; // "0"=OWNER, "1"=SHARED, "2"=ADMIN, "3"=EMERGENCY
    timestamp: string;
    accessSecret: string;
}

export interface RecordSharingInput {
    recordId: string;
    ownerAddress: string;
    sharedWithAddress: string;
    expiryTime: string;
    currentTime: string;
    shareSecret: string;
    userAddress: string;
}

export interface PublicSignals {
    hasAccess?: string;
    proofHash?: string;
    canShare?: string;
    sharingToken?: string;
}

export interface CircuitFiles {
    wasm: string;
    zkey: string;
    vkey?: string;
}

export interface CircuitCache {
    files: CircuitFiles;
    wasmBuffer?: ArrayBuffer;
    zkeyBuffer?: ArrayBuffer;
    vkeyData?: any;
    lastLoaded: number;
}

export class ZKPService {
    private static instance: ZKPService;
    private circuitCache: Map<string, CircuitCache> = new Map();
    private isInitialized = false;
    private initializationPromise: Promise<void> | null = null;
    private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

    private constructor() { }

    public static getInstance(): ZKPService {
        if (!ZKPService.instance) {
            ZKPService.instance = new ZKPService();
        }
        return ZKPService.instance;
    }

    /**
     * Initialize the ZKP service with circuit files
     */
    public async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        if (this.initializationPromise) {
            return this.initializationPromise;
        }

        this.initializationPromise = this.performInitialization();
        return this.initializationPromise;
    }

    private async performInitialization(): Promise<void> {
        try {
            // Load circuit files from public directory
            await this.loadCircuitFiles();

            // Verify circuit integrity
            await this.verifyCircuitIntegrity();

            this.isInitialized = true;
            console.log('✅ ZKP Service initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize ZKP Service:', error);
            throw new ZKPError(
                ZKPErrorType.INITIALIZATION_FAILED,
                `ZKP Service initialization failed: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Load circuit files (WASM and zkey) from public directory
     */
    private async loadCircuitFiles(): Promise<void> {
        const circuits = ['access_verification', 'record_sharing'];

        const loadPromises = circuits.map(async (circuit) => {
            try {
                const files: CircuitFiles = {
                    wasm: `/circuits/${circuit}.wasm`,
                    zkey: `/circuits/${circuit}.zkey`,
                    vkey: `/circuits/${circuit}_verification_key.json`
                };

                // Pre-load and cache the files for better performance
                const [wasmBuffer, zkeyBuffer, vkeyData] = await Promise.all([
                    this.loadFile(files.wasm),
                    this.loadFile(files.zkey),
                    this.loadJsonFile(files.vkey!)
                ]);

                this.circuitCache.set(circuit, {
                    files,
                    wasmBuffer,
                    zkeyBuffer,
                    vkeyData,
                    lastLoaded: Date.now()
                });

                console.log(`✅ Loaded circuit: ${circuit}`);
            } catch (error) {
                console.warn(`⚠️ Failed to load circuit ${circuit}:`, error);
                throw new ZKPError(
                    ZKPErrorType.CIRCUIT_LOADING_FAILED,
                    `Failed to load circuit ${circuit}: ${error instanceof Error ? error.message : String(error)}`
                );
            }
        });

        await Promise.all(loadPromises);
    }

    /**
     * Load a file as ArrayBuffer
     */
    private async loadFile(url: string): Promise<ArrayBuffer> {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return await response.arrayBuffer();
        } catch (error) {
            throw new ZKPError(
                ZKPErrorType.NETWORK_ERROR,
                `Failed to load file ${url}: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Load a JSON file
     */
    private async loadJsonFile(url: string): Promise<any> {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return await response.json();
        } catch (error) {
            throw new ZKPError(
                ZKPErrorType.NETWORK_ERROR,
                `Failed to load JSON file ${url}: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Verify circuit integrity
     */
    private async verifyCircuitIntegrity(): Promise<void> {
        for (const [circuitName, cache] of this.circuitCache) {
            try {
                // Basic integrity checks
                if (!cache.wasmBuffer || cache.wasmBuffer.byteLength === 0) {
                    throw new Error(`WASM file is empty or corrupted for ${circuitName}`);
                }

                if (!cache.zkeyBuffer || cache.zkeyBuffer.byteLength === 0) {
                    throw new Error(`zkey file is empty or corrupted for ${circuitName}`);
                }

                if (!cache.vkeyData || !cache.vkeyData.protocol) {
                    throw new Error(`Verification key is invalid for ${circuitName}`);
                }

                console.log(`✅ Circuit integrity verified: ${circuitName}`);
            } catch (error) {
                throw new ZKPError(
                    ZKPErrorType.CIRCUIT_LOADING_FAILED,
                    `Circuit integrity check failed for ${circuitName}: ${error instanceof Error ? error.message : String(error)}`
                );
            }
        }
    }

    /**
     * Generate access verification proof
     */
    public async generateAccessProof(
        input: AccessVerificationInput
    ): Promise<ZKProof> {
        await this.ensureInitialized();

        try {
            // Validate input
            this.validateAccessInput(input);

            const cache = this.circuitCache.get('access_verification');
            if (!cache) {
                throw new ZKPError(
                    ZKPErrorType.CIRCUIT_NOT_FOUND,
                    'Access verification circuit not loaded'
                );
            }

            console.log('🔧 Generating access verification proof...');

            const { proof, publicSignals } = await snarkjs.groth16.fullProve(
                input,
                cache.wasmBuffer!,
                cache.zkeyBuffer!
            );

            console.log('✅ Access verification proof generated');
            return { proof, publicSignals };
        } catch (error) {
            console.error('❌ Failed to generate access proof:', error);

            if (error instanceof ZKPError) {
                throw error;
            }

            throw new ZKPError(
                ZKPErrorType.PROOF_GENERATION_FAILED,
                `Access proof generation failed: ${error instanceof Error ? error.message : String(error)}`,
                parseInt(input.recordId)
            );
        }
    }

    /**
     * Validate access verification input
     */
    private validateAccessInput(input: AccessVerificationInput): void {
        const requiredFields = ['recordId', 'userAddress', 'issuerAddress', 'studentAddress', 'accessType', 'timestamp', 'accessSecret'];

        for (const field of requiredFields) {
            if (!input[field as keyof AccessVerificationInput]) {
                throw new ZKPError(
                    ZKPErrorType.INVALID_INPUT,
                    `Missing required field: ${field}`
                );
            }
        }

        // Validate Ethereum addresses
        const addressFields = ['userAddress', 'issuerAddress', 'studentAddress'];
        for (const field of addressFields) {
            const address = input[field as keyof AccessVerificationInput] as string;
            if (!this.isValidEthereumAddress(address)) {
                throw new ZKPError(
                    ZKPErrorType.INVALID_INPUT,
                    `Invalid Ethereum address for field: ${field}`
                );
            }
        }

        // Validate access type
        const accessType = parseInt(input.accessType);
        if (accessType < 0 || accessType > 3) {
            throw new ZKPError(
                ZKPErrorType.INVALID_INPUT,
                'Invalid access type. Must be 0 (OWNER), 1 (SHARED), 2 (ADMIN), or 3 (EMERGENCY)'
            );
        }
    }

    /**
     * Generate record sharing proof
     */
    public async generateSharingProof(
        input: RecordSharingInput
    ): Promise<ZKProof> {
        await this.ensureInitialized();

        try {
            // Validate input
            this.validateSharingInput(input);

            const cache = this.circuitCache.get('record_sharing');
            if (!cache) {
                throw new ZKPError(
                    ZKPErrorType.CIRCUIT_NOT_FOUND,
                    'Record sharing circuit not loaded'
                );
            }

            console.log('🔧 Generating record sharing proof...');

            const { proof, publicSignals } = await snarkjs.groth16.fullProve(
                input,
                cache.wasmBuffer!,
                cache.zkeyBuffer!
            );

            console.log('✅ Record sharing proof generated');
            return { proof, publicSignals };
        } catch (error) {
            console.error('❌ Failed to generate sharing proof:', error);

            if (error instanceof ZKPError) {
                throw error;
            }

            throw new ZKPError(
                ZKPErrorType.PROOF_GENERATION_FAILED,
                `Sharing proof generation failed: ${error instanceof Error ? error.message : String(error)}`,
                parseInt(input.recordId)
            );
        }
    }

    /**
     * Validate sharing input
     */
    private validateSharingInput(input: RecordSharingInput): void {
        const requiredFields = ['recordId', 'ownerAddress', 'sharedWithAddress', 'expiryTime', 'currentTime', 'shareSecret', 'userAddress'];

        for (const field of requiredFields) {
            if (!input[field as keyof RecordSharingInput]) {
                throw new ZKPError(
                    ZKPErrorType.INVALID_INPUT,
                    `Missing required field: ${field}`
                );
            }
        }

        // Validate Ethereum addresses
        const addressFields = ['ownerAddress', 'sharedWithAddress', 'userAddress'];
        for (const field of addressFields) {
            const address = input[field as keyof RecordSharingInput] as string;
            if (!this.isValidEthereumAddress(address)) {
                throw new ZKPError(
                    ZKPErrorType.INVALID_INPUT,
                    `Invalid Ethereum address for field: ${field}`
                );
            }
        }

        // Validate timestamps
        const currentTime = parseInt(input.currentTime);
        const expiryTime = parseInt(input.expiryTime);

        if (expiryTime <= currentTime) {
            throw new ZKPError(
                ZKPErrorType.INVALID_INPUT,
                'Expiry time must be greater than current time'
            );
        }
    }

    /**
     * Verify a ZK proof using verification key
     */
    public async verifyProof(
        proof: ZKProof,
        circuitName: string
    ): Promise<boolean> {
        await this.ensureInitialized();

        try {
            // Validate proof structure
            if (!this.isValidProofStructure(proof)) {
                throw new ZKPError(
                    ZKPErrorType.INVALID_INPUT,
                    'Invalid proof structure'
                );
            }

            const cache = this.circuitCache.get(circuitName);
            if (!cache || !cache.vkeyData) {
                throw new ZKPError(
                    ZKPErrorType.CIRCUIT_NOT_FOUND,
                    `Verification key not found for circuit: ${circuitName}`
                );
            }

            console.log('🔍 Verifying proof...');

            const isValid = await snarkjs.groth16.verify(
                cache.vkeyData,
                proof.publicSignals,
                proof.proof
            );

            console.log(`✅ Proof verification result: ${isValid}`);
            return isValid;
        } catch (error) {
            console.error('❌ Failed to verify proof:', error);

            if (error instanceof ZKPError) {
                throw error;
            }

            throw new ZKPError(
                ZKPErrorType.PROOF_VERIFICATION_FAILED,
                `Proof verification failed: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Create an access token for record sharing
     */
    public async createAccessToken(
        recordId: number,
        sharedWith: string,
        duration: number
    ): Promise<string> {
        const expiryTime = Math.floor(Date.now() / 1000) + duration;
        const currentTime = Math.floor(Date.now() / 1000);

        // Generate a sharing proof to create the token
        const sharingInput: RecordSharingInput = {
            recordId: recordId.toString(),
            ownerAddress: '0x0000000000000000000000000000000000000000', // This would be the actual owner
            sharedWithAddress: sharedWith,
            expiryTime: expiryTime.toString(),
            currentTime: currentTime.toString(),
            shareSecret: this.generateShareSecret(),
            userAddress: '0x0000000000000000000000000000000000000000' // This would be the actual user
        };

        try {
            const proof = await this.generateSharingProof(sharingInput);

            // Create token from proof
            const token = this.createTokenFromProof(proof, expiryTime);
            return token;
        } catch (error) {
            console.error('❌ Failed to create access token:', error);
            throw new Error(`Access token creation failed: ${error}`);
        }
    }

    /**
     * Validate an access token
     */
    public validateAccessToken(token: string): boolean {
        try {
            const decoded = this.decodeToken(token);
            const currentTime = Math.floor(Date.now() / 1000);

            return decoded.expiryTime > currentTime && decoded.isValid;
        } catch (error) {
            console.error('❌ Failed to validate access token:', error);
            return false;
        }
    }

    /**
     * Get circuit integrity status
     */
    public async getCircuitStatus(): Promise<{ [key: string]: boolean }> {
        const status: { [key: string]: boolean } = {};

        for (const [circuitName] of this.circuitCache) {
            try {
                // In a real implementation, you would verify circuit integrity
                status[circuitName] = true;
            } catch (error) {
                status[circuitName] = false;
            }
        }

        return status;
    }

    /**
     * Clear circuit cache (useful for testing or memory management)
     */
    public clearCache(): void {
        this.circuitCache.clear();
        this.isInitialized = false;
        this.initializationPromise = null;
        console.log('🧹 Circuit cache cleared');
    }

    /**
     * Get cache statistics
     */
    public getCacheStats(): { [key: string]: any } {
        const stats: { [key: string]: any } = {};

        for (const [circuitName, cache] of this.circuitCache) {
            stats[circuitName] = {
                lastLoaded: new Date(cache.lastLoaded).toISOString(),
                wasmSize: cache.wasmBuffer?.byteLength || 0,
                zkeySize: cache.zkeyBuffer?.byteLength || 0,
                hasVkey: !!cache.vkeyData
            };
        }

        return stats;
    }

    // Private helper methods

    private async ensureInitialized(): Promise<void> {
        if (!this.isInitialized) {
            await this.initialize();
        }
    }

    private isValidProofStructure(proof: ZKProof): boolean {
        return !!(
            proof.proof &&
            proof.proof.pi_a &&
            Array.isArray(proof.proof.pi_a) &&
            proof.proof.pi_b &&
            Array.isArray(proof.proof.pi_b) &&
            proof.proof.pi_c &&
            Array.isArray(proof.proof.pi_c) &&
            proof.publicSignals &&
            Array.isArray(proof.publicSignals)
        );
    }

    private isValidEthereumAddress(address: string): boolean {
        return /^0x[a-fA-F0-9]{40}$/.test(address);
    }

    private generateShareSecret(): string {
        // Generate a random secret for sharing
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    private createTokenFromProof(proof: ZKProof, expiryTime: number): string {
        // Create a simple token structure (in production, use proper JWT or similar)
        const tokenData = {
            proofHash: proof.publicSignals[1] || '',
            expiryTime,
            timestamp: Date.now()
        };

        return btoa(JSON.stringify(tokenData));
    }

    private decodeToken(token: string): { expiryTime: number; isValid: boolean } {
        try {
            const decoded = JSON.parse(atob(token));
            return {
                expiryTime: decoded.expiryTime || 0,
                isValid: !!(decoded.proofHash && decoded.timestamp)
            };
        } catch {
            return { expiryTime: 0, isValid: false };
        }
    }
}

// Export singleton instance
export const zkpService = ZKPService.getInstance();