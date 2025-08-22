/**
 * Simple integration tests for ZK-enhanced blockchain service methods
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { blockchainService } from '../blockchain';
import { zkService } from '../zkService';

// Mock the ZK service
vi.mock('../zkService', () => ({
    zkService: {
        init: vi.fn(),
        hasAccessToRecord: vi.fn(),
        verifyDocumentAccess: vi.fn(),
        getUserAccessibleRecords: vi.fn(),
    }
}));

// Mock the pinata utility
vi.mock('../../lib/pinata', () => ({
    getGatewayUrl: vi.fn((hash: string) => `https://gateway.pinata.cloud/ipfs/${hash}`)
}));

describe('BlockchainService ZK Integration - Simple Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Mock the internal state to simulate successful initialization
        (blockchainService as any).zkInitialized = true;
        (blockchainService as any).contract = {
            getRecord: vi.fn(),
            hasRole: vi.fn(),
            isRecordSharedWith: vi.fn(),
            getSharedRecords: vi.fn(),
            shareRecord: vi.fn().mockResolvedValue({ wait: vi.fn() }),
            unshareRecord: vi.fn().mockResolvedValue({ wait: vi.fn() }),
        };
        (blockchainService as any).signer = {
            getAddress: vi.fn().mockResolvedValue('0x1234567890123456789012345678901234567890')
        };
    });

    describe('ZK Service Integration', () => {
        it('should check if ZK is enabled', () => {
            expect(blockchainService.isZKEnabled()).toBe(true);
        });

        it('should return ZK service when enabled', () => {
            expect(blockchainService.getZKService()).toBe(zkService);
        });

        it('should throw error when getting ZK service while disabled', () => {
            (blockchainService as any).zkInitialized = false;

            expect(() => blockchainService.getZKService()).toThrow('ZK service not initialized');
        });
    });

    describe('validateZKAccessAndGetURL', () => {
        it('should return error when ZK service not initialized', async () => {
            (blockchainService as any).zkInitialized = false;

            const result = await blockchainService.validateZKAccessAndGetURL(1);

            expect(result).toEqual({
                hasAccess: false,
                error: 'ZK service not initialized'
            });
        });

        it('should return access result with IPFS hash for valid access', async () => {
            (zkService.hasAccessToRecord as Mock).mockResolvedValue(true);
            (zkService.verifyDocumentAccess as Mock).mockResolvedValue('QmValidHash');

            const result = await blockchainService.validateZKAccessAndGetURL(1);

            expect(result).toEqual({
                hasAccess: true,
                ipfsHash: 'QmValidHash'
            });
        });

        it('should return access denied for unauthorized user', async () => {
            (zkService.hasAccessToRecord as Mock).mockResolvedValue(false);

            const result = await blockchainService.validateZKAccessAndGetURL(1);

            expect(result).toEqual({
                hasAccess: false,
                error: 'Access denied - user does not have permission to view this document'
            });
        });

        it('should handle ZK proof verification failure', async () => {
            (zkService.hasAccessToRecord as Mock).mockResolvedValue(true);
            (zkService.verifyDocumentAccess as Mock).mockResolvedValue(null);

            const result = await blockchainService.validateZKAccessAndGetURL(1);

            expect(result).toEqual({
                hasAccess: false,
                error: 'ZK proof verification failed'
            });
        });

        it('should handle errors gracefully', async () => {
            (zkService.hasAccessToRecord as Mock).mockRejectedValue(new Error('Network error'));

            const result = await blockchainService.validateZKAccessAndGetURL(1);

            expect(result).toEqual({
                hasAccess: false,
                error: 'Network error'
            });
        });
    });

    describe('Enhanced sharing methods', () => {
        it('should share record with ZK access control', async () => {
            const mockContract = (blockchainService as any).contract;

            await blockchainService.shareRecordWithZK(1, '0xsharedwithaddress');

            expect(mockContract.shareRecord).toHaveBeenCalledWith(1, '0xsharedwithaddress');
        });

        it('should unshare record with ZK access control', async () => {
            const mockContract = (blockchainService as any).contract;

            await blockchainService.unshareRecordWithZK(1, '0xsharedwithaddress');

            expect(mockContract.unshareRecord).toHaveBeenCalledWith(1, '0xsharedwithaddress');
        });
    });
});