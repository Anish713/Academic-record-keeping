/**
 * Tests for ZKP Services integration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ZKPService, ZKPError, ZKPErrorType } from '../zkp';
import { EncryptionService, EncryptionError, EncryptionErrorType } from '../encryption';
import { AccessTokenService, AccessTokenError, AccessAction } from '../accessToken';

// Mock crypto API for testing
const mockCrypto = {
    getRandomValues: vi.fn((array: Uint8Array) => {
        for (let i = 0; i < array.length; i++) {
            array[i] = Math.floor(Math.random() * 256);
        }
        return array;
    }),
    subtle: {
        encrypt: vi.fn(),
        decrypt: vi.fn(),
        importKey: vi.fn(),
        deriveKey: vi.fn(),
        deriveBits: vi.fn(),
        digest: vi.fn()
    }
};

// Mock fetch for circuit loading
const mockFetch = vi.fn();

// Setup mocks
beforeEach(() => {
    vi.clearAllMocks();
    global.crypto = mockCrypto as any;
    global.fetch = mockFetch;

    // Mock successful responses
    mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
        json: () => Promise.resolve({ protocol: 'groth16', curve: 'bn128' })
    });
});

describe('ZKPService', () => {
    let zkpService: ZKPService;

    beforeEach(() => {
        zkpService = ZKPService.getInstance();
        zkpService.clearCache(); // Reset for each test
    });

    it('should initialize successfully', async () => {
        await expect(zkpService.initialize()).resolves.not.toThrow();
    });

    it('should handle initialization failure gracefully', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'));

        await expect(zkpService.initialize()).rejects.toThrow(ZKPError);
    });

    it('should validate access input correctly', async () => {
        const invalidInput = {
            recordId: '',
            userAddress: 'invalid-address',
            issuerAddress: '0x1234567890123456789012345678901234567890',
            studentAddress: '0x1234567890123456789012345678901234567890',
            accessType: '0',
            timestamp: '1234567890',
            accessSecret: 'secret'
        };

        // Mock initialization
        mockFetch.mockResolvedValue({
            ok: true,
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
            json: () => Promise.resolve({ protocol: 'groth16' })
        });

        await zkpService.initialize();

        await expect(zkpService.generateAccessProof(invalidInput as any))
            .rejects.toThrow(ZKPError);
    });

    it('should get cache statistics', async () => {
        await zkpService.initialize();
        const stats = zkpService.getCacheStats();

        expect(stats).toHaveProperty('access_verification');
        expect(stats).toHaveProperty('record_sharing');
    });
});

describe('EncryptionService', () => {
    let encryptionService: EncryptionService;

    beforeEach(() => {
        encryptionService = EncryptionService.getInstance();

        // Mock crypto operations
        mockCrypto.subtle.encrypt.mockResolvedValue(new ArrayBuffer(64));
        mockCrypto.subtle.decrypt.mockResolvedValue(new ArrayBuffer(46)); // IPFS hash length
        mockCrypto.subtle.importKey.mockResolvedValue({} as CryptoKey);
        mockCrypto.subtle.deriveKey.mockResolvedValue({} as CryptoKey);
        mockCrypto.subtle.deriveBits.mockResolvedValue(new ArrayBuffer(32));
    });

    it('should validate IPFS hash format', async () => {
        const invalidHash = 'invalid-hash';

        await expect(encryptionService.encryptIPFSHash(invalidHash, 1, '0x1234567890123456789012345678901234567890'))
            .rejects.toThrow(EncryptionError);
    });

    it('should validate Ethereum address format', async () => {
        const validHash = 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG';
        const invalidAddress = 'invalid-address';

        await expect(encryptionService.encryptIPFSHash(validHash, 1, invalidAddress))
            .rejects.toThrow(EncryptionError);
    });

    it('should handle encryption success', async () => {
        const validHash = 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG';
        const validAddress = '0x1234567890123456789012345678901234567890';

        const result = await encryptionService.encryptIPFSHash(validHash, 1, validAddress);

        expect(result).toHaveProperty('encryptedData');
        expect(result).toHaveProperty('iv');
        expect(result).toHaveProperty('salt');
        expect(result).toHaveProperty('algorithm');
        expect(result).toHaveProperty('keyDerivation');
    });
});

describe('AccessTokenService', () => {
    let accessTokenService: AccessTokenService;

    beforeEach(() => {
        accessTokenService = AccessTokenService.getInstance();

        // Mock crypto digest for signature creation
        mockCrypto.subtle.digest.mockResolvedValue(new ArrayBuffer(32));
    });

    it('should validate sharing request', async () => {
        const invalidRequest = {
            recordId: 0, // Invalid
            sharedWithAddress: 'invalid-address',
            duration: -1, // Invalid
            permissions: [],
            ownerAddress: '0x1234567890123456789012345678901234567890'
        };

        await expect(accessTokenService.createSharingToken(invalidRequest))
            .rejects.toThrow(AccessTokenError);
    });

    it('should create valid sharing token', async () => {
        // Mock ZKP service
        const mockZkpService = {
            generateSharingProof: vi.fn().mockResolvedValue({
                proof: { pi_a: [], pi_b: [], pi_c: [] },
                publicSignals: ['1', 'hash123']
            })
        };

        // Replace the zkpService import with mock
        vi.doMock('../zkp', () => ({
            zkpService: mockZkpService,
            ZKPError: class extends Error { },
            ZKPErrorType: {}
        }));

        const validRequest = {
            recordId: 1,
            sharedWithAddress: '0x9876543210987654321098765432109876543210',
            duration: 3600, // 1 hour
            permissions: [AccessAction.VIEW, AccessAction.VERIFY],
            ownerAddress: '0x1234567890123456789012345678901234567890'
        };

        const token = await accessTokenService.createSharingToken(validRequest);

        expect(token).toHaveProperty('tokenId');
        expect(token).toHaveProperty('recordId', 1);
        expect(token).toHaveProperty('ownerAddress', validRequest.ownerAddress);
        expect(token).toHaveProperty('sharedWithAddress', validRequest.sharedWithAddress);
        expect(token.permissions).toHaveLength(2);
    });

    it('should validate access token correctly', async () => {
        const validRequest = {
            recordId: 1,
            sharedWithAddress: '0x9876543210987654321098765432109876543210',
            duration: 3600,
            permissions: [AccessAction.VIEW],
            ownerAddress: '0x1234567890123456789012345678901234567890'
        };

        // Mock ZKP service for token creation
        const mockZkpService = {
            generateSharingProof: vi.fn().mockResolvedValue({
                proof: { pi_a: [], pi_b: [], pi_c: [] },
                publicSignals: ['1', 'hash123']
            })
        };

        vi.doMock('../zkp', () => ({
            zkpService: mockZkpService
        }));

        const token = await accessTokenService.createSharingToken(validRequest);

        // Test valid access
        const validResult = await accessTokenService.validateAccessToken(
            token.tokenId,
            validRequest.sharedWithAddress,
            AccessAction.VIEW
        );

        expect(validResult.isValid).toBe(true);
        expect(validResult.token).toBeDefined();

        // Test invalid user
        const invalidUserResult = await accessTokenService.validateAccessToken(
            token.tokenId,
            '0x0000000000000000000000000000000000000000',
            AccessAction.VIEW
        );

        expect(invalidUserResult.isValid).toBe(false);
        expect(invalidUserResult.error).toContain('Unauthorized user');
    });

    it('should handle token revocation', async () => {
        const validRequest = {
            recordId: 1,
            sharedWithAddress: '0x9876543210987654321098765432109876543210',
            duration: 3600,
            permissions: [AccessAction.VIEW],
            ownerAddress: '0x1234567890123456789012345678901234567890'
        };

        // Mock ZKP service
        const mockZkpService = {
            generateSharingProof: vi.fn().mockResolvedValue({
                proof: { pi_a: [], pi_b: [], pi_c: [] },
                publicSignals: ['1', 'hash123']
            })
        };

        vi.doMock('../zkp', () => ({
            zkpService: mockZkpService
        }));

        const token = await accessTokenService.createSharingToken(validRequest);

        // Revoke token
        const revoked = await accessTokenService.revokeAccessToken(
            token.tokenId,
            validRequest.ownerAddress,
            'Test revocation'
        );

        expect(revoked).toBe(true);

        // Validate revoked token
        const result = await accessTokenService.validateAccessToken(
            token.tokenId,
            validRequest.sharedWithAddress,
            AccessAction.VIEW
        );

        expect(result.isValid).toBe(false);
        expect(result.error).toContain('revoked');
    });

    it('should clean up expired tokens', () => {
        const cleanedCount = accessTokenService.cleanupExpiredTokens();
        expect(typeof cleanedCount).toBe('number');
    });
});