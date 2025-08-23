/**
 * Comprehensive error handling utilities for ZK proof system
 * Provides retry logic, fallback mechanisms, and user-friendly error messages
 */

import { ZKError, ZKErrorType } from '../types/zkTypes';

// Configuration for retry logic
export interface RetryConfig {
    maxAttempts: number;
    baseDelay: number; // in milliseconds
    maxDelay: number;
    backoffMultiplier: number;
    retryableErrors: ZKErrorType[];
}

// Default retry configuration
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxAttempts: 3,
    baseDelay: 1000, // 1 second
    maxDelay: 10000, // 10 seconds
    backoffMultiplier: 2,
    retryableErrors: [
        ZKErrorType.NETWORK_ERROR,
        ZKErrorType.PROOF_GENERATION_FAILED,
        ZKErrorType.CONTRACT_NOT_INITIALIZED,
        ZKErrorType.CIRCUIT_NOT_LOADED
    ]
};

// Error severity levels
export enum ErrorSeverity {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical'
}

// Error context for logging and monitoring
export interface ErrorContext {
    userId?: string;
    recordId?: number;
    operation: string;
    timestamp: number;
    userAgent?: string;
    networkInfo?: {
        online: boolean;
        effectiveType?: string;
    };
    zkServiceState?: {
        initialized: boolean;
        circuitLoaded: boolean;
        contractConnected: boolean;
        contractAddress?: string;
        provingKeyLoaded?: boolean;
        verificationKeyLoaded?: boolean;
    };
}

// User-friendly error messages
export const USER_FRIENDLY_MESSAGES: Record<ZKErrorType, string> = {
    [ZKErrorType.CIRCUIT_NOT_LOADED]:
        'Security components are loading. Please wait a moment and try again.',
    [ZKErrorType.PROOF_GENERATION_FAILED]:
        'Unable to generate security proof. Please check your connection and try again.',
    [ZKErrorType.PROOF_VERIFICATION_FAILED]:
        'Security verification failed. You may not have permission to access this document.',
    [ZKErrorType.ACCESS_DENIED]:
        'Access denied. You don\'t have permission to view this document.',
    [ZKErrorType.ENCRYPTION_FAILED]:
        'Document encryption failed. Please try again.',
    [ZKErrorType.DECRYPTION_FAILED]:
        'Unable to decrypt document. Please verify your access permissions.',
    [ZKErrorType.INVALID_ACCESS_KEY]:
        'Invalid access credentials. Please contact the document owner.',
    [ZKErrorType.CONTRACT_NOT_INITIALIZED]:
        'Blockchain connection is not ready. Please refresh the page and try again.',
    [ZKErrorType.INVALID_MERKLE_PROOF]:
        'Document verification failed. The document may have been modified.',
    [ZKErrorType.TIMESTAMP_EXPIRED]:
        'Your access has expired. Please request new access from the document owner.',
    [ZKErrorType.NETWORK_ERROR]:
        'Network connection issue. Please check your internet connection and try again.',
    [ZKErrorType.WALLET_NOT_CONNECTED]:
        'Please connect your wallet to access this document.',
    [ZKErrorType.INSUFFICIENT_PERMISSIONS]:
        'You don\'t have sufficient permissions to perform this action.',
    [ZKErrorType.INVALID_INPUT]:
        'Invalid input provided. Please check your data and try again.'
};

// Error severity mapping
export const ERROR_SEVERITY_MAP: Record<ZKErrorType, ErrorSeverity> = {
    [ZKErrorType.CIRCUIT_NOT_LOADED]: ErrorSeverity.MEDIUM,
    [ZKErrorType.PROOF_GENERATION_FAILED]: ErrorSeverity.MEDIUM,
    [ZKErrorType.PROOF_VERIFICATION_FAILED]: ErrorSeverity.LOW,
    [ZKErrorType.ACCESS_DENIED]: ErrorSeverity.LOW,
    [ZKErrorType.ENCRYPTION_FAILED]: ErrorSeverity.HIGH,
    [ZKErrorType.DECRYPTION_FAILED]: ErrorSeverity.MEDIUM,
    [ZKErrorType.INVALID_ACCESS_KEY]: ErrorSeverity.LOW,
    [ZKErrorType.CONTRACT_NOT_INITIALIZED]: ErrorSeverity.HIGH,
    [ZKErrorType.INVALID_MERKLE_PROOF]: ErrorSeverity.HIGH,
    [ZKErrorType.TIMESTAMP_EXPIRED]: ErrorSeverity.LOW,
    [ZKErrorType.NETWORK_ERROR]: ErrorSeverity.MEDIUM,
    [ZKErrorType.WALLET_NOT_CONNECTED]: ErrorSeverity.LOW,
    [ZKErrorType.INSUFFICIENT_PERMISSIONS]: ErrorSeverity.LOW,
    [ZKErrorType.INVALID_INPUT]: ErrorSeverity.LOW
};

