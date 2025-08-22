/**
 * Unit tests for ZK fallback service
 * Tests graceful degradation and fallback mechanisms
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ZKFallbackService, DEFAULT_FALLBACK_OPTIONS } from '../zkFallbackService';
import { ZKError, ZKErrorType } from '../../types/zkTypes';
import { Record, RecordType } from '../../types/records';

// Mock console methods
const mockConsole = {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn()
};

vi.stubGlobal('console', mockConsole);

describe('ZKFallbackService', () => {
    let fallbackService: ZKFallbackService;
    let mockRecord: Record;

    beforeEach(() => {
        fallbackService = ZKFallbackService.getInstance({
            enableLegacyAccess: true,
            showLimitedInfo: true,
            allowOwnerAccess: true,
            logFallbackUsage: true
        });
        fallbackService.resetStats();
        vi.clearAllMocks();

        mockRecord = {
            id: 1,
            studentId: 'STU001',
            studentName: 'John Doe',
            studentAddress: '0x1234567890123456789012345678901234567890',
            universityName: 'Test University',
            universityAddress: '0x0987654321098765432109876543210987654321',
            ipfsHash: 'QmTestHash123',
            metadataHash: 'QmMetadataHash456',
            recordType: RecordType.DEGREE,
            timestamp: Date.now(),
            issueDate: '2023-01-01',
            verified: true,
            issuer: 'Test University'
        };
    });

    describe('Document Access Fallback', () => {
        it('should allow owner access when ZK fails', async () => {
            const userAddress = mockRecord.studentAddress;
            const zkError = new ZKError(ZKErrorType.PROOF_GENERATION_FAILED, 'Proof failed');

            const result = await fallbackService.fallbackDocumentAccess(
                mockRecord.id,
                userAddress,
                mockRecord,
                zkError
            );

            expect(result.hasAccess).toBe(true);
            expect(result.ipfsHash).toBe(mockRecord.ipfsHash);
            expect(mockConsole.warn).toHaveBeenCalledWith(
                expect.stringContaining('Using fallback document access'),
                expect.any(Object)
            );
        });

        it('should allow university access when ZK fails', async () => {
            const userAddress = mockRecord.universityAddress!;
            const zkError = new ZKError(ZKErrorType.CIRCUIT_NOT_LOADED, 'Circuit not loaded');

            const result = await fallbackService.fallbackDocumentAccess(
                mockRecord.id,
                userAddress,
                mockRecord,
                zkError
            );

            expect(result.hasAccess).toBe(true);
            expect(result.ipfsHash).toBe(mockRecord.ipfsHash);
        });

        it('should deny access for non-owners when legacy access disabled', async () => {
            fallbackService.updateOptions({ enableLegacyAccess: false });

            const userAddress = '0xDifferentAddress123456789012345678901234567890';
            const zkError = new ZKError(ZKErrorType.ACCESS_DENIED, 'Access denied');

            const result = await fallbackService.fallbackDocumentAccess(
                mockRecord.id,
                userAddress,
                mockRecord,
                zkError
            );

            expect(result.hasAccess).toBe(false);
            expect(result.error).toContain('Document access unavailable');
        });

        it('should provide user-friendly error message when showing limited info', async () => {
            const userAddress = '0xDifferentAddress123456789012345678901234567890';
            const zkError = new ZKError(ZKErrorType.PROOF_VERIFICATION_FAILED, 'Proof invalid');

            const result = await fallbackService.fallbackDocumentAccess(
                mockRecord.id,
                userAddress,
                mockRecord,
                zkError
            );

            expect(result.hasAccess).toBe(false);
            expect(result.error).toBeTruthy();
            expect(result.error).not.toContain('Proof invalid'); // Should be user-friendly
        });

        it('should handle fallback errors gracefully', async () => {
            // Mock a fallback error by making isRecordOwner throw
            const originalIsRecordOwner = fallbackService['isRecordOwner'];
            fallbackService['isRecordOwner'] = vi.fn().mockImplementation(() => {
                throw new Error('Fallback error');
            });

            const userAddress = mockRecord.studentAddress;
            const zkError = new ZKError(ZKErrorType.NETWORK_ERROR, 'Network error');

            const result = await fallbackService.fallbackDocumentAccess(
                mockRecord.id,
                userAddress,
                mockRecord,
                zkError
            );

            expect(result.hasAccess).toBe(false);
            expect(result.error).toBe('Unable to verify document access');
            expect(mockConsole.error).toHaveBeenCalledWith(
                'Fallback document access failed:',
                expect.any(Error)
            );

            // Restore original method
            fallbackService['isRecordOwner'] = originalIsRecordOwner;
        });
    });

    describe('Record Listing Fallback', () => {
        it('should return owner records with document URLs when legacy access enabled', async () => {
            const userAddress = mockRecord.studentAddress;
            const zkError = new ZKError(ZKErrorType.CIRCUIT_NOT_LOADED, 'Circuit not loaded');
            const allRecords = [mockRecord];

            const result = await fallbackService.fallbackRecordListing(
                userAddress,
                zkError,
                allRecords
            );

            expect(result).toHaveLength(1);
            expect(result[0].hasZKAccess).toBe(false);
            expect(result[0].accessLevel).toBe('owner');
            expect(result[0].documentUrl).toBeTruthy();
        });

        it('should filter out records with no access', async () => {
            const userAddress = '0xDifferentAddress123456789012345678901234567890';
            const zkError = new ZKError(ZKErrorType.ACCESS_DENIED, 'Access denied');
            const allRecords = [mockRecord];

            const result = await fallbackService.fallbackRecordListing(
                userAddress,
                zkError,
                allRecords
            );

            expect(result).toHaveLength(0);
        });

        it('should handle university records correctly', async () => {
            const userAddress = mockRecord.universityAddress!;
            const zkError = new ZKError(ZKErrorType.PROOF_GENERATION_FAILED, 'Proof failed');
            const allRecords = [mockRecord];

            const result = await fallbackService.fallbackRecordListing(
                userAddress,
                zkError,
                allRecords
            );

            expect(result).toHaveLength(1);
            expect(result[0].accessLevel).toBe('university');
            expect(result[0].documentUrl).toBeTruthy();
        });

        it('should return empty array on fallback error', async () => {
            // Mock determineFallbackAccessLevel to throw
            const originalDetermineAccess = fallbackService['determineFallbackAccessLevel'];
            fallbackService['determineFallbackAccessLevel'] = vi.fn().mockImplementation(() => {
                throw new Error('Fallback error');
            });

            const userAddress = mockRecord.studentAddress;
            const zkError = new ZKError(ZKErrorType.NETWORK_ERROR, 'Network error');
            const allRecords = [mockRecord];

            const result = await fallbackService.fallbackRecordListing(
                userAddress,
                zkError,
                allRecords
            );

            expect(result).toEqual([]);
            expect(mockConsole.error).toHaveBeenCalledWith(
                'Fallback record listing failed:',
                expect.any(Error)
            );

            // Restore original method
            fallbackService['determineFallbackAccessLevel'] = originalDetermineAccess;
        });
    });

    describe('Record Sharing Fallback', () => {
        it('should return failure for secure sharing', async () => {
            const zkError = new ZKError(ZKErrorType.PROOF_GENERATION_FAILED, 'Proof failed');

            const result = await fallbackService.fallbackRecordSharing(
                mockRecord.id,
                mockRecord.studentAddress,
                '0xTargetAddress123456789012345678901234567890',
                zkError
            );

            expect(result.success).toBe(false);
            expect(result.error).toContain('Secure sharing is temporarily unavailable');
            expect(mockConsole.warn).toHaveBeenCalledWith(
                expect.stringContaining('Using fallback record sharing'),
                expect.any(Object)
            );
        });
    });

    describe('Proof Generation Fallback', () => {
        it('should return mock proof in development mode', async () => {
            const originalNodeEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'development';

            const zkError = new ZKError(ZKErrorType.CIRCUIT_NOT_LOADED, 'Circuit not loaded');

            const result = await fallbackService.fallbackProofGeneration(
                mockRecord.id,
                mockRecord.studentAddress,
                zkError
            );

            expect(result.success).toBe(true);
            expect(result.mockProof).toBeTruthy();
            expect(result.mockProof.pi_a).toEqual(['0', '0']);
            expect(result.error).toContain('Using mock proof in development mode');

            process.env.NODE_ENV = originalNodeEnv;
        });

        it('should return failure in production mode', async () => {
            const originalNodeEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'production';

            const zkError = new ZKError(ZKErrorType.CIRCUIT_NOT_LOADED, 'Circuit not loaded');

            const result = await fallbackService.fallbackProofGeneration(
                mockRecord.id,
                mockRecord.studentAddress,
                zkError
            );

            expect(result.success).toBe(false);
            expect(result.error).toBe('Proof generation is temporarily unavailable');

            process.env.NODE_ENV = originalNodeEnv;
        });
    });

    describe('Fallback Availability', () => {
        it('should correctly report fallback availability for different operations', () => {
            expect(fallbackService.isFallbackAvailable('document_access')).toBe(true);
            expect(fallbackService.isFallbackAvailable('record_listing')).toBe(true);
            expect(fallbackService.isFallbackAvailable('record_sharing')).toBe(false);
        });

        it('should report proof generation availability in development', () => {
            const originalNodeEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'development';

            expect(fallbackService.isFallbackAvailable('proof_generation')).toBe(true);

            process.env.NODE_ENV = 'production';
            expect(fallbackService.isFallbackAvailable('proof_generation')).toBe(false);

            process.env.NODE_ENV = originalNodeEnv;
        });

        it('should report unavailable when legacy access disabled', () => {
            fallbackService.updateOptions({
                enableLegacyAccess: false,
                showLimitedInfo: false
            });

            expect(fallbackService.isFallbackAvailable('document_access')).toBe(false);
            expect(fallbackService.isFallbackAvailable('record_listing')).toBe(false);
        });
    });

    describe('Statistics and Configuration', () => {
        it('should track fallback usage statistics', async () => {
            const zkError = new ZKError(ZKErrorType.NETWORK_ERROR, 'Network error');

            await fallbackService.fallbackDocumentAccess(
                mockRecord.id,
                mockRecord.studentAddress,
                mockRecord,
                zkError
            );

            await fallbackService.fallbackRecordListing(
                mockRecord.studentAddress,
                zkError,
                [mockRecord]
            );

            const stats = fallbackService.getFallbackStats();
            expect(stats.totalUsage).toBe(2);
            expect(stats.isEnabled).toBe(true);
            expect(stats.options).toEqual(expect.objectContaining({
                enableLegacyAccess: true,
                showLimitedInfo: true,
                allowOwnerAccess: true,
                logFallbackUsage: true
            }));
        });

        it('should reset statistics', async () => {
            const zkError = new ZKError(ZKErrorType.NETWORK_ERROR, 'Network error');

            await fallbackService.fallbackDocumentAccess(
                mockRecord.id,
                mockRecord.studentAddress,
                mockRecord,
                zkError
            );

            expect(fallbackService.getFallbackStats().totalUsage).toBe(1);

            fallbackService.resetStats();
            expect(fallbackService.getFallbackStats().totalUsage).toBe(0);
        });

        it('should update options correctly', () => {
            const newOptions = {
                enableLegacyAccess: false,
                showLimitedInfo: false
            };

            fallbackService.updateOptions(newOptions);

            const stats = fallbackService.getFallbackStats();
            expect(stats.options.enableLegacyAccess).toBe(false);
            expect(stats.options.showLimitedInfo).toBe(false);
            expect(stats.options.allowOwnerAccess).toBe(true); // Should remain unchanged
        });

        it('should provide appropriate status messages', () => {
            let message = fallbackService.getFallbackStatusMessage();
            expect(message).toContain('compatibility mode');

            fallbackService.updateOptions({ enableLegacyAccess: false });
            message = fallbackService.getFallbackStatusMessage();
            expect(message).toContain('temporarily unavailable');
        });
    });

    describe('Access Level Determination', () => {
        it('should correctly identify record owners', () => {
            const accessLevel = fallbackService['determineFallbackAccessLevel'](
                mockRecord,
                mockRecord.studentAddress
            );
            expect(accessLevel).toBe('owner');
        });

        it('should correctly identify university access', () => {
            const accessLevel = fallbackService['determineFallbackAccessLevel'](
                mockRecord,
                mockRecord.universityAddress!
            );
            expect(accessLevel).toBe('university');
        });

        it('should return none for unauthorized users', () => {
            const accessLevel = fallbackService['determineFallbackAccessLevel'](
                mockRecord,
                '0xUnauthorizedAddress123456789012345678901234567890'
            );
            expect(accessLevel).toBe('none');
        });
    });

    describe('Legacy Document URL Generation', () => {
        it('should generate correct IPFS gateway URLs', () => {
            const ipfsHash = 'QmTestHash123';
            const url = fallbackService['getLegacyDocumentUrl'](ipfsHash);

            expect(url).toBe(`https://gateway.pinata.cloud/ipfs/${ipfsHash}`);
        });
    });

    describe('Logging Configuration', () => {
        it('should respect logging configuration', async () => {
            fallbackService.updateOptions({ logFallbackUsage: false });

            const zkError = new ZKError(ZKErrorType.NETWORK_ERROR, 'Network error');

            await fallbackService.fallbackDocumentAccess(
                mockRecord.id,
                mockRecord.studentAddress,
                mockRecord,
                zkError
            );

            // Should not log when logging is disabled
            expect(mockConsole.warn).not.toHaveBeenCalled();
        });

        it('should log when logging is enabled', async () => {
            fallbackService.updateOptions({ logFallbackUsage: true });

            const zkError = new ZKError(ZKErrorType.NETWORK_ERROR, 'Network error');

            await fallbackService.fallbackDocumentAccess(
                mockRecord.id,
                mockRecord.studentAddress,
                mockRecord,
                zkError
            );

            expect(mockConsole.warn).toHaveBeenCalledWith(
                expect.stringContaining('Using fallback document access'),
                expect.any(Object)
            );
        });
    });
});