/**
 * Unit tests for ZK error handler
 * Tests retry logic, fallback mechanisms, and error classification
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ZKErrorHandler, DEFAULT_RETRY_CONFIG, ErrorSeverity } from '../zkErrorHandler';
import { ZKError, ZKErrorType } from '../../types/zkTypes';

// Mock console methods
const mockConsole = {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    log: vi.fn()
};

vi.stubGlobal('console', mockConsole);

// Mock window.navigator
Object.defineProperty(window, 'navigator', {
    value: {
        onLine: true,
        userAgent: 'test-agent',
        connection: {
            effectiveType: '4g'
        }
    },
    writable: true
});

describe('ZKErrorHandler', () => {
    let errorHandler: ZKErrorHandler;

    beforeEach(() => {
        // Reset the singleton instance for testing
        (ZKErrorHandler as any).instance = null;

        // Create a fresh instance for each test
        errorHandler = ZKErrorHandler.getInstance({
            maxAttempts: 3,
            baseDelay: 100, // Shorter delays for testing
            maxDelay: 1000
        });
        errorHandler.clearErrorLog();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllTimers();
    });

    describe('Error Classification', () => {
        it('should classify network errors correctly', () => {
            const networkError = new Error('Network request failed');
            const zkError = errorHandler['normalizeError'](networkError);

            expect(zkError.type).toBe(ZKErrorType.NETWORK_ERROR);
            expect(zkError.message).toContain('Network request failed');
        });

        it('should classify circuit errors correctly', () => {
            const circuitError = new Error('Failed to load circuit wasm');
            const zkError = errorHandler['normalizeError'](circuitError);

            expect(zkError.type).toBe(ZKErrorType.CIRCUIT_NOT_LOADED);
        });

        it('should preserve ZKError instances', () => {
            const originalError = new ZKError(ZKErrorType.ACCESS_DENIED, 'Access denied');
            const normalizedError = errorHandler['normalizeError'](originalError);

            expect(normalizedError).toBe(originalError);
        });

        it('should default to proof generation failed for unknown errors', () => {
            const unknownError = new Error('Unknown error');
            const zkError = errorHandler['normalizeError'](unknownError);

            expect(zkError.type).toBe(ZKErrorType.PROOF_GENERATION_FAILED);
        });
    });

    describe('Retry Logic', () => {
        it('should retry retryable errors', async () => {
            let attemptCount = 0;
            const operation = vi.fn().mockImplementation(() => {
                attemptCount++;
                if (attemptCount < 3) {
                    throw new ZKError(ZKErrorType.NETWORK_ERROR, 'Network error');
                }
                return 'success';
            });

            const result = await errorHandler.executeWithRetry(
                operation,
                { operation: 'test_operation' }
            );

            expect(result).toBe('success');
            expect(operation).toHaveBeenCalledTimes(3);
        });

        it('should not retry non-retryable errors', async () => {
            const operation = vi.fn().mockRejectedValue(
                new ZKError(ZKErrorType.ACCESS_DENIED, 'Access denied')
            );

            await expect(
                errorHandler.executeWithRetry(operation, { operation: 'test_operation' })
            ).rejects.toThrow('Access denied');

            expect(operation).toHaveBeenCalledTimes(1);
        });

        it('should respect max attempts limit', async () => {
            const operation = vi.fn().mockRejectedValue(
                new ZKError(ZKErrorType.NETWORK_ERROR, 'Network error')
            );

            await expect(
                errorHandler.executeWithRetry(operation, { operation: 'test_operation' })
            ).rejects.toThrow('Network error');

            expect(operation).toHaveBeenCalledTimes(3); // Default max attempts
        });

        it('should apply exponential backoff', async () => {
            const delays: number[] = [];
            const originalDelay = errorHandler['delay'];
            errorHandler['delay'] = vi.fn().mockImplementation((ms: number) => {
                delays.push(ms);
                return Promise.resolve();
            });

            const operation = vi.fn().mockRejectedValue(
                new ZKError(ZKErrorType.NETWORK_ERROR, 'Network error')
            );

            await expect(
                errorHandler.executeWithRetry(operation, { operation: 'test_operation' })
            ).rejects.toThrow();

            expect(delays).toHaveLength(2); // 2 retries after initial failure
            expect(delays[0]).toBe(100); // Base delay
            expect(delays[1]).toBe(200); // Base delay * backoff multiplier
        });
    });

    describe('Fallback Mechanism', () => {
        it('should execute fallback when primary operation fails', async () => {
            const primaryOperation = vi.fn().mockRejectedValue(
                new ZKError(ZKErrorType.PROOF_GENERATION_FAILED, 'Proof failed')
            );
            const fallbackOperation = vi.fn().mockResolvedValue('fallback_result');

            const result = await errorHandler.executeWithFallback(
                primaryOperation,
                fallbackOperation,
                { operation: 'test_operation' }
            );

            expect(result).toBe('fallback_result');
            expect(primaryOperation).toHaveBeenCalled();
            expect(fallbackOperation).toHaveBeenCalled();
        });

        it('should throw more severe error when both operations fail', async () => {
            const primaryOperation = vi.fn().mockRejectedValue(
                new ZKError(ZKErrorType.ACCESS_DENIED, 'Access denied') // Low severity
            );
            const fallbackOperation = vi.fn().mockRejectedValue(
                new ZKError(ZKErrorType.CONTRACT_NOT_INITIALIZED, 'Contract error') // High severity
            );

            await expect(
                errorHandler.executeWithFallback(
                    primaryOperation,
                    fallbackOperation,
                    { operation: 'test_operation' }
                )
            ).rejects.toThrow('Contract error');
        });
    });

    describe('Error Logging', () => {
        it('should log errors with appropriate severity levels', () => {
            const highSeverityError = new ZKError(
                ZKErrorType.CONTRACT_NOT_INITIALIZED,
                'Contract error'
            );
            const context = {
                operation: 'test_operation',
                timestamp: Date.now()
            };

            errorHandler['logError'](highSeverityError, context);

            expect(mockConsole.error).toHaveBeenCalledWith(
                expect.stringContaining('ZK Error [HIGH]'),
                expect.objectContaining({ error: highSeverityError, context })
            );
        });

        it('should maintain error log with size limit', () => {
            // Add more than 100 errors
            for (let i = 0; i < 150; i++) {
                const error = new ZKError(ZKErrorType.NETWORK_ERROR, `Error ${i}`);
                const context = { operation: 'test', timestamp: Date.now() };
                errorHandler['logError'](error, context);
            }

            const recentErrors = errorHandler.getRecentErrors(200);
            expect(recentErrors).toHaveLength(100); // Should be capped at 100
        });
    });

    describe('User-Friendly Messages', () => {
        it('should provide user-friendly messages for all error types', () => {
            Object.values(ZKErrorType).forEach(errorType => {
                const error = new ZKError(errorType, 'Technical message');
                const userMessage = errorHandler.getUserFriendlyMessage(error);

                expect(userMessage).toBeTruthy();
                expect(userMessage).not.toContain('Technical message');
                expect(userMessage.length).toBeGreaterThan(10);
            });
        });

        it('should return default message for unknown error types', () => {
            const error = new ZKError('UNKNOWN_TYPE' as ZKErrorType, 'Unknown error');
            const userMessage = errorHandler.getUserFriendlyMessage(error);

            expect(userMessage).toBe('An unexpected error occurred. Please try again.');
        });
    });

    describe('Error Statistics', () => {
        it('should track error statistics correctly', () => {
            const errors = [
                new ZKError(ZKErrorType.NETWORK_ERROR, 'Network 1'),
                new ZKError(ZKErrorType.NETWORK_ERROR, 'Network 2'),
                new ZKError(ZKErrorType.ACCESS_DENIED, 'Access denied'),
            ];

            errors.forEach(error => {
                errorHandler['logError'](error, { operation: 'test', timestamp: Date.now() });
            });

            const stats = errorHandler.getErrorStats();

            expect(stats.total).toBe(3);
            expect(stats.byType[ZKErrorType.NETWORK_ERROR]).toBe(2);
            expect(stats.byType[ZKErrorType.ACCESS_DENIED]).toBe(1);
            expect(stats.bySeverity[ErrorSeverity.MEDIUM]).toBe(2); // Network errors
            expect(stats.bySeverity[ErrorSeverity.LOW]).toBe(1); // Access denied
        });

        it('should clear error log', () => {
            const error = new ZKError(ZKErrorType.NETWORK_ERROR, 'Network error');
            errorHandler['logError'](error, { operation: 'test', timestamp: Date.now() });

            expect(errorHandler.getRecentErrors()).toHaveLength(1);

            errorHandler.clearErrorLog();

            expect(errorHandler.getRecentErrors()).toHaveLength(0);
        });
    });

    describe('Network Information', () => {
        it('should capture network information in error context', () => {
            const error = new ZKError(ZKErrorType.NETWORK_ERROR, 'Network error');
            const context = {
                operation: 'test_operation',
                timestamp: Date.now()
            };

            errorHandler['logError'](error, context);

            const recentErrors = errorHandler.getRecentErrors(1);
            expect(recentErrors[0].context.networkInfo).toEqual({
                online: true,
                effectiveType: '4g'
            });
        });

        it('should handle missing navigator gracefully', () => {
            // Temporarily remove navigator
            const originalNavigator = window.navigator;
            delete (window as any).navigator;

            const networkInfo = errorHandler['getNetworkInfo']();
            expect(networkInfo).toBeUndefined();

            // Restore navigator
            (window as any).navigator = originalNavigator;
        });
    });

    describe('Custom Configuration', () => {
        it('should accept custom retry configuration', () => {
            const customHandler = ZKErrorHandler.getInstance({
                maxAttempts: 5,
                baseDelay: 500,
                maxDelay: 5000,
                backoffMultiplier: 3
            });

            expect(customHandler['retryConfig'].maxAttempts).toBe(5);
            expect(customHandler['retryConfig'].baseDelay).toBe(500);
            expect(customHandler['retryConfig'].maxDelay).toBe(5000);
            expect(customHandler['retryConfig'].backoffMultiplier).toBe(3);
        });

        it('should merge custom config with defaults', () => {
            const customHandler = ZKErrorHandler.getInstance({
                maxAttempts: 5
                // Other values should use defaults
            });

            expect(customHandler['retryConfig'].maxAttempts).toBe(5);
            expect(customHandler['retryConfig'].baseDelay).toBe(DEFAULT_RETRY_CONFIG.baseDelay);
            expect(customHandler['retryConfig'].maxDelay).toBe(DEFAULT_RETRY_CONFIG.maxDelay);
        });
    });

    describe('Error Context Enhancement', () => {
        it('should enhance error context with ZK service state', async () => {
            const operation = vi.fn().mockRejectedValue(
                new ZKError(ZKErrorType.CIRCUIT_NOT_LOADED, 'Circuit error')
            );

            const context = {
                operation: 'test_operation',
                zkServiceState: {
                    initialized: false,
                    circuitLoaded: false,
                    contractConnected: true
                }
            };

            await expect(
                errorHandler.executeWithRetry(operation, context)
            ).rejects.toThrow();

            const recentErrors = errorHandler.getRecentErrors(1);
            expect(recentErrors[0].context.zkServiceState).toEqual(context.zkServiceState);
        });

        it('should include user and record information in context', async () => {
            const operation = vi.fn().mockRejectedValue(
                new ZKError(ZKErrorType.ACCESS_DENIED, 'Access denied')
            );

            const context = {
                operation: 'document_access',
                userId: '0x123...',
                recordId: 42
            };

            await expect(
                errorHandler.executeWithRetry(operation, context)
            ).rejects.toThrow();

            const recentErrors = errorHandler.getRecentErrors(1);
            expect(recentErrors[0].context.userId).toBe('0x123...');
            expect(recentErrors[0].context.recordId).toBe(42);
        });
    });
});