/**
 * Enhanced error handler with retry logic and fallback mechanisms
 */
export class ZKErrorHandler {
    private static instance: ZKErrorHandler;
    private errorLog: Array<{ error: ZKError; context: ErrorContext }> = [];
    private retryConfig: RetryConfig;

    private constructor(config: Partial<RetryConfig> = {}) {
        this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
    }

    static getInstance(config?: Partial<RetryConfig>): ZKErrorHandler {
        if (!ZKErrorHandler.instance || config) {
            ZKErrorHandler.instance = new ZKErrorHandler(config);
        }
        return ZKErrorHandler.instance;
    }

    /**
     * Execute operation with retry logic and error handling
     */
    async executeWithRetry<T>(
        operation: () => Promise<T>,
        context: Partial<ErrorContext>,
        customConfig?: Partial<RetryConfig>
    ): Promise<T> {
        const config = { ...this.retryConfig, ...customConfig };
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;

                // Log the error
                const zkError = this.normalizeError(error);
                const fullContext: ErrorContext = {
                    operation: context.operation || 'unknown_operation',
                    timestamp: Date.now(),
                    userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
                    networkInfo: this.getNetworkInfo(),
                    ...context
                };

                this.logError(zkError, fullContext);

                // Check if error is retryable
                if (!this.isRetryableError(zkError) || attempt === config.maxAttempts) {
                    throw zkError;
                }

                // Calculate delay for next attempt
                const delay = Math.min(
                    config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1),
                    config.maxDelay
                );

                console.warn(
                    `ZK operation failed (attempt ${attempt}/${config.maxAttempts}). Retrying in ${delay}ms...`,
                    { error: zkError, context: fullContext }
                );

                await this.delay(delay);
            }
        }

        throw lastError;
    }

    /**
     * Execute operation with fallback mechanism
     */
    async executeWithFallback<T>(
        primaryOperation: () => Promise<T>,
        fallbackOperation: () => Promise<T>,
        context: Partial<ErrorContext>
    ): Promise<T> {
        try {
            return await this.executeWithRetry(primaryOperation, {
                ...context,
                operation: `${context.operation}_primary`
            });
        } catch (error) {
            console.warn('Primary ZK operation failed, attempting fallback:', error);

            try {
                return await fallbackOperation();
            } catch (fallbackError) {
                // Log both errors
                const primaryZKError = this.normalizeError(error);
                const fallbackZKError = this.normalizeError(fallbackError);

                const fullContext: ErrorContext = {
                    ...context,
                    operation: `${context.operation}_fallback_failed`,
                    timestamp: Date.now(),
                    userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
                    networkInfo: this.getNetworkInfo()
                };

                this.logError(primaryZKError, fullContext);
                this.logError(fallbackZKError, fullContext);

                // Throw the more severe error
                const primarySeverity = ERROR_SEVERITY_MAP[primaryZKError.type];
                const fallbackSeverity = ERROR_SEVERITY_MAP[fallbackZKError.type];

                throw this.getSeverityLevel(primarySeverity) >= this.getSeverityLevel(fallbackSeverity)
                    ? primaryZKError
                    : fallbackZKError;
            }
        }
    }

    /**
     * Normalize any error to ZKError
     */
    private normalizeError(error: any): ZKError {
        if (error instanceof ZKError) {
            return error;
        }

        // Try to infer ZK error type from error message or properties
        const errorMessage = error?.message || error?.toString() || 'Unknown error';
        const lowerMessage = errorMessage.toLowerCase();

        if (lowerMessage.includes('network') || lowerMessage.includes('fetch')) {
            return new ZKError(ZKErrorType.NETWORK_ERROR, errorMessage, error);
        }

        if (errorMessage.includes('circuit') || errorMessage.includes('wasm')) {
            return new ZKError(ZKErrorType.CIRCUIT_NOT_LOADED, errorMessage, error);
        }

        if (errorMessage.includes('proof') && errorMessage.includes('generation')) {
            return new ZKError(ZKErrorType.PROOF_GENERATION_FAILED, errorMessage, error);
        }

        if (errorMessage.includes('proof') && errorMessage.includes('verification')) {
            return new ZKError(ZKErrorType.PROOF_VERIFICATION_FAILED, errorMessage, error);
        }

        if (errorMessage.includes('contract') || errorMessage.includes('signer')) {
            return new ZKError(ZKErrorType.CONTRACT_NOT_INITIALIZED, errorMessage, error);
        }

        if (errorMessage.includes('wallet') || errorMessage.includes('MetaMask')) {
            return new ZKError(ZKErrorType.WALLET_NOT_CONNECTED, errorMessage, error);
        }

        // Default to proof generation failed for unknown errors
        return new ZKError(ZKErrorType.PROOF_GENERATION_FAILED, errorMessage, error);
    }

    /**
     * Check if error is retryable based on configuration
     */
    private isRetryableError(error: ZKError): boolean {
        return this.retryConfig.retryableErrors.includes(error.type);
    }

    /**
     * Get network information for error context
     */
    private getNetworkInfo(): ErrorContext['networkInfo'] {
        if (typeof window === 'undefined' || !window.navigator) {
            return undefined;
        }

        return {
            online: window.navigator.onLine,
            effectiveType: (window.navigator as any).connection?.effectiveType
        };
    }

    /**
     * Log error with context
     */
    private logError(error: ZKError, context: ErrorContext): void {
        this.errorLog.push({ error, context });

        // Keep only last 100 errors to prevent memory leaks
        if (this.errorLog.length > 100) {
            this.errorLog = this.errorLog.slice(-100);
        }

        // Log to console with appropriate level based on severity
        const severity = ERROR_SEVERITY_MAP[error.type];
        const logMessage = `ZK Error [${severity.toUpperCase()}]: ${error.message}`;

        switch (severity) {
            case ErrorSeverity.CRITICAL:
            case ErrorSeverity.HIGH:
                console.error(logMessage, { error, context });
                break;
            case ErrorSeverity.MEDIUM:
                console.warn(logMessage, { error, context });
                break;
            case ErrorSeverity.LOW:
                console.info(logMessage, { error, context });
                break;
        }

        // Send to monitoring service in production
        if (process.env.NODE_ENV === 'production') {
            this.sendToMonitoring(error, context);
        }
    }

    /**
     * Send error to monitoring service
     */
    private sendToMonitoring(error: ZKError, context: ErrorContext): void {
        // This would integrate with your monitoring service (e.g., Sentry, DataDog, etc.)
        // For now, we'll just log it
        try {
            // Example: Send to monitoring service
            // monitoringService.captureException(error, { extra: context });
            console.log('Would send to monitoring:', { error: error.type, context });
        } catch (monitoringError) {
            console.error('Failed to send error to monitoring:', monitoringError);
        }
    }

    /**
     * Get numeric severity level for comparison
     */
    private getSeverityLevel(severity: ErrorSeverity): number {
        switch (severity) {
            case ErrorSeverity.LOW: return 1;
            case ErrorSeverity.MEDIUM: return 2;
            case ErrorSeverity.HIGH: return 3;
            case ErrorSeverity.CRITICAL: return 4;
            default: return 0;
        }
    }

    /**
     * Delay utility for retry logic
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get user-friendly error message
     */
    getUserFriendlyMessage(error: ZKError): string {
        return USER_FRIENDLY_MESSAGES[error.type] || 'An unexpected error occurred. Please try again.';
    }

    /**
     * Get error severity
     */
    getErrorSeverity(error: ZKError): ErrorSeverity {
        return ERROR_SEVERITY_MAP[error.type] || ErrorSeverity.MEDIUM;
    }

    /**
     * Get recent errors for debugging
     */
    getRecentErrors(limit: number = 10): Array<{ error: ZKError; context: ErrorContext }> {
        return this.errorLog.slice(-limit);
    }

    /**
     * Clear error log
     */
    clearErrorLog(): void {
        this.errorLog = [];
    }

    /**
     * Get error statistics
     */
    getErrorStats(): {
        total: number;
        byType: Record<ZKErrorType, number>;
        bySeverity: Record<ErrorSeverity, number>;
    } {
        const stats = {
            total: this.errorLog.length,
            byType: {} as Record<ZKErrorType, number>,
            bySeverity: {} as Record<ErrorSeverity, number>
        };

        // Initialize counters
        Object.values(ZKErrorType).forEach(type => {
            stats.byType[type] = 0;
        });
        Object.values(ErrorSeverity).forEach(severity => {
            stats.bySeverity[severity] = 0;
        });

        // Count errors
        this.errorLog.forEach(({ error }) => {
            stats.byType[error.type]++;
            const severity = ERROR_SEVERITY_MAP[error.type];
            stats.bySeverity[severity]++;
        });

        return stats;
    }
}

// Export singleton instance
export const zkErrorHandler = ZKErrorHandler.getInstance();