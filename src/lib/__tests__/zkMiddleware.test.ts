/**
 * Unit tests for ZK middleware functions
 * Tests ZK proof validation, rate limiting, and error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { NextRequest } from 'next/server';
import { ethers } from 'ethers';
import {
    validateZKProofStructure,
    validateZKProof,
    withZKValidation,
    checkRateLimit,
    validateZKRequestHeaders,
    createZKErrorResponse,
    initializeZKContract
} from '../zkMiddleware';
import { ZKErrorType, FormattedZKProof } from '../../types/zkTypes';

// Mock ethers
vi.mock('ethers', () => ({
    ethers: {
        JsonRpcProvider: vi.fn(),
        Contract: vi.fn(),
        isAddress: vi.fn()
    }
}));

describe('ZK Middleware', () => {
    let mockZKContract: any;
    let mockProvider: any;

    const validUserAddress = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
    const validRecordId = 1;
    const validProof: FormattedZKProof = {
        pA: ['0x123', '0x456'],
        pB: [['0x789', '0xabc'], ['0xdef', '0x012']],
        pC: ['0x345', '0x678'],
        publicSignals: ['1', validUserAddress, '0x999']
    };

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock environment variables
        process.env.RPC_URL = 'http://localhost:8545';
        process.env.ZK_CONTRACT_ADDRESS = '0x1234567890123456789012345678901234567890';

        // Mock ethers components
        mockProvider = {
            getNetwork: vi.fn().mockResolvedValue({ chainId: 1 })
        };

        mockZKContract = {
            verifyAccess: vi.fn(),
            hasAccess: vi.fn(),
            getEncryptedRecord: vi.fn()
        };

        (ethers.JsonRpcProvider as Mock).mockReturnValue(mockProvider);
        (ethers.Contract as Mock).mockReturnValue(mockZKContract);
        (ethers.isAddress as Mock).mockImplementation((addr: string) => {
            return addr.startsWith('0x') && addr.length === 42;
        });
    });

    afterEach(() => {
        delete process.env.RPC_URL;
        delete process.env.ZK_CONTRACT_ADDRESS;
    });

    describe('validateZKProofStructure', () => {
        it('should validate correct ZK proof structure', () => {
            const result = validateZKProofStructure(validProof);
            expect(result).toBe(true);
        });

        it('should reject proof with missing pA', () => {
            const invalidProof = { ...validProof };
            delete (invalidProof as any).pA;

            const result = validateZKProofStructure(invalidProof);
            expect(result).toBe(false);
        });

        it('should reject proof with incorrect pA length', () => {
            const invalidProof = {
                ...validProof,
                pA: ['0x123'] // Missing second element
            };

            const result = validateZKProofStructure(invalidProof);
            expect(result).toBe(false);
        });

        it('should reject proof with incorrect pB structure', () => {
            const invalidProof = {
                ...validProof,
                pB: [['0x789'], ['0xdef', '0x012']] // First array missing element
            };

            const result = validateZKProofStructure(invalidProof);
            expect(result).toBe(false);
        });

        it('should reject proof with incorrect publicSignals length', () => {
            const invalidProof = {
                ...validProof,
                publicSignals: ['1', validUserAddress] // Missing third element
            };

            const result = validateZKProofStructure(invalidProof);
            expect(result).toBe(false);
        });

        it('should reject proof with non-string elements', () => {
            const invalidProof = {
                ...validProof,
                pA: [123, '0x456'] // First element is number, not string
            };

            const result = validateZKProofStructure(invalidProof);
            expect(result).toBe(false);
        });

        it('should reject null or undefined proof', () => {
            expect(validateZKProofStructure(null as any)).toBe(false);
            expect(validateZKProofStructure(undefined as any)).toBe(false);
        });
    });

    describe('initializeZKContract', () => {
        it('should initialize ZK contract successfully', async () => {
            const contract = await initializeZKContract();

            expect(ethers.JsonRpcProvider).toHaveBeenCalledWith('http://localhost:8545');
            expect(ethers.Contract).toHaveBeenCalledWith(
                '0x1234567890123456789012345678901234567890',
                expect.any(Array),
                mockProvider
            );
            expect(contract).toBe(mockZKContract);
        });

        it('should throw error when RPC_URL is not configured', async () => {
            delete process.env.RPC_URL;

            await expect(initializeZKContract()).rejects.toThrow('RPC_URL not configured');
        });

        it('should throw error when ZK_CONTRACT_ADDRESS is not configured', async () => {
            delete process.env.ZK_CONTRACT_ADDRESS;

            await expect(initializeZKContract()).rejects.toThrow('ZK_CONTRACT_ADDRESS not configured');
        });
    });

    describe('validateZKProof', () => {
        it('should validate proof successfully', async () => {
            mockZKContract.hasAccess.mockResolvedValue(true);
            mockZKContract.verifyAccess.mockResolvedValue(true);

            const result = await validateZKProof(validRecordId, validUserAddress, validProof);

            expect(result.isValid).toBe(true);
            expect(result.userAddress).toBe(validUserAddress);
            expect(result.recordId).toBe(validRecordId);
            expect(result.proof).toEqual(validProof);
        });

        it('should reject invalid user address', async () => {
            const result = await validateZKProof(validRecordId, 'invalid-address', validProof);

            expect(result.isValid).toBe(false);
            expect(result.error).toContain('Invalid user address format');
            expect(result.errorType).toBe(ZKErrorType.PROOF_VERIFICATION_FAILED);
        });

        it('should reject user without access', async () => {
            mockZKContract.hasAccess.mockResolvedValue(false);

            const result = await validateZKProof(validRecordId, validUserAddress, validProof);

            expect(result.isValid).toBe(false);
            expect(result.error).toContain('does not have access');
            expect(result.errorType).toBe(ZKErrorType.ACCESS_DENIED);
        });

        it('should reject invalid proof verification', async () => {
            mockZKContract.hasAccess.mockResolvedValue(true);
            mockZKContract.verifyAccess.mockResolvedValue(false);

            const result = await validateZKProof(validRecordId, validUserAddress, validProof);

            expect(result.isValid).toBe(false);
            expect(result.error).toContain('verification failed');
            expect(result.errorType).toBe(ZKErrorType.PROOF_VERIFICATION_FAILED);
        });

        it('should handle contract errors gracefully', async () => {
            mockZKContract.hasAccess.mockRejectedValue(new Error('Contract error'));

            const result = await validateZKProof(validRecordId, validUserAddress, validProof);

            expect(result.isValid).toBe(false);
            expect(result.error).toContain('Internal validation error');
        });

        it('should reject proof with mismatched record ID', async () => {
            const mismatchedProof = {
                ...validProof,
                publicSignals: ['2', validUserAddress, '0x999'] // Wrong record ID
            };

            mockZKContract.hasAccess.mockResolvedValue(true);

            const result = await validateZKProof(validRecordId, validUserAddress, mismatchedProof);

            expect(result.isValid).toBe(false);
            expect(result.error).toContain('does not match requested record ID');
        });
    });

    describe('withZKValidation', () => {
        it('should validate request successfully', async () => {
            mockZKContract.hasAccess.mockResolvedValue(true);
            mockZKContract.verifyAccess.mockResolvedValue(true);

            const requestBody = {
                proof: validProof,
                userAddress: validUserAddress
            };

            const request = new NextRequest('http://localhost/test', {
                method: 'POST',
                body: JSON.stringify(requestBody),
                headers: { 'Content-Type': 'application/json' }
            });

            const result = await withZKValidation(request, validRecordId);

            expect(result.success).toBe(true);
            expect(result.validation.isValid).toBe(true);
        });

        it('should return error response for missing fields', async () => {
            const requestBody = {
                userAddress: validUserAddress
                // Missing proof
            };

            const request = new NextRequest('http://localhost/test', {
                method: 'POST',
                body: JSON.stringify(requestBody),
                headers: { 'Content-Type': 'application/json' }
            });

            const result = await withZKValidation(request, validRecordId);

            expect(result.success).toBe(false);
            expect(result.response.status).toBe(400);
        });

        it('should return error response for invalid proof', async () => {
            mockZKContract.hasAccess.mockResolvedValue(false);

            const requestBody = {
                proof: validProof,
                userAddress: validUserAddress
            };

            const request = new NextRequest('http://localhost/test', {
                method: 'POST',
                body: JSON.stringify(requestBody),
                headers: { 'Content-Type': 'application/json' }
            });

            const result = await withZKValidation(request, validRecordId);

            expect(result.success).toBe(false);
            expect(result.response.status).toBe(403);
        });
    });

    describe('validateZKRequestHeaders', () => {
        it('should validate correct headers', () => {
            const request = new NextRequest('http://localhost/test', {
                headers: { 'Content-Type': 'application/json' }
            });

            const result = validateZKRequestHeaders(request);

            expect(result.isValid).toBe(true);
        });

        it('should reject incorrect content type', () => {
            const request = new NextRequest('http://localhost/test', {
                headers: { 'Content-Type': 'text/plain' }
            });

            const result = validateZKRequestHeaders(request);

            expect(result.isValid).toBe(false);
            expect(result.error).toContain('Content-Type must be application/json');
        });

        it('should reject missing content type', () => {
            const request = new NextRequest('http://localhost/test');

            const result = validateZKRequestHeaders(request);

            expect(result.isValid).toBe(false);
            expect(result.error).toContain('Content-Type must be application/json');
        });
    });

    describe('checkRateLimit', () => {
        it('should allow first request', () => {
            const request = new NextRequest('http://localhost/test');

            const result = checkRateLimit(request);

            expect(result.allowed).toBe(true);
        });

        it('should track multiple requests from same IP', () => {
            const request = new NextRequest('http://localhost/test', {
                headers: { 'x-forwarded-for': '192.168.1.1' }
            });

            // Make multiple requests
            for (let i = 0; i < 5; i++) {
                const result = checkRateLimit(request);
                expect(result.allowed).toBe(true);
            }
        });

        it('should enforce rate limit after max requests', () => {
            const request = new NextRequest('http://localhost/test', {
                headers: { 'x-forwarded-for': '192.168.1.2' }
            });

            // Make requests up to the limit
            for (let i = 0; i < 10; i++) {
                checkRateLimit(request);
            }

            // Next request should be rate limited
            const result = checkRateLimit(request);
            expect(result.allowed).toBe(false);
            expect(result.error).toContain('Rate limit exceeded');
        });
    });

    describe('createZKErrorResponse', () => {
        it('should create error response with correct structure', () => {
            const response = createZKErrorResponse(
                'Test error',
                ZKErrorType.ACCESS_DENIED,
                403
            );

            expect(response.status).toBe(403);
        });

        it('should use default status code', () => {
            const response = createZKErrorResponse(
                'Test error',
                ZKErrorType.PROOF_VERIFICATION_FAILED
            );

            expect(response.status).toBe(403);
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty proof object', async () => {
            const result = await validateZKProof(validRecordId, validUserAddress, {} as FormattedZKProof);

            expect(result.isValid).toBe(false);
            expect(result.error).toContain('Invalid ZK proof structure');
        });

        it('should handle very large record IDs', async () => {
            const largeRecordId = Number.MAX_SAFE_INTEGER;
            mockZKContract.hasAccess.mockResolvedValue(true);
            mockZKContract.verifyAccess.mockResolvedValue(true);

            const largeRecordProof = {
                ...validProof,
                publicSignals: [largeRecordId.toString(), validUserAddress, '0x999']
            };

            const result = await validateZKProof(largeRecordId, validUserAddress, largeRecordProof);

            expect(result.isValid).toBe(true);
        });

        it('should handle contract timeout errors', async () => {
            mockZKContract.hasAccess.mockImplementation(() => {
                return new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Timeout')), 100);
                });
            });

            const result = await validateZKProof(validRecordId, validUserAddress, validProof);

            expect(result.isValid).toBe(false);
        });
    });

    describe('Security Tests', () => {
        it('should reject proof with malicious public signals', async () => {
            const maliciousProof = {
                ...validProof,
                publicSignals: ['<script>alert("xss")</script>', validUserAddress, '0x999']
            };

            const result = await validateZKProof(validRecordId, validUserAddress, maliciousProof);

            expect(result.isValid).toBe(false);
        });

        it('should sanitize error messages', async () => {
            mockZKContract.hasAccess.mockRejectedValue(new Error('<script>alert("xss")</script>'));

            const result = await validateZKProof(validRecordId, validUserAddress, validProof);

            expect(result.isValid).toBe(false);
            expect(result.error).not.toContain('<script>');
        });

        it('should validate proof elements are properly formatted', () => {
            const invalidProof = {
                pA: ['0xinvalid', '0x456'],
                pB: [['0x789', '0xabc'], ['0xdef', '0x012']],
                pC: ['0x345', '0x678'],
                publicSignals: ['1', validUserAddress, '0x999']
            };

            const result = validateZKProofStructure(invalidProof);
            // This should still pass structure validation but fail in actual verification
            expect(result).toBe(true);
        });
    });
});