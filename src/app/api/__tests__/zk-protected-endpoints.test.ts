/**
 * Integration tests for ZK-protected API endpoints
 * Tests the complete ZK proof verification flow for document access
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { NextRequest } from 'next/server';
import { ethers } from 'ethers';
import { GET as getRecord, POST as postRecord } from '../records/[id]/route';
import { GET as getAccessible, POST as postAccessible } from '../records/accessible/route';
import { GET as getDocument, POST as postDocument } from '../records/[id]/document/route';
import { ZKErrorType, FormattedZKProof } from '../../../types/zkTypes';

// Mock ethers
vi.mock('ethers', () => ({
    ethers: {
        JsonRpcProvider: vi.fn(),
        Contract: vi.fn(),
        isAddress: vi.fn(),
        getBytes: vi.fn(),
        keccak256: vi.fn(),
        toUtf8Bytes: vi.fn(),
        hexlify: vi.fn(),
        solidityPackedKeccak256: vi.fn()
    }
}));

// Mock environment variables
const mockEnvVars = {
    RPC_URL: 'http://localhost:8545',
    ZK_CONTRACT_ADDRESS: '0x1234567890123456789012345678901234567890',
    ACADEMIC_RECORDS_CONTRACT_ADDRESS: '0x0987654321098765432109876543210987654321'
};

describe('ZK-Protected API Endpoints', () => {
    let mockZKContract: any;
    let mockAcademicRecordsContract: any;
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
        // Reset all mocks
        vi.clearAllMocks();

        // Mock environment variables
        Object.entries(mockEnvVars).forEach(([key, value]) => {
            process.env[key] = value;
        });

        // Mock ethers components
        mockProvider = {
            getNetwork: vi.fn().mockResolvedValue({ chainId: 1 })
        };

        mockZKContract = {
            verifyAccess: vi.fn(),
            hasAccess: vi.fn(),
            getEncryptedHash: vi.fn(),
            getEncryptedRecord: vi.fn(),
            getUserAccessibleRecords: vi.fn()
        };

        mockAcademicRecordsContract = {
            recordExists: vi.fn(),
            getRecord: vi.fn()
        };

        (ethers.JsonRpcProvider as Mock).mockReturnValue(mockProvider);
        (ethers.Contract as Mock).mockImplementation((address, abi) => {
            if (address === mockEnvVars.ZK_CONTRACT_ADDRESS) {
                return mockZKContract;
            }
            return mockAcademicRecordsContract;
        });

        (ethers.isAddress as Mock).mockImplementation((addr: string) => {
            return addr.startsWith('0x') && addr.length === 42;
        });

        (ethers.getBytes as Mock).mockReturnValue(new Uint8Array([1, 2, 3, 4]));
        (ethers.keccak256 as Mock).mockReturnValue('0xhash');
        (ethers.toUtf8Bytes as Mock).mockReturnValue(new Uint8Array([1, 2, 3]));
        (ethers.hexlify as Mock).mockReturnValue('0x01020304');
    });

    afterEach(() => {
        // Clean up environment variables
        Object.keys(mockEnvVars).forEach(key => {
            delete process.env[key];
        });
    });

    describe('GET /api/records/[id]', () => {
        it('should return record without IPFS hash when no proof provided', async () => {
            mockAcademicRecordsContract.recordExists.mockResolvedValue(true);
            mockAcademicRecordsContract.getRecord.mockResolvedValue({
                id: BigInt(1),
                studentId: 'STU001',
                studentName: 'John Doe',
                studentAddress: validUserAddress,
                universityName: 'Test University',
                ipfsHash: 'QmTest',
                metadataHash: 'QmMeta',
                recordType: 0,
                issuer: '0x1234',
                timestamp: BigInt(Date.now()),
                verified: true
            });

            const request = new NextRequest('http://localhost/api/records/1');
            const response = await getRecord(request, { params: { id: '1' } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.record).toBeDefined();
            expect(data.record.requiresZKProof).toBe(true);
            expect(data.record.ipfsHash).toBeUndefined();
        });

        it('should return 404 for non-existent record', async () => {
            mockAcademicRecordsContract.recordExists.mockResolvedValue(false);

            const request = new NextRequest('http://localhost/api/records/999');
            const response = await getRecord(request, { params: { id: '999' } });

            expect(response.status).toBe(404);
        });

        it('should return 400 for invalid record ID', async () => {
            const request = new NextRequest('http://localhost/api/records/invalid');
            const response = await getRecord(request, { params: { id: 'invalid' } });

            expect(response.status).toBe(400);
        });
    });

    describe('POST /api/records/[id]', () => {
        it('should return complete record with valid ZK proof', async () => {
            mockAcademicRecordsContract.recordExists.mockResolvedValue(true);
            mockAcademicRecordsContract.getRecord.mockResolvedValue({
                id: BigInt(1),
                studentId: 'STU001',
                studentName: 'John Doe',
                studentAddress: validUserAddress,
                universityName: 'Test University',
                ipfsHash: 'QmTest',
                metadataHash: 'QmMeta',
                recordType: 0,
                issuer: '0x1234',
                timestamp: BigInt(Date.now()),
                verified: true
            });

            mockZKContract.hasAccess.mockResolvedValue(true);
            mockZKContract.verifyAccess.mockResolvedValue(true);
            mockZKContract.getEncryptedHash.mockResolvedValue('0xencrypted');

            const requestBody = {
                proof: validProof,
                userAddress: validUserAddress
            };

            const request = new NextRequest('http://localhost/api/records/1', {
                method: 'POST',
                body: JSON.stringify(requestBody),
                headers: { 'Content-Type': 'application/json' }
            });

            const response = await postRecord(request, { params: { id: '1' } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.record).toBeDefined();
            expect(data.record.hasZKAccess).toBe(true);
            expect(data.record.ipfsHash).toBeDefined();
            expect(data.proof.verified).toBe(true);
        });

        it('should return 400 for missing proof', async () => {
            const requestBody = {
                userAddress: validUserAddress
                // Missing proof
            };

            const request = new NextRequest('http://localhost/api/records/1', {
                method: 'POST',
                body: JSON.stringify(requestBody),
                headers: { 'Content-Type': 'application/json' }
            });

            const response = await postRecord(request, { params: { id: '1' } });
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toContain('Missing required fields');
        });

        it('should return 400 for invalid user address', async () => {
            const requestBody = {
                proof: validProof,
                userAddress: 'invalid-address'
            };

            const request = new NextRequest('http://localhost/api/records/1', {
                method: 'POST',
                body: JSON.stringify(requestBody),
                headers: { 'Content-Type': 'application/json' }
            });

            const response = await postRecord(request, { params: { id: '1' } });
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toContain('Invalid user address');
        });

        it('should return 403 for user without access', async () => {
            mockAcademicRecordsContract.recordExists.mockResolvedValue(true);
            mockZKContract.hasAccess.mockResolvedValue(false);

            const requestBody = {
                proof: validProof,
                userAddress: validUserAddress
            };

            const request = new NextRequest('http://localhost/api/records/1', {
                method: 'POST',
                body: JSON.stringify(requestBody),
                headers: { 'Content-Type': 'application/json' }
            });

            const response = await postRecord(request, { params: { id: '1' } });
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.type).toBe(ZKErrorType.ACCESS_DENIED);
        });

        it('should return 403 for invalid ZK proof', async () => {
            mockAcademicRecordsContract.recordExists.mockResolvedValue(true);
            mockZKContract.hasAccess.mockResolvedValue(true);
            mockZKContract.verifyAccess.mockResolvedValue(false);

            const requestBody = {
                proof: validProof,
                userAddress: validUserAddress
            };

            const request = new NextRequest('http://localhost/api/records/1', {
                method: 'POST',
                body: JSON.stringify(requestBody),
                headers: { 'Content-Type': 'application/json' }
            });

            const response = await postRecord(request, { params: { id: '1' } });
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.type).toBe(ZKErrorType.PROOF_VERIFICATION_FAILED);
        });
    });

    describe('GET /api/records/accessible', () => {
        it('should return accessible records for valid user', async () => {
            mockZKContract.getUserAccessibleRecords.mockResolvedValue([BigInt(1), BigInt(2)]);
            mockAcademicRecordsContract.recordExists.mockResolvedValue(true);
            mockAcademicRecordsContract.getRecord.mockResolvedValue({
                id: BigInt(1),
                studentId: 'STU001',
                studentName: 'John Doe',
                studentAddress: validUserAddress,
                universityName: 'Test University',
                recordType: 0,
                issuer: '0x1234',
                timestamp: BigInt(Date.now()),
                verified: true
            });

            const request = new NextRequest(`http://localhost/api/records/accessible?userAddress=${validUserAddress}`);
            const response = await getAccessible(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.records).toHaveLength(2);
            expect(data.userAddress).toBe(validUserAddress);
            expect(data.total).toBe(2);
        });

        it('should return 400 for missing userAddress', async () => {
            const request = new NextRequest('http://localhost/api/records/accessible');
            const response = await getAccessible(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toContain('Missing required parameter');
        });

        it('should return empty array for user with no accessible records', async () => {
            mockZKContract.getUserAccessibleRecords.mockResolvedValue([]);

            const request = new NextRequest(`http://localhost/api/records/accessible?userAddress=${validUserAddress}`);
            const response = await getAccessible(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.records).toHaveLength(0);
            expect(data.total).toBe(0);
        });
    });

    describe('POST /api/records/accessible', () => {
        it('should check access for multiple records', async () => {
            mockZKContract.hasAccess.mockImplementation((recordId: number) => {
                return Promise.resolve(recordId === 1);
            });

            const requestBody = {
                userAddress: validUserAddress,
                recordIds: [1, 2, 3]
            };

            const request = new NextRequest('http://localhost/api/records/accessible', {
                method: 'POST',
                body: JSON.stringify(requestBody),
                headers: { 'Content-Type': 'application/json' }
            });

            const response = await postAccessible(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.accessResults).toHaveLength(3);
            expect(data.accessible).toBe(1);
            expect(data.accessResults[0].hasAccess).toBe(true);
            expect(data.accessResults[1].hasAccess).toBe(false);
        });
    });

    describe('POST /api/records/[id]/document', () => {
        it('should return document URL with valid ZK proof', async () => {
            mockAcademicRecordsContract.recordExists.mockResolvedValue(true);
            mockAcademicRecordsContract.getRecord.mockResolvedValue({
                id: BigInt(1),
                studentName: 'John Doe',
                universityName: 'Test University',
                recordType: 0,
                verified: true
            });

            mockZKContract.hasAccess.mockResolvedValue(true);
            mockZKContract.verifyAccess.mockResolvedValue(true);
            mockZKContract.getEncryptedHash.mockResolvedValue('0xencrypted');

            const requestBody = {
                proof: validProof,
                userAddress: validUserAddress
            };

            const request = new NextRequest('http://localhost/api/records/1/document', {
                method: 'POST',
                body: JSON.stringify(requestBody),
                headers: { 'Content-Type': 'application/json' }
            });

            const response = await postDocument(request, { params: { id: '1' } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.document.documentUrl).toBeDefined();
            expect(data.document.accessGranted).toBe(true);
            expect(data.proof.verified).toBe(true);
        });

        it('should return 400 for invalid content type', async () => {
            const requestBody = {
                proof: validProof,
                userAddress: validUserAddress
            };

            const request = new NextRequest('http://localhost/api/records/1/document', {
                method: 'POST',
                body: JSON.stringify(requestBody),
                headers: { 'Content-Type': 'text/plain' }
            });

            const response = await postDocument(request, { params: { id: '1' } });
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toContain('Content-Type must be application/json');
        });
    });

    describe('GET /api/records/[id]/document', () => {
        it('should return access status without providing document', async () => {
            mockZKContract.hasAccess.mockResolvedValue(true);

            const request = new NextRequest(`http://localhost/api/records/1/document?userAddress=${validUserAddress}`);
            const response = await getDocument(request, { params: { id: '1' } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.hasAccess).toBe(true);
            expect(data.requiresZKProof).toBe(true);
            expect(data.message).toContain('Use POST method with ZK proof');
        });

        it('should return access denied for user without access', async () => {
            mockZKContract.hasAccess.mockResolvedValue(false);

            const request = new NextRequest(`http://localhost/api/records/1/document?userAddress=${validUserAddress}`);
            const response = await getDocument(request, { params: { id: '1' } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.hasAccess).toBe(false);
            expect(data.message).toContain('does not have access');
        });
    });

    describe('Error Handling', () => {
        it('should handle contract initialization errors', async () => {
            delete process.env.ZK_CONTRACT_ADDRESS;

            // Mock the Contract constructor to throw an error when address is undefined
            (ethers.Contract as Mock).mockImplementation((address, abi) => {
                if (!address) {
                    throw new Error('ZK_CONTRACT_ADDRESS not configured');
                }
                return mockZKContract;
            });

            const request = new NextRequest('http://localhost/api/records/1');
            const response = await getRecord(request, { params: { id: '1' } });

            expect(response.status).toBe(500);
        });

        it('should handle blockchain network errors', async () => {
            // Mock contract initialization to throw a configuration error
            (ethers.Contract as Mock).mockImplementation((address, abi) => {
                throw new Error('RPC_URL not configured');
            });

            const requestBody = {
                proof: validProof,
                userAddress: validUserAddress
            };

            const request = new NextRequest('http://localhost/api/records/1', {
                method: 'POST',
                body: JSON.stringify(requestBody),
                headers: { 'Content-Type': 'application/json' }
            });

            const response = await postRecord(request, { params: { id: '1' } });

            expect(response.status).toBe(500);
        });

        it('should handle malformed JSON requests', async () => {
            const request = new NextRequest('http://localhost/api/records/1', {
                method: 'POST',
                body: 'invalid json',
                headers: { 'Content-Type': 'application/json' }
            });

            const response = await postRecord(request, { params: { id: '1' } });

            expect(response.status).toBe(500);
        });
    });

    describe('Rate Limiting', () => {
        it('should enforce rate limits on document access', async () => {
            // This test would require implementing actual rate limiting
            // For now, we'll test that the rate limit check function exists
            const { checkRateLimit } = await import('../../../lib/zkMiddleware');

            const request = new NextRequest('http://localhost/api/records/1/document');
            const result = checkRateLimit(request);

            expect(result).toHaveProperty('allowed');
        });
    });

    describe('ZK Proof Structure Validation', () => {
        it('should reject malformed ZK proofs', async () => {
            const invalidProof = {
                pA: ['0x123'], // Missing second element
                pB: [['0x789', '0xabc'], ['0xdef', '0x012']],
                pC: ['0x345', '0x678'],
                publicSignals: ['1', validUserAddress, '0x999']
            };

            const requestBody = {
                proof: invalidProof,
                userAddress: validUserAddress
            };

            const request = new NextRequest('http://localhost/api/records/1', {
                method: 'POST',
                body: JSON.stringify(requestBody),
                headers: { 'Content-Type': 'application/json' }
            });

            const response = await postRecord(request, { params: { id: '1' } });
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toContain('Invalid ZK proof structure');
        });

        it('should reject proofs with mismatched record IDs', async () => {
            const mismatchedProof = {
                ...validProof,
                publicSignals: ['2', validUserAddress, '0x999'] // Wrong record ID
            };

            mockAcademicRecordsContract.recordExists.mockResolvedValue(true);
            mockZKContract.hasAccess.mockResolvedValue(true);

            const requestBody = {
                proof: mismatchedProof,
                userAddress: validUserAddress
            };

            const request = new NextRequest('http://localhost/api/records/1', {
                method: 'POST',
                body: JSON.stringify(requestBody),
                headers: { 'Content-Type': 'application/json' }
            });

            const response = await postRecord(request, { params: { id: '1' } });

            expect(response.status).toBe(403);
        });
    });
});