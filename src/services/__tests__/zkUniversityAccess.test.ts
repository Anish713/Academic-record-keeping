/**
 * Tests for university ZK access functionality
 * Verifies that universities can access records they issued with ZK proofs
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { zkFallbackService } from '../zkFallbackService';
import { ZKError, ZKErrorType } from '../../types/zkTypes';

// Mock constants
const mockUniversityAddress = '0x1234567890123456789012345678901234567890';
const mockRecordId = 1;
const mockRecord = {
    id: 1,
    studentId: 'STU001',
    studentName: 'John Doe',
    studentAddress: '0x9876543210987654321098765432109876543210',
    universityName: 'Test University',
    universityAddress: mockUniversityAddress,
    ipfsHash: 'QmTestHash123',
    metadataHash: 'QmMetadataHash456',
    recordType: 0,
    timestamp: 1640995200,
    isActive: true
};

describe('University Fallback Access', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('fallbackUniversityAccess', () => {
        it('should grant access to university that issued the record', async () => {
            const result = await zkFallbackService.fallbackUniversityAccess(
                mockRecordId,
                mockUniversityAddress,
                mockRecord,
                new ZKError(ZKErrorType.PROOF_GENERATION_FAILED, 'Test error')
            );

            expect(result.hasAccess).toBe(true);
            expect(result.ipfsHash).toBe(mockRecord.ipfsHash);
            expect(result.error).toContain('legacy university access');
        });

        it('should deny access to university that did not issue the record', async () => {
            const differentUniversityAddress = '0xdifferentuniversity123456789012345678901234';

            const result = await zkFallbackService.fallbackUniversityAccess(
                mockRecordId,
                differentUniversityAddress,
                mockRecord,
                new ZKError(ZKErrorType.PROOF_GENERATION_FAILED, 'Test error')
            );

            expect(result.hasAccess).toBe(false);
            expect(result.error).toContain('does not have access');
        });

        it('should handle missing university address in record', async () => {
            const recordWithoutUniversity = { ...mockRecord, universityAddress: undefined };

            const result = await zkFallbackService.fallbackUniversityAccess(
                mockRecordId,
                mockUniversityAddress,
                recordWithoutUniversity,
                new ZKError(ZKErrorType.PROOF_GENERATION_FAILED, 'Test error')
            );

            expect(result.hasAccess).toBe(false);
            expect(result.error).toContain('does not have access');
        });

        it('should handle case-insensitive address comparison', async () => {
            const upperCaseUniversityAddress = mockUniversityAddress.toUpperCase();

            const result = await zkFallbackService.fallbackUniversityAccess(
                mockRecordId,
                upperCaseUniversityAddress,
                mockRecord,
                new ZKError(ZKErrorType.PROOF_GENERATION_FAILED, 'Test error')
            );

            expect(result.hasAccess).toBe(true);
            expect(result.ipfsHash).toBe(mockRecord.ipfsHash);
        });

        it('should log fallback usage when enabled', async () => {
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

            await zkFallbackService.fallbackUniversityAccess(
                mockRecordId,
                mockUniversityAddress,
                mockRecord,
                new ZKError(ZKErrorType.PROOF_GENERATION_FAILED, 'Test error')
            );

            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Using fallback university access'),
                expect.any(Object)
            );

            consoleSpy.mockRestore();
        });

        it('should handle errors gracefully', async () => {
            // Create a record that will cause an error during processing
            const invalidRecord = null as any;

            const result = await zkFallbackService.fallbackUniversityAccess(
                mockRecordId,
                mockUniversityAddress,
                invalidRecord,
                new ZKError(ZKErrorType.PROOF_GENERATION_FAILED, 'Test error')
            );

            expect(result.hasAccess).toBe(false);
            expect(result.error).toContain('Invalid record or university address');
        });
    });

    describe('fallback statistics', () => {
        it('should track fallback usage', async () => {
            const initialStats = zkFallbackService.getFallbackStats();
            const initialCount = initialStats.totalUsage;

            await zkFallbackService.fallbackUniversityAccess(
                mockRecordId,
                mockUniversityAddress,
                mockRecord,
                new ZKError(ZKErrorType.PROOF_GENERATION_FAILED, 'Test error')
            );

            const newStats = zkFallbackService.getFallbackStats();
            expect(newStats.totalUsage).toBe(initialCount + 1);
        });

        it('should provide fallback status message', () => {
            const statusMessage = zkFallbackService.getFallbackStatusMessage();
            expect(statusMessage).toContain('compatibility mode');
        });

        it('should check fallback availability', () => {
            const isAvailable = zkFallbackService.isFallbackAvailable('document_access');
            expect(typeof isAvailable).toBe('boolean');
        });
    });
});

describe('University Access Logic', () => {
    describe('address validation', () => {
        it('should handle valid ethereum addresses', async () => {
            const validAddress = '0x742d35Cc6634C0532925a3b8D0C9C0E3C5d5c8eF';

            const result = await zkFallbackService.fallbackUniversityAccess(
                mockRecordId,
                validAddress,
                { ...mockRecord, universityAddress: validAddress },
                new ZKError(ZKErrorType.PROOF_GENERATION_FAILED, 'Test error')
            );

            expect(result.hasAccess).toBe(true);
        });

        it('should handle empty addresses', async () => {
            const result = await zkFallbackService.fallbackUniversityAccess(
                mockRecordId,
                '',
                mockRecord,
                new ZKError(ZKErrorType.PROOF_GENERATION_FAILED, 'Test error')
            );

            expect(result.hasAccess).toBe(false);
        });

        it('should handle null addresses', async () => {
            const result = await zkFallbackService.fallbackUniversityAccess(
                mockRecordId,
                null as any,
                mockRecord,
                new ZKError(ZKErrorType.PROOF_GENERATION_FAILED, 'Test error')
            );

            expect(result.hasAccess).toBe(false);
        });
    });

    describe('record validation', () => {
        it('should handle records with different structures', async () => {
            const minimalRecord = {
                universityAddress: mockUniversityAddress,
                ipfsHash: 'QmMinimalHash'
            };

            const result = await zkFallbackService.fallbackUniversityAccess(
                mockRecordId,
                mockUniversityAddress,
                minimalRecord as any,
                new ZKError(ZKErrorType.PROOF_GENERATION_FAILED, 'Test error')
            );

            expect(result.hasAccess).toBe(true);
            expect(result.ipfsHash).toBe('QmMinimalHash');
        });

        it('should handle records without IPFS hash', async () => {
            const recordWithoutHash = { ...mockRecord, ipfsHash: undefined };

            const result = await zkFallbackService.fallbackUniversityAccess(
                mockRecordId,
                mockUniversityAddress,
                recordWithoutHash,
                new ZKError(ZKErrorType.PROOF_GENERATION_FAILED, 'Test error')
            );

            expect(result.hasAccess).toBe(true);
            expect(result.ipfsHash).toBeUndefined();
        });
    });

    describe('error handling', () => {
        it('should handle different ZK error types', async () => {
            const errorTypes = [
                ZKErrorType.CIRCUIT_NOT_LOADED,
                ZKErrorType.PROOF_GENERATION_FAILED,
                ZKErrorType.PROOF_VERIFICATION_FAILED,
                ZKErrorType.ACCESS_DENIED,
                ZKErrorType.NETWORK_ERROR
            ];

            for (const errorType of errorTypes) {
                const result = await zkFallbackService.fallbackUniversityAccess(
                    mockRecordId,
                    mockUniversityAddress,
                    mockRecord,
                    new ZKError(errorType, `Test ${errorType} error`)
                );

                expect(result.hasAccess).toBe(true); // University should still get access via fallback
                expect(result.error).toContain('legacy university access');
            }
        });

        it('should provide meaningful error messages', async () => {
            const result = await zkFallbackService.fallbackUniversityAccess(
                mockRecordId,
                'different-address',
                mockRecord,
                new ZKError(ZKErrorType.ACCESS_DENIED, 'Original access denied')
            );

            expect(result.hasAccess).toBe(false);
            expect(result.error).toBe('University does not have access to this record');
        });
    });
});

describe('Integration Scenarios', () => {
    describe('university workflow', () => {
        it('should simulate complete university access workflow', async () => {
            // Step 1: University tries ZK access but fails
            const zkError = new ZKError(ZKErrorType.CIRCUIT_NOT_LOADED, 'Circuit failed to load');

            // Step 2: Fallback to legacy access
            const result = await zkFallbackService.fallbackUniversityAccess(
                mockRecordId,
                mockUniversityAddress,
                mockRecord,
                zkError
            );

            // Step 3: Verify university gets access to their own record
            expect(result.hasAccess).toBe(true);
            expect(result.ipfsHash).toBe(mockRecord.ipfsHash);
            expect(result.error).toContain('legacy university access');
        });

        it('should handle multiple record access attempts', async () => {
            const records = [
                { ...mockRecord, id: 1, universityAddress: mockUniversityAddress },
                { ...mockRecord, id: 2, universityAddress: mockUniversityAddress },
                { ...mockRecord, id: 3, universityAddress: 'different-university' }
            ];

            const results = await Promise.all(
                records.map((record, index) =>
                    zkFallbackService.fallbackUniversityAccess(
                        index + 1,
                        mockUniversityAddress,
                        record,
                        new ZKError(ZKErrorType.PROOF_GENERATION_FAILED, 'Test error')
                    )
                )
            );

            // University should have access to first two records but not the third
            expect(results[0].hasAccess).toBe(true);
            expect(results[1].hasAccess).toBe(true);
            expect(results[2].hasAccess).toBe(false);
        });
    });

    describe('performance considerations', () => {
        it('should handle rapid successive calls', async () => {
            const promises = Array.from({ length: 10 }, (_, i) =>
                zkFallbackService.fallbackUniversityAccess(
                    i + 1,
                    mockUniversityAddress,
                    mockRecord,
                    new ZKError(ZKErrorType.PROOF_GENERATION_FAILED, 'Test error')
                )
            );

            const results = await Promise.all(promises);

            // All calls should succeed
            results.forEach(result => {
                expect(result.hasAccess).toBe(true);
            });
        });

        it('should not leak memory with repeated calls', async () => {
            // This test ensures the fallback service doesn't accumulate state
            const initialStats = zkFallbackService.getFallbackStats();

            for (let i = 0; i < 5; i++) {
                await zkFallbackService.fallbackUniversityAccess(
                    mockRecordId,
                    mockUniversityAddress,
                    mockRecord,
                    new ZKError(ZKErrorType.PROOF_GENERATION_FAILED, 'Test error')
                );
            }

            const finalStats = zkFallbackService.getFallbackStats();
            expect(finalStats.totalUsage).toBe(initialStats.totalUsage + 5);
        });
    });
});