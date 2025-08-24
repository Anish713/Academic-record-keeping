/**
 * Encryption Service for secure IPFS hash and metadata encryption
 * 
 * This service handles AES-256-GCM encryption/decryption with HKDF-SHA256 key derivation
 * for protecting academic record data and metadata.
 */

// Error types for encryption operations
export enum EncryptionErrorType {
    ENCRYPTION_FAILED = "ENCRYPTION_FAILED",
    DECRYPTION_FAILED = "DECRYPTION_FAILED",
    KEY_DERIVATION_FAILED = "KEY_DERIVATION_FAILED",
    INVALID_INPUT = "INVALID_INPUT",
    UNSUPPORTED_BROWSER = "UNSUPPORTED_BROWSER",
    KEY_NOT_FOUND = "KEY_NOT_FOUND"
}

export class EncryptionError extends Error {
    constructor(
        public type: EncryptionErrorType,
        public details: string,
        public recordId?: number
    ) {
        super(`Encryption Error [${type}]: ${details}`);
        this.name = 'EncryptionError';
    }
}

// Interfaces for encrypted data
export interface EncryptedData {
    encryptedData: string; // Base64 encoded encrypted data
    iv: string; // Base64 encoded initialization vector
    salt: string; // Base64 encoded salt used for key derivation
    algorithm: string; // Encryption algorithm used
    keyDerivation: string; // Key derivation method used
}

export interface EncryptedMetadata {
    encryptedIPFSHash: EncryptedData;
    encryptedMetadata?: EncryptedData;
    recordId: number;
    timestamp: number;
}

export interface KeyDerivationParams {
    salt: Uint8Array;
    iterations?: number;
    keyLength?: number;
    hashFunction?: string;
}

export class EncryptionService {
    private static instance: EncryptionService;
    private readonly ALGORITHM = 'AES-GCM';
    private readonly KEY_LENGTH = 256; // bits
    private readonly IV_LENGTH = 12; // bytes for GCM
    private readonly SALT_LENGTH = 32; // bytes
    private readonly TAG_LENGTH = 16; // bytes for GCM authentication tag
    private readonly HKDF_ITERATIONS = 100000;

    private constructor() {
        this.checkBrowserSupport();
    }

    public static getInstance(): EncryptionService {
        if (!EncryptionService.instance) {
            EncryptionService.instance = new EncryptionService();
        }
        return EncryptionService.instance;
    }

    /**
     * Check if the browser supports required crypto APIs
     */
    private checkBrowserSupport(): void {
        if (!window.crypto || !window.crypto.subtle) {
            throw new EncryptionError(
                EncryptionErrorType.UNSUPPORTED_BROWSER,
                'Browser does not support Web Crypto API'
            );
        }
    }

    /**
     * Encrypt IPFS hash with record-specific key derivation
     */
    public async encryptIPFSHash(
        ipfsHash: string,
        recordId: number,
        issuerAddress: string
    ): Promise<EncryptedData> {
        try {
            this.validateIPFSHash(ipfsHash);
            this.validateEthereumAddress(issuerAddress);

            // Generate record-specific salt
            const salt = await this.generateRecordSalt(recordId, issuerAddress);

            // Derive encryption key
            const key = await this.deriveKey(salt, recordId, issuerAddress);

            // Generate random IV
            const iv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));

            // Encrypt the IPFS hash
            const encoder = new TextEncoder();
            const data = encoder.encode(ipfsHash);

            const encryptedBuffer = await crypto.subtle.encrypt(
                {
                    name: this.ALGORITHM,
                    iv: iv,
                    tagLength: this.TAG_LENGTH * 8 // Convert to bits
                },
                key,
                data
            );

            return {
                encryptedData: this.arrayBufferToBase64(encryptedBuffer),
                iv: this.arrayBufferToBase64(iv),
                salt: this.arrayBufferToBase64(salt),
                algorithm: `${this.ALGORITHM}-${this.KEY_LENGTH}`,
                keyDerivation: `HKDF-SHA256-${this.HKDF_ITERATIONS}`
            };
        } catch (error) {
            console.error('❌ Failed to encrypt IPFS hash:', error);

            if (error instanceof EncryptionError) {
                throw error;
            }

            throw new EncryptionError(
                EncryptionErrorType.ENCRYPTION_FAILED,
                `IPFS hash encryption failed: ${error instanceof Error ? error.message : String(error)}`,
                recordId
            );
        }
    }

    /**
     * Decrypt IPFS hash for authorized users
     */
    public async decryptIPFSHash(
        encryptedData: EncryptedData,
        recordId: number,
        userAddress: string,
        issuerAddress: string
    ): Promise<string> {
        try {
            this.validateEthereumAddress(userAddress);
            this.validateEthereumAddress(issuerAddress);
            this.validateEncryptedData(encryptedData);

            // Convert base64 back to arrays
            const salt = this.base64ToArrayBuffer(encryptedData.salt);
            const iv = this.base64ToArrayBuffer(encryptedData.iv);
            const encrypted = this.base64ToArrayBuffer(encryptedData.encryptedData);

            // Derive the same key used for encryption
            const key = await this.deriveKey(new Uint8Array(salt), recordId, issuerAddress);

            // Decrypt the data
            const decryptedBuffer = await crypto.subtle.decrypt(
                {
                    name: this.ALGORITHM,
                    iv: new Uint8Array(iv),
                    tagLength: this.TAG_LENGTH * 8
                },
                key,
                encrypted
            );

            const decoder = new TextDecoder();
            const ipfsHash = decoder.decode(decryptedBuffer);

            this.validateIPFSHash(ipfsHash);
            return ipfsHash;
        } catch (error) {
            console.error('❌ Failed to decrypt IPFS hash:', error);

            if (error instanceof EncryptionError) {
                throw error;
            }

            throw new EncryptionError(
                EncryptionErrorType.DECRYPTION_FAILED,
                `IPFS hash decryption failed: ${error instanceof Error ? error.message : String(error)}`,
                recordId
            );
        }
    }

    /**
     * Encrypt document metadata
     */
    public async encryptMetadata(
        metadata: any,
        recordId: number,
        issuerAddress: string
    ): Promise<EncryptedData> {
        try {
            const metadataString = JSON.stringify(metadata);
            return await this.encryptIPFSHash(metadataString, recordId, issuerAddress);
        } catch (error) {
            throw new EncryptionError(
                EncryptionErrorType.ENCRYPTION_FAILED,
                `Metadata encryption failed: ${error instanceof Error ? error.message : String(error)}`,
                recordId
            );
        }
    }

    /**
     * Decrypt document metadata
     */
    public async decryptMetadata(
        encryptedData: EncryptedData,
        recordId: number,
        userAddress: string,
        issuerAddress: string
    ): Promise<any> {
        try {
            const metadataString = await this.decryptIPFSHash(
                encryptedData,
                recordId,
                userAddress,
                issuerAddress
            );
            return JSON.parse(metadataString);
        } catch (error) {
            throw new EncryptionError(
                EncryptionErrorType.DECRYPTION_FAILED,
                `Metadata decryption failed: ${error instanceof Error ? error.message : String(error)}`,
                recordId
            );
        }
    }

    /**
     * Generate a master key for a record (used by issuer)
     */
    public async generateRecordKey(
        recordId: number,
        issuerAddress: string
    ): Promise<CryptoKey> {
        try {
            const salt = await this.generateRecordSalt(recordId, issuerAddress);
            return await this.deriveKey(salt, recordId, issuerAddress);
        } catch (error) {
            throw new EncryptionError(
                EncryptionErrorType.KEY_DERIVATION_FAILED,
                `Record key generation failed: ${error instanceof Error ? error.message : String(error)}`,
                recordId
            );
        }
    }

    /**
     * Derive user-specific key for accessing shared records
     */
    public async deriveUserKey(
        recordId: number,
        userAddress: string,
        issuerAddress: string,
        shareSecret?: string
    ): Promise<CryptoKey> {
        try {
            // For shared access, include share secret in key derivation
            const salt = shareSecret
                ? await this.generateSharedSalt(recordId, userAddress, issuerAddress, shareSecret)
                : await this.generateRecordSalt(recordId, issuerAddress);

            return await this.deriveKey(salt, recordId, issuerAddress);
        } catch (error) {
            throw new EncryptionError(
                EncryptionErrorType.KEY_DERIVATION_FAILED,
                `User key derivation failed: ${error instanceof Error ? error.message : String(error)}`,
                recordId
            );
        }
    }

    /**
     * Generate record-specific salt using HKDF
     */
    private async generateRecordSalt(
        recordId: number,
        issuerAddress: string
    ): Promise<Uint8Array> {
        try {
            const encoder = new TextEncoder();
            const info = encoder.encode(`record:${recordId}:issuer:${issuerAddress.toLowerCase()}`);

            // Use a fixed master salt (in production, this should be from secure configuration)
            const masterSalt = encoder.encode('academic-records-zkp-v1');

            // Import master salt as key material
            const keyMaterial = await crypto.subtle.importKey(
                'raw',
                masterSalt,
                'HKDF',
                false,
                ['deriveKey', 'deriveBits']
            );

            // Derive salt using HKDF
            const derivedBits = await crypto.subtle.deriveBits(
                {
                    name: 'HKDF',
                    hash: 'SHA-256',
                    salt: new Uint8Array(0), // Empty salt for HKDF
                    info: info
                },
                keyMaterial,
                this.SALT_LENGTH * 8 // Convert to bits
            );

            return new Uint8Array(derivedBits);
        } catch (error) {
            throw new EncryptionError(
                EncryptionErrorType.KEY_DERIVATION_FAILED,
                `Salt generation failed: ${error instanceof Error ? error.message : String(error)}`,
                recordId
            );
        }
    }

    /**
     * Generate salt for shared access
     */
    private async generateSharedSalt(
        recordId: number,
        userAddress: string,
        issuerAddress: string,
        shareSecret: string
    ): Promise<Uint8Array> {
        try {
            const encoder = new TextEncoder();
            const info = encoder.encode(
                `shared:${recordId}:user:${userAddress.toLowerCase()}:issuer:${issuerAddress.toLowerCase()}:secret:${shareSecret}`
            );

            const masterSalt = encoder.encode('academic-records-zkp-shared-v1');

            const keyMaterial = await crypto.subtle.importKey(
                'raw',
                masterSalt,
                'HKDF',
                false,
                ['deriveKey', 'deriveBits']
            );

            const derivedBits = await crypto.subtle.deriveBits(
                {
                    name: 'HKDF',
                    hash: 'SHA-256',
                    salt: new Uint8Array(0),
                    info: info
                },
                keyMaterial,
                this.SALT_LENGTH * 8
            );

            return new Uint8Array(derivedBits);
        } catch (error) {
            throw new EncryptionError(
                EncryptionErrorType.KEY_DERIVATION_FAILED,
                `Shared salt generation failed: ${error instanceof Error ? error.message : String(error)}`,
                recordId
            );
        }
    }

    /**
     * Derive encryption key using PBKDF2
     */
    private async deriveKey(
        salt: Uint8Array,
        recordId: number,
        issuerAddress: string
    ): Promise<CryptoKey> {
        try {
            const encoder = new TextEncoder();
            const password = encoder.encode(`${recordId}:${issuerAddress.toLowerCase()}`);

            // Import password as key material
            const keyMaterial = await crypto.subtle.importKey(
                'raw',
                password,
                'PBKDF2',
                false,
                ['deriveKey']
            );

            // Derive AES key using PBKDF2
            const key = await crypto.subtle.deriveKey(
                {
                    name: 'PBKDF2',
                    salt: salt,
                    iterations: this.HKDF_ITERATIONS,
                    hash: 'SHA-256'
                },
                keyMaterial,
                {
                    name: this.ALGORITHM,
                    length: this.KEY_LENGTH
                },
                false, // Not extractable
                ['encrypt', 'decrypt']
            );

            return key;
        } catch (error) {
            throw new EncryptionError(
                EncryptionErrorType.KEY_DERIVATION_FAILED,
                `Key derivation failed: ${error instanceof Error ? error.message : String(error)}`,
                recordId
            );
        }
    }

    // Validation methods

    private validateIPFSHash(ipfsHash: string): void {
        if (!ipfsHash || typeof ipfsHash !== 'string') {
            throw new EncryptionError(
                EncryptionErrorType.INVALID_INPUT,
                'IPFS hash must be a non-empty string'
            );
        }

        // Basic IPFS hash validation (Qm... format)
        if (!ipfsHash.match(/^Qm[1-9A-HJ-NP-Za-km-z]{44}$/)) {
            throw new EncryptionError(
                EncryptionErrorType.INVALID_INPUT,
                'Invalid IPFS hash format'
            );
        }
    }

    private validateEthereumAddress(address: string): void {
        if (!address || typeof address !== 'string') {
            throw new EncryptionError(
                EncryptionErrorType.INVALID_INPUT,
                'Ethereum address must be a non-empty string'
            );
        }

        if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
            throw new EncryptionError(
                EncryptionErrorType.INVALID_INPUT,
                'Invalid Ethereum address format'
            );
        }
    }

    private validateEncryptedData(data: EncryptedData): void {
        const requiredFields = ['encryptedData', 'iv', 'salt', 'algorithm', 'keyDerivation'];

        for (const field of requiredFields) {
            if (!data[field as keyof EncryptedData]) {
                throw new EncryptionError(
                    EncryptionErrorType.INVALID_INPUT,
                    `Missing required field in encrypted data: ${field}`
                );
            }
        }

        // Validate base64 encoding
        try {
            this.base64ToArrayBuffer(data.encryptedData);
            this.base64ToArrayBuffer(data.iv);
            this.base64ToArrayBuffer(data.salt);
        } catch (error) {
            throw new EncryptionError(
                EncryptionErrorType.INVALID_INPUT,
                'Invalid base64 encoding in encrypted data'
            );
        }
    }

    // Utility methods

    private arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    private base64ToArrayBuffer(base64: string): ArrayBuffer {
        try {
            const binary = atob(base64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }
            return bytes.buffer;
        } catch (error) {
            throw new EncryptionError(
                EncryptionErrorType.INVALID_INPUT,
                'Invalid base64 string'
            );
        }
    }
}

// Export singleton instance
export const encryptionService = EncryptionService.getInstance();