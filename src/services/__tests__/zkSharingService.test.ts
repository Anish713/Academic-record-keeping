/**
 * Tests for ZK-based record sharing functionality
 * Tests the secure record sharing with ZK access control
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ethers } from 'ethers';
import { blockchainService } from '../blockchain';
import { zkService } from '../zkService';
import { ZKError, ZKErrorType } from '../../types/zkTypes';

// Mock ethers and window.ethereum
const mockProvider = {
    send: vi.fn(),
    getSigner: vi.fn(),
};

const mockSigner = {
    getAddress: vi.fn(),
};

const mockContract = {
    shareRecord: vi.fn(),
    unshareRecord: vi.fn(),
    getRecord: vi.fn(),
    isRecordSharedWith: vi.fn(),
    hasRole: vi.fn(),
};

const mockZKContract = {
    hasAccess: vi.fn(),
    getUserAccessKey: vi.fn(),
    getEncryptedRecord: vi.fn(),
    verifyAccess: vi.fn(),
    getEncryptedHash: vi.fn(),
    getUserAccessibleRecords: vi.fn(),
    grantAccess: vi.fn(),
    revokeAccess: vi.fn(),
    updateMerkleRoot: vi.fn(),
};

// Mock environment variables
process.env.NEXT_PUBLIC_PINATA_GATEWAY_URL = 'https://test-gateway.pinata.cloud';
process.env.NEXT_PUBLIC_CONTRACT_ADDRESS = '0x1234567890123456789012345678901234567890';
process.env.NEXT_PUBLIC_STUDENT_MANAGEMENT_CONTRACT_ADDRESS = '0x0987654321098765432109876543210987654321';
process.env.NEXT_PUBLIC_ZK_CONTRACT_ADDRESS = '0x1111111111111111111111111111111111111111';

// Mock window.ethereum
Object.defineProperty(window, 'ethereum', {
    value: {
        request: vi.fn(),
    },
    writable: true,
});

// Mock pinata module
vi.mock('../../lib/pinata', () => ({
    getGatewayUrl: vi.fn((hash: string) => `https://test-gateway.pinata.cloud/ipfs/${hash}`),
}));

// Mock ethers
vi.mock('ethers', () => ({
    ethers: {
        BrowserProvider: vi.fn(() => mockProvider),
        Contract: vi.fn(() => mockContract),
        isAddress: vi.fn((address: string) => address.startsWith('0x') && address.length === 42),
        keccak256: vi.fn((data: string) => `0x${'1234567890abcdef'.repeat(4)}`),
        toUtf8Bytes: vi.fn((str: string) => new Uint8Array(Buffer.from(str, 'utf8'))),
        solidityPackedKeccak256: vi.fn((types: string[], values: any[]) =>
            `0x${values.join('').replace(/[^a-f0-9]/gi, '').padStart(64, '0')}`
        ),
        getBytes: vi.fn((hex: string) => new Uint8Array(Buffer.from(hex.slice(2), 'hex'))),
        hexlify: vi.fn((bytes: Uint8Array) => '0x' + Buffer.from(bytes).toString('hex')),
    },
}));

// Mock fetch for circuit loading
global.fetch = vi.fn();

describe('ZK Record Sharing Service', () => {
    const testRecordId = 1;
    const testOwnerAddress = '0x1234567890123456789012345678901234567890';
    const testSharedAddress = '0x0987654321098765432109876543210987654321';
    const testUniversityAddress = '0x1111111111111111111111111111111111111111';

    const mockRecord = {
        id: testRecordId,
        studentName: 'Test Student',
        studentId: 'TEST001',
        studentAddress: testOwnerAddress,
        universityName: 'Test University',
        recordType: 0,
        ipfsHash: 'QmTestHash',
        timestamp: Date.now(),
        university: testUniversityAddress,
        isValid: true,
    };

    beforeEach(async () => {
        vi.clearAllMocks();

        // Setup mock responses
        mockProvider.send.mockResolvedValue(['0x1234567890123456789012345678901234567890']);
        mockProvider.getSigner.mockResolvedValue(mockSigner);
        mockSigner.getAddress.mockResolvedValue(testOwnerAddress);

        mockContract.getRecord.mockResolvedValue(mockRecord);
        mockContract.shareRecord.mockResolvedValue({ wait: vi.fn().mockResolvedValue({}) });
        mockContract.unshareRecord.mockResolvedValue({ wait: vi.fn().mockResolvedValue({}) });
        mockContract.isRecordSharedWith.mockResolvedValue(true);
        mockContract.hasRole.mockResolvedValue(false);

        // Mock ZK contract responses
        mockZKContract.hasAccess.mockResolvedValue(true);
        mockZKContract.getUserAccessKey.mockResolvedValue('0xaccesskey123');
        mockZKContract.getEncryptedRecord.mockResolvedValue({
            encryptedIPFSHash: '0xencrypted123',
            encryptedMetadataHash: '0xmetadata123',
            merkleRoot: '0xmerkleroot123',
            timestamp: Date.now(),
            owner: testOwnerAddress,
            exists: true,
        });

        // Mock fetch responses for circuit loading
        (global.fetch as any).mockImplementation((url: string) => {
            if (url.includes('.wasm')) {
                return Promise.resolve({
                    ok: true,
                    arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
                });
            }
            if (url.includes('.zkey')) {
                return Promise.resolve({
                    ok: true,
                    arrayBuffer: () => Promise.resolve(new ArrayBuffer(2048)),
                });
            }
            if (url.includes('verification_key.json')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ vk_alpha_1: ['0x1', '0x2'] }),
                });
            }
            return Promise.reject(new Error('Unknown URL'));
        });

        // Initialize services
        await blockchainService.init();

        // Manually set the contract to our mock since init() might fail in test environment
        (blockchainService as any).contract = mockContract;
        (blockchainService as any).studentManagementContract = mockContract;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('shareRecordWithZK', () => {
        it('should successfully share a record with ZK access control', async () => {
            // Test sharing a record
            await expect(
                blockchainService.shareRecordWithZK(testRecordId, testSharedAddress)
            ).resolves.not.toThrow();

            // Verify the contract method was called
            expect(mockContract.shareRecord).toHaveBeenCalledWith(testRecordId, testSharedAddress);
        });

        it('should throw error for invalid shared address', async () => {
            const invalidAddress = 'invalid-address';

            await expect(
                blockchainService.shareRecordWithZK(testRecordId, invalidAddress)
            ).rejects.toThrow('Invalid shared address');
        });

        it('should throw error when user is not record owner', async () => {
            // Mock different current address
            mockSigner.getAddress.mockResolvedValue(testSharedAddress);

            await expect(
                blockchainService.shareRecordWithZK(testRecordId, testSharedAddress)
            ).rejects.toThrow('Only record owner can share records');
        });

        it('should handle ZK service errors gracefully', async () => {
            // Mock ZK service to throw error
            vi.spyOn(zkService, 'hasAccessToRecord').mockRejectedValue(new Error('ZK error'));

            // Should still complete the sharing operation
            await expect(
                blockchainService.shareRecordWithZK(testRecordId, testSharedAddress)
            ).resolves.not.toThrow();

            expect(mockContract.shareRecord).toHaveBeenCalled();
        });
    });

    describe('unshareRecordWithZK', () => {
        it('should successfully unshare a record with ZK access control', async () => {
            await expect(
                blockchainService.unshareRecordWithZK(testRecordId, testSharedAddress)
            ).resolves.not.toThrow();

            expect(mockContract.unshareRecord).toHaveBeenCalledWith(testRecordId, testSharedAddress);
        });

        it('should throw error for invalid shared address', async () => {
            const invalidAddress = 'invalid-address';

            await expect(
                blockchainService.unshareRecordWithZK(testRecordId, invalidAddress)
            ).rejects.toThrow('Invalid shared address');
        });

        it('should throw error when user is not record owner', async () => {
            mockSigner.getAddress.mockResolvedValue(testSharedAddress);

            await expect(
                blockchainService.unshareRecordWithZK(testRecordId, testSharedAddress)
            ).rejects.toThrow('Only record owner can unshare records');
        });

        it('should throw error when record is not shared with address', async () => {
            mockContract.isRecordSharedWith.mockResolvedValue(false);

            await expect(
                blockchainService.unshareRecordWithZK(testRecordId, testSharedAddress)
            ).rejects.toThrow('Record is not shared with this address');
        });
    });

    describe('generateAccessKey', () => {
        it('should generate a unique access key', async () => {
            const accessKey = await blockchainService.generateAccessKey(
                testRecordId,
                testSharedAddress
            );

            expect(accessKey).toBeDefined();
            expect(typeof accessKey).toBe('string');
            expect(accessKey.startsWith('0x')).toBe(true);
        });

        it('should generate different keys for different users', async () => {
            const accessKey1 = await blockchainService.generateAccessKey(
                testRecordId,
                testSharedAddress
            );
            const accessKey2 = await blockchainService.generateAccessKey(
                testRecordId,
                '0x2222222222222222222222222222222222222222'
            );

            expect(accessKey1).not.toBe(accessKey2);
        });

        it('should generate different keys for different records', async () => {
            const accessKey1 = await blockchainService.generateAccessKey(
                testRecordId,
                testSharedAddress
            );
            const accessKey2 = await blockchainService.generateAccessKey(
                testRecordId + 1,
                testSharedAddress
            );

            expect(accessKey1).not.toBe(accessKey2);
        });
    });

    describe('batchShareRecord', () => {
        const multipleAddresses = [
            '0x1111111111111111111111111111111111111111',
            '0x2222222222222222222222222222222222222222',
            '0x3333333333333333333333333333333333333333',
        ];

        it('should successfully share record with multiple addresses', async () => {
            await expect(
                blockchainService.batchShareRecord(testRecordId, multipleAddresses)
            ).resolves.not.toThrow();

            expect(mockContract.shareRecord).toHaveBeenCalledTimes(3);
        });

        it('should throw error for empty addresses array', async () => {
            await expect(
                blockchainService.batchShareRecord(testRecordId, [])
            ).rejects.toThrow('Invalid addresses array');
        });

        it('should throw error for invalid address in array', async () => {
            const invalidAddresses = [...multipleAddresses, 'invalid-address'];

            await expect(
                blockchainService.batchShareRecord(testRecordId, invalidAddresses)
            ).rejects.toThrow('Invalid address: invalid-address');
        });

        it('should stop on first failure', async () => {
            // Mock the second share to fail
            mockContract.shareRecord
                .mockResolvedValueOnce({ wait: vi.fn().mockResolvedValue({}) })
                .mockRejectedValueOnce(new Error('Share failed'));

            await expect(
                blockchainService.batchShareRecord(testRecordId, multipleAddresses)
            ).rejects.toThrow('Share failed');

            // Should only call once before failing
            expect(mockContract.shareRecord).toHaveBeenCalledTimes(1);
        });
    });

    describe('batchUnshareRecord', () => {
        const multipleAddresses = [
            '0x1111111111111111111111111111111111111111',
            '0x2222222222222222222222222222222222222222',
            '0x3333333333333333333333333333333333333333',
        ];

        it('should successfully unshare record from multiple addresses', async () => {
            await expect(
                blockchainService.batchUnshareRecord(testRecordId, multipleAddresses)
            ).resolves.not.toThrow();

            expect(mockContract.unshareRecord).toHaveBeenCalledTimes(3);
        });

        it('should continue even if one unshare fails', async () => {
            // Mock the second unshare to fail
            mockContract.unshareRecord
                .mockResolvedValueOnce({ wait: vi.fn().mockResolvedValue({}) })
                .mockRejectedValueOnce(new Error('Unshare failed'))
                .mockResolvedValueOnce({ wait: vi.fn().mockResolvedValue({}) });

            await expect(
                blockchainService.batchUnshareRecord(testRecordId, multipleAddresses)
            ).resolves.not.toThrow();

            // Should call all three times
            expect(mockContract.unshareRecord).toHaveBeenCalledTimes(3);
        });
    });

    describe('ZK Service Integration', () => {
        beforeEach(async () => {
            // Initialize ZK service with mocked contract
            vi.spyOn(zkService, 'getZKContract').mockReturnValue(mockZKContract as any);

            // Mock ZK service initialization
            (zkService as any).isInitialized = true;
            (zkService as any).circuit = new ArrayBuffer(1024);
            (zkService as any).provingKey = new ArrayBuffer(2048);
            (zkService as any).verificationKey = { vk_alpha_1: ['0x1', '0x2'] };
            (zkService as any).zkContract = mockZKContract;
        });

        it('should generate access credentials for sharing', async () => {
            const credentials = await zkService.generateAccessCredentials(
                testRecordId,
                testSharedAddress
            );

            expect(credentials).toBeDefined();
            expect(credentials.recordId).toBe(testRecordId);
            expect(credentials.userAddress).toBe(testSharedAddress);
            expect(credentials.accessKey).toBeDefined();
            expect(credentials.merkleProof).toBeDefined();
            expect(credentials.timestamp).toBeDefined();
        });

        it('should validate access credentials', async () => {
            const isValid = await zkService.validateAccessCredentials(
                testRecordId,
                testSharedAddress,
                '0xaccesskey123'
            );

            expect(isValid).toBe(true);
            expect(mockZKContract.hasAccess).toHaveBeenCalledWith(testRecordId, testSharedAddress);
            expect(mockZKContract.getUserAccessKey).toHaveBeenCalledWith(testRecordId, testSharedAddress);
        });

        it('should update Merkle tree for sharing', async () => {
            const newMerkleRoot = await zkService.updateMerkleTreeForSharing(
                testRecordId,
                testSharedAddress
            );

            expect(newMerkleRoot).toBeDefined();
            expect(typeof newMerkleRoot).toBe('string');
            expect(newMerkleRoot.startsWith('0x')).toBe(true);
        });

        it('should update Merkle tree for unsharing', async () => {
            const newMerkleRoot = await zkService.updateMerkleTreeForUnsharing(
                testRecordId,
                testSharedAddress
            );

            expect(newMerkleRoot).toBeDefined();
            expect(typeof newMerkleRoot).toBe('string');
            expect(newMerkleRoot.startsWith('0x')).toBe(true);
        });

        it('should verify proof generation capability', async () => {
            // Mock successful proof generation
            vi.spyOn(zkService, 'hasAccessToRecord').mockResolvedValue(true);
            vi.spyOn(zkService, 'getUserAccessKey').mockResolvedValue('0xaccesskey123');
            vi.spyOn(zkService, 'generateAccessProof').mockResolvedValue({
                proof: {
                    pi_a: ['0x1', '0x2'],
                    pi_b: [['0x3', '0x4'], ['0x5', '0x6']],
                    pi_c: ['0x7', '0x8'],
                    publicSignals: ['1', '2', '3'],
                },
                publicSignals: ['1', '2', '3'],
            });

            const canGenerate = await zkService.canGenerateValidProof(testRecordId);

            expect(canGenerate).toBe(true);
        });

        it('should handle ZK errors properly', async () => {
            mockZKContract.hasAccess.mockRejectedValue(new Error('Contract error'));

            const isValid = await zkService.validateAccessCredentials(
                testRecordId,
                testSharedAddress,
                '0xaccesskey123'
            );

            expect(isValid).toBe(false);
        });
    });

    describe('Fallback to Legacy Sharing', () => {
        beforeEach(() => {
            // Disable ZK initialization
            vi.spyOn(blockchainService, 'isZKEnabled').mockReturnValue(false);
        });

        it('should use legacy sharing when ZK is not initialized', async () => {
            await blockchainService.shareRecord(testRecordId, testSharedAddress);

            expect(mockContract.shareRecord).toHaveBeenCalledWith(testRecordId, testSharedAddress);
        });

        it('should use legacy unsharing when ZK is not initialized', async () => {
            await blockchainService.unshareRecord(testRecordId, testSharedAddress);

            expect(mockContract.unshareRecord).toHaveBeenCalledWith(testRecordId, testSharedAddress);
        });
    });

    describe('Error Handling', () => {
        it('should handle contract transaction failures', async () => {
            mockContract.shareRecord.mockRejectedValue(new Error('Transaction failed'));

            await expect(
                blockchainService.shareRecordWithZK(testRecordId, testSharedAddress)
            ).rejects.toThrow('Transaction failed');
        });

        it('should handle network errors gracefully', async () => {
            mockProvider.send.mockRejectedValue(new Error('Network error'));

            await expect(
                blockchainService.shareRecordWithZK(testRecordId, testSharedAddress)
            ).rejects.toThrow();
        });

        it('should handle ZK service initialization failures', async () => {
            vi.spyOn(zkService, 'init').mockRejectedValue(new ZKError(
                ZKErrorType.CIRCUIT_NOT_LOADED,
                'Failed to load circuit'
            ));

            // Service should still work with legacy methods
            await expect(
                blockchainService.shareRecord(testRecordId, testSharedAddress)
            ).resolves.not.toThrow();
        });
    });
});