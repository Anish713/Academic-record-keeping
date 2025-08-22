/**
 * Unit tests for ZKService
 * Tests all ZK service functions with mocked circuits and contracts
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ZKError, ZKErrorType } from '../../types/zkTypes';

// Mock snarkjs
vi.mock('snarkjs', () => ({
    groth16: {
        fullProve: vi.fn()
    }
}));

// Mock ethers
vi.mock('ethers', () => ({
    ethers: {
        BrowserProvider: vi.fn(),
        Contract: vi.fn(),
        keccak256: vi.fn(),
        toUtf8Bytes: vi.fn(),
        solidityPackedKeccak256: vi.fn(),
        getBytes: vi.fn(),
        hexlify: vi.fn()
    }
}));

// Mock global fetch
global.fetch = vi.fn();

// Mock window.ethereum
Object.defineProperty(window, 'ethereum', {
    writable: true,
    value: {
        request: vi.fn()
    }
});

describe('ZKService', () => {
    let ZKService: any;
    let zkService: any;

    beforeEach(async () => {
        // Dynamically import the service after mocks are set up
        const module = await import('../zkService');
        ZKService = module.ZKService;
        zkService = new ZKService();

        // Reset all mocks
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Initialization', () => {
        it('should throw error when circuit WASM fails to load', async () => {
            (global.fetch as any).mockResolvedValueOnce({
                ok: false,
                statusText: 'Not Found'
            });

            await expect(zkService.init()).rejects.toThrow(ZKError);
            await expect(zkService.init()).rejects.toThrow('Failed to load circuit WASM');
        });

        it('should throw error when proving key fails to load', async () => {
            (global.fetch as any)
                .mockResolvedValueOnce({
                    ok: true,
                    arrayBuffer: () => Promise.resolve(new ArrayBuffer(100))
                })
                .mockResolvedValueOnce({
                    ok: false,
                    statusText: 'Not Found'
                });

            await expect(zkService.init()).rejects.toThrow(ZKError);
            await expect(zkService.init()).rejects.toThrow('Failed to load proving key');
        });

        it('should throw error when verification key fails to load', async () => {
            (global.fetch as any)
                .mockResolvedValueOnce({
                    ok: true,
                    arrayBuffer: () => Promise.resolve(new ArrayBuffer(100))
                })
                .mockResolvedValueOnce({
                    ok: true,
                    arrayBuffer: () => Promise.resolve(new ArrayBuffer(200))
                })
                .mockResolvedValueOnce({
                    ok: false,
                    statusText: 'Not Found'
                });

            await expect(zkService.init()).rejects.toThrow(ZKError);
            await expect(zkService.init()).rejects.toThrow('Failed to load verification key');
        });

        it('should throw error when MetaMask is not available', async () => {
            // Remove ethereum from window
            delete (window as any).ethereum;

            (global.fetch as any)
                .mockResolvedValueOnce({
                    ok: true,
                    arrayBuffer: () => Promise.resolve(new ArrayBuffer(100))
                })
                .mockResolvedValueOnce({
                    ok: true,
                    arrayBuffer: () => Promise.resolve(new ArrayBuffer(200))
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ vk_alpha_1: ['1', '2'] })
                });

            await expect(zkService.init()).rejects.toThrow(ZKError);
            await expect(zkService.init()).rejects.toThrow('MetaMask is not installed');
        });

        it('should throw error when ZK contract address is not configured', async () => {
            delete process.env.NEXT_PUBLIC_ZK_CONTRACT_ADDRESS;

            (global.fetch as any)
                .mockResolvedValueOnce({
                    ok: true,
                    arrayBuffer: () => Promise.resolve(new ArrayBuffer(100))
                })
                .mockResolvedValueOnce({
                    ok: true,
                    arrayBuffer: () => Promise.resolve(new ArrayBuffer(200))
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ vk_alpha_1: ['1', '2'] })
                });

            await expect(zkService.init()).rejects.toThrow(ZKError);
            await expect(zkService.init()).rejects.toThrow('ZK contract address not configured');
        });
    });

    describe('Helper Functions', () => {
        it('should convert address to field element correctly', () => {
            const address = '0x1234567890123456789012345678901234567890';
            const fieldElement = zkService.addressToField(address);

            expect(fieldElement).toBe(BigInt(address).toString());
        });

        it('should throw error when getting address without signer', async () => {
            const uninitializedService = new ZKService();
            await expect(uninitializedService.getCurrentAddress()).rejects.toThrow(ZKError);
        });
    });

    describe('Error Handling', () => {
        it('should throw ZKError with correct type for circuit loading failures', async () => {
            (global.fetch as any).mockRejectedValue(new Error('Network error'));

            try {
                await zkService.init();
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error).toBeInstanceOf(ZKError);
                expect((error as ZKError).type).toBe(ZKErrorType.CIRCUIT_NOT_LOADED);
            }
        });

        it('should throw ZKError when service not initialized', async () => {
            const uninitializedService = new ZKService();

            try {
                await uninitializedService.verifyDocumentAccess(123);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error).toBeInstanceOf(ZKError);
                expect((error as ZKError).type).toBe(ZKErrorType.CIRCUIT_NOT_LOADED);
            }
        });

        it('should throw ZKError for contract initialization failures', async () => {
            delete process.env.NEXT_PUBLIC_ZK_CONTRACT_ADDRESS;

            (global.fetch as any)
                .mockResolvedValueOnce({
                    ok: true,
                    arrayBuffer: () => Promise.resolve(new ArrayBuffer(100))
                })
                .mockResolvedValueOnce({
                    ok: true,
                    arrayBuffer: () => Promise.resolve(new ArrayBuffer(200))
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ vk_alpha_1: ['1', '2'] })
                });

            try {
                await zkService.init();
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error).toBeInstanceOf(ZKError);
                expect((error as ZKError).type).toBe(ZKErrorType.CONTRACT_NOT_INITIALIZED);
            }
        });
    });

    describe('Basic Functionality', () => {
        it('should create ZKService instance', () => {
            expect(zkService).toBeDefined();
            expect(zkService).toBeInstanceOf(ZKService);
        });

        it('should have all required methods', () => {
            expect(typeof zkService.init).toBe('function');
            expect(typeof zkService.generateAccessProof).toBe('function');
            expect(typeof zkService.verifyDocumentAccess).toBe('function');
            expect(typeof zkService.getCurrentAddress).toBe('function');
            expect(typeof zkService.getUserAccessibleRecords).toBe('function');
            expect(typeof zkService.hasAccessToRecord).toBe('function');
            expect(typeof zkService.getEncryptedRecord).toBe('function');
        });

        it('should handle string to field conversion', () => {
            const testString = 'test-access-key';
            const result = zkService.stringToField(testString);
            expect(result).toBeDefined();
            expect(typeof result).toBe('string');
        });

        it('should handle address to field conversion', () => {
            const address = '0x1234567890123456789012345678901234567890';
            const result = zkService.addressToField(address);
            expect(result).toBe(BigInt(address).toString());
        });
    });
});