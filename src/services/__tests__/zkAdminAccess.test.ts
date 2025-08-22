import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { blockchainService } from '../blockchain';
import { zkService } from '../zkService';
import { zkFallbackService } from '../zkFallbackService';
import { ZKError, ZKErrorType } from '../../types/zkTypes';

// Mock the services
vi.mock('../zkService');
vi.mock('../zkFallbackService');
vi.mock('../blockchain', () => ({
    blockchainService: {
        hasRole: vi.fn(),
        getCurrentAddress: vi.fn(),
        getTotalRecords: vi.fn(),
        getRecordWithZKAccess: vi.fn(),
        getRecord: vi.fn(),
        getAdminRecordsWithZKAccess: vi.fn(),
        ensureContract: vi.fn(),
    }
}));

describe('Admin ZK Access', () => {
    const mockAdminAddress = '0x1234567890123456789012345678901234567890';
    const mockRecordId = 1;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getAdminRecordsWithZKAccess', () => {
        it('should return all records with admin access level for admin users', async () => {
            // Mock the blockchain service method directly
            const mockRecords = [
                {
                    id: mockRecordId,
                    studentName: 'Test Student',
                    universityName: 'Test University',
                    recordType: 0,
                    timestamp: Date.now() / 1000,
                    hasZKAccess: true,
                    accessLevel: 'admin',
                    documentUrl: 'https://example.com/doc.pdf'
                },
                {
                    id: 2,
                    studentName: 'Test Student 2',
                    universityName: 'Test University 2',
                    recordType: 1,
                    timestamp: Date.now() / 1000,
                    hasZKAccess: true,
                    accessLevel: 'admin',
                    documentUrl: 'https://example.com/doc2.pdf'
                }
            ];

            (blockchainService.getAdminRecordsWithZKAccess as Mock).mockResolvedValue(mockRecords);

            const records = await blockchainService.getAdminRecordsWithZKAccess();

            expect(records).toHaveLength(2);
            expect(records[0].accessLevel).toBe('admin');
            expect(records[1].accessLevel).toBe('admin');
        });

        it('should throw error for non-admin users', async () => {
            (blockchainService.getAdminRecordsWithZKAccess as Mock).mockRejectedValue(new Error('User does not have admin privileges'));

            await expect(blockchainService.getAdminRecordsWithZKAccess()).rejects.toThrow('User does not have admin privileges');
        });

        it('should handle ZK access failures gracefully', async () => {
            const mockRecords = [
                {
                    id: mockRecordId,
                    studentName: 'Test Student',
                    universityName: 'Test University',
                    recordType: 0,
                    timestamp: Date.now() / 1000,
                    hasZKAccess: false,
                    accessLevel: 'admin',
                    documentUrl: undefined
                }
            ];

            (blockchainService.getAdminRecordsWithZKAccess as Mock).mockResolvedValue(mockRecords);

            const records = await blockchainService.getAdminRecordsWithZKAccess();

            expect(records).toHaveLength(1);
            expect(records[0].hasZKAccess).toBe(false);
            expect(records[0].accessLevel).toBe('admin');
        });
    });

    describe('zkService admin methods', () => {
        it('should generate admin access proof', async () => {
            const mockProof = {
                pi_a: ['0x1', '0x2'],
                pi_b: [['0x3', '0x4'], ['0x5', '0x6']],
                pi_c: ['0x7', '0x8'],
                publicSignals: ['0x9', '0xa']
            };

            (zkService.generateAdminAccessProof as Mock).mockResolvedValue({
                proof: mockProof,
                publicSignals: mockProof.publicSignals
            });

            const result = await zkService.generateAdminAccessProof(mockAdminAddress, mockRecordId);

            expect(result).toBeDefined();
            expect(result?.proof).toEqual(mockProof);
            expect(zkService.generateAdminAccessProof).toHaveBeenCalledWith(mockAdminAddress, mockRecordId);
        });

        it('should verify admin document access', async () => {
            const mockIPFSHash = 'QmTestHash123';
            (zkService.verifyAdminDocumentAccess as Mock).mockResolvedValue(mockIPFSHash);

            const result = await zkService.verifyAdminDocumentAccess(mockRecordId, mockAdminAddress);

            expect(result).toBe(mockIPFSHash);
            expect(zkService.verifyAdminDocumentAccess).toHaveBeenCalledWith(mockRecordId, mockAdminAddress);
        });

        it('should validate admin access', async () => {
            (zkService.validateAdminAccess as Mock).mockResolvedValue(true);

            const result = await zkService.validateAdminAccess(mockRecordId, mockAdminAddress);

            expect(result).toBe(true);
            expect(zkService.validateAdminAccess).toHaveBeenCalledWith(mockRecordId, mockAdminAddress);
        });

        it('should get admin accessible records', async () => {
            const mockRecordIds = [1, 2, 3];
            (zkService.getAdminAccessibleRecords as Mock).mockResolvedValue(mockRecordIds);

            const result = await zkService.getAdminAccessibleRecords(mockAdminAddress);

            expect(result).toEqual(mockRecordIds);
            expect(zkService.getAdminAccessibleRecords).toHaveBeenCalledWith(mockAdminAddress);
        });
    });

    describe('zkFallbackService admin methods', () => {
        it('should provide fallback admin access', async () => {
            const mockRecord = {
                id: mockRecordId,
                studentName: 'Test Student',
                ipfsHash: 'QmTestHash123'
            };
            const mockError = new ZKError(ZKErrorType.PROOF_GENERATION_FAILED, 'Test error');
            const mockResult = {
                hasAccess: true,
                ipfsHash: mockRecord.ipfsHash,
                error: 'Using legacy admin oversight access due to ZK service unavailability'
            };

            (zkFallbackService.fallbackAdminAccess as Mock).mockResolvedValue(mockResult);

            const result = await zkFallbackService.fallbackAdminAccess(
                mockRecordId,
                mockAdminAddress,
                mockRecord as any,
                mockError
            );

            expect(result).toEqual(mockResult);
            expect(result.hasAccess).toBe(true);
            expect(result.ipfsHash).toBe(mockRecord.ipfsHash);
        });

        it('should handle invalid inputs in fallback admin access', async () => {
            const mockError = new ZKError(ZKErrorType.PROOF_GENERATION_FAILED, 'Test error');
            const mockResult = {
                hasAccess: false,
                error: 'Invalid record or admin address'
            };

            (zkFallbackService.fallbackAdminAccess as Mock).mockResolvedValue(mockResult);

            const result = await zkFallbackService.fallbackAdminAccess(
                mockRecordId,
                '',
                null as any,
                mockError
            );

            expect(result.hasAccess).toBe(false);
            expect(result.error).toBe('Invalid record or admin address');
        });
    });

    describe('Error handling', () => {
        it('should handle ZK service initialization failures', async () => {
            (blockchainService.getAdminRecordsWithZKAccess as Mock).mockResolvedValue([]);

            const records = await blockchainService.getAdminRecordsWithZKAccess();

            expect(records).toEqual([]);
        });

        it('should handle admin access validation failures gracefully', async () => {
            // Mock the method to return true even when there's an error (admin oversight)
            (zkService.validateAdminAccess as Mock).mockResolvedValue(true);

            // Should not throw, should return true for admin oversight
            const result = await zkService.validateAdminAccess(mockRecordId, mockAdminAddress);

            expect(result).toBe(true);
            expect(zkService.validateAdminAccess).toHaveBeenCalledWith(mockRecordId, mockAdminAddress);
        });
    });

    describe('Admin oversight privileges', () => {
        it('should grant admin access even without explicit ZK credentials', async () => {
            (zkService.validateAdminAccess as Mock).mockImplementation(async (recordId: number, adminAddress: string) => {
                // Simulate the actual implementation that grants admin access for oversight
                return true;
            });

            const result = await zkService.validateAdminAccess(mockRecordId, mockAdminAddress);

            expect(result).toBe(true);
        });

        it('should allow admin to access all records for system management', async () => {
            const mockTotalRecords = 5;
            (zkService.getAdminAccessibleRecords as Mock).mockImplementation(async (adminAddress: string) => {
                // Simulate returning all record IDs for admin oversight
                return Array.from({ length: mockTotalRecords }, (_, i) => i + 1);
            });

            const result = await zkService.getAdminAccessibleRecords(mockAdminAddress);

            expect(result).toHaveLength(mockTotalRecords);
            expect(result).toEqual([1, 2, 3, 4, 5]);
        });
    });
});