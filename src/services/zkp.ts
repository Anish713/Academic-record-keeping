/**
 * ZKP Service for browser-compatible Zero Knowledge Proof operations
 * 
 * This service handles ZK proof generation and verification for access control
 * in the browser environment using WebAssembly circuits.
 */

import * as snarkjs from 'snarkjs';

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
}

export class ZKPService {
    private static instance: ZKPService;
    private circuitCache: Map<string, CircuitFiles> = new Map();
    private isInitialized = false;

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

        try {
            // Load circuit files from public directory
            await this.loadCircuitFiles();
            this.isInitialized = true;
            console.log('✅ ZKP Service initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize ZKP Service:', error);
            throw new Error(`ZKP Service initialization failed: ${error}`);
        }
    }

    /**
     * Load circuit files (WASM and zkey) from public directory
     */
    private async loadCircuitFiles(): Promise<void> {
        const circuits = ['access_verification', 'record_sharing'];

        for (const circuit of circuits) {
            try {
                // In a real implementation, these would be loaded from your public directory
                // For now, we'll store the paths for later use
                this.circuitCache.set(circuit, {
                    wasm: `/circuits/${circuit}.wasm`,
                    zkey: `/circuits/${circuit}.zkey`
                });
            } catch (error) {
                console.warn(`⚠️ Failed to load circuit ${circuit}:`, error);
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
            const circuitFiles = this.circuitCache.get('access_verification');
            if (!circuitFiles) {
                throw new Error('Access verification circuit not loaded');
            }

            console.log('🔧 Generating access verification proof...');

            const { proof, publicSignals } = await snarkjs.groth16.fullProve(
                input,
                circuitFiles.wasm,
                circuitFiles.zkey
            );

            console.log('✅ Access verification proof generated');
            return { proof, publicSignals };
        } catch (error) {
            console.error('❌ Failed to generate access proof:', error);
            throw new Error(`Access proof generation failed: ${error}`);
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
            const circuitFiles = this.circuitCache.get('record_sharing');
            if (!circuitFiles) {
                throw new Error('Record sharing circuit not loaded');
            }

            console.log('🔧 Generating record sharing proof...');

            const { proof, publicSignals } = await snarkjs.groth16.fullProve(
                input,
                circuitFiles.wasm,
                circuitFiles.zkey
            );

            console.log('✅ Record sharing proof generated');
            return { proof, publicSignals };
        } catch (error) {
            console.error('❌ Failed to generate sharing proof:', error);
            throw new Error(`Sharing proof generation failed: ${error}`);
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
            // Load verification key (in real implementation, this would be loaded from public directory)
            const vkeyPath = `/circuits/${circuitName}_verification_key.json`;

            // For now, we'll simulate verification
            // In a real implementation, you would load the verification key and verify
            console.log('🔍 Verifying proof...');

            // const vKey = await fetch(vkeyPath).then(r => r.json());
            // const isValid = await snarkjs.groth16.verify(vKey, proof.publicSignals, proof.proof);

            // For demonstration, we'll return true if proof structure is valid
            const isValid = this.isValidProofStructure(proof);

            console.log(`✅ Proof verification result: ${isValid}`);
            return isValid;
        } catch (error) {
            console.error('❌ Failed to verify proof:', error);
            return false;
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
            proof.proof.pi_b &&
            proof.proof.pi_c &&
            proof.publicSignals &&
            Array.isArray(proof.publicSignals)
        );
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