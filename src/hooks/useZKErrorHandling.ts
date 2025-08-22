/**
 * React hook for handling ZK errors in UI components
 * Provides user-friendly error messages and retry functionality
 */

import { useState, useCallback, useEffect } from 'react';
import { ZKError, ZKErrorType } from '../types/zkTypes';
import { zkErrorHandler, ErrorSeverity } from '../lib/zkErrorHandler';
import { zkFallbackService } from '../services/zkFallbackService';

export interface ZKErrorState {
    error: ZKError | null;
    isRetrying: boolean;
    retryCount: number;
    canRetry: boolean;
    userMessage: string;
    severity: ErrorSeverity;
    fallbackAvailable: boolean;
}

export interface ZKErrorActions {
    setError: (error: ZKError | null) => void;
    retry: () => Promise<void>;
    clearError: () => void;
    useFallback: () => void;
}

export interface UseZKErrorHandlingOptions {
    maxRetries?: number;
    autoRetryDelay?: number;
    enableFallback?: boolean;
    onError?: (error: ZKError) => void;
    onRetry?: (retryCount: number) => void;
    onFallback?: () => void;
}

/**
 * Hook for managing ZK errors in React components
 */
export function useZKErrorHandling(
    operation: string,
    options: UseZKErrorHandlingOptions = {}
): [ZKErrorState, ZKErrorActions] {
    const {
        maxRetries = 3,
        autoRetryDelay = 0,
        enableFallback = true,
        onError,
        onRetry,
        onFallback
    } = options;

    const [errorState, setErrorState] = useState<ZKErrorState>({
        error: null,
        isRetrying: false,
        retryCount: 0,
        canRetry: false,
        userMessage: '',
        severity: ErrorSeverity.LOW,
        fallbackAvailable: false
    });

    const [retryOperation, setRetryOperation] = useState<(() => Promise<void>) | null>(null);

    // Update error state when error changes
    const setError = useCallback((error: ZKError | null) => {
        if (!error) {
            setErrorState({
                error: null,
                isRetrying: false,
                retryCount: 0,
                canRetry: false,
                userMessage: '',
                severity: ErrorSeverity.LOW,
                fallbackAvailable: false
            });
            return;
        }

        const severity = zkErrorHandler.getErrorSeverity(error);
        const userMessage = zkErrorHandler.getUserFriendlyMessage(error);
        const canRetry = isRetryableError(error) && errorState.retryCount < maxRetries;
        const fallbackAvailable = enableFallback && isFallbackAvailable(operation);

        setErrorState(prev => ({
            error,
            isRetrying: false,
            retryCount: prev.error?.type === error.type ? prev.retryCount : 0,
            canRetry,
            userMessage,
            severity,
            fallbackAvailable
        }));

        // Call error callback
        if (onError) {
            onError(error);
        }

        // Auto-retry for certain errors if configured
        if (autoRetryDelay > 0 && canRetry && isAutoRetryableError(error)) {
            setTimeout(() => {
                retry();
            }, autoRetryDelay);
        }
    }, [errorState.retryCount, maxRetries, enableFallback, operation, onError, autoRetryDelay]);

    // Retry the failed operation
    const retry = useCallback(async () => {
        if (!errorState.error || !errorState.canRetry || !retryOperation) {
            return;
        }

        setErrorState(prev => ({
            ...prev,
            isRetrying: true
        }));

        try {
            await retryOperation();

            // Success - clear error
            setErrorState({
                error: null,
                isRetrying: false,
                retryCount: 0,
                canRetry: false,
                userMessage: '',
                severity: ErrorSeverity.LOW,
                fallbackAvailable: false
            });
        } catch (error) {
            const zkError = error instanceof ZKError ? error :
                new ZKError(ZKErrorType.PROOF_GENERATION_FAILED, 'Retry failed');

            const newRetryCount = errorState.retryCount + 1;
            const canRetryAgain = isRetryableError(zkError) && newRetryCount < maxRetries;

            setErrorState(prev => ({
                ...prev,
                error: zkError,
                isRetrying: false,
                retryCount: newRetryCount,
                canRetry: canRetryAgain,
                userMessage: zkErrorHandler.getUserFriendlyMessage(zkError),
                severity: zkErrorHandler.getErrorSeverity(zkError)
            }));

            if (onRetry) {
                onRetry(newRetryCount);
            }
        }
    }, [errorState.error, errorState.canRetry, errorState.retryCount, maxRetries, retryOperation, onRetry]);

    // Clear the current error
    const clearError = useCallback(() => {
        setError(null);
    }, [setError]);

    // Use fallback functionality
    const useFallback = useCallback(() => {
        if (!errorState.fallbackAvailable) {
            return;
        }

        if (onFallback) {
            onFallback();
        }

        // Clear error since we're using fallback
        clearError();
    }, [errorState.fallbackAvailable, onFallback, clearError]);

    // Set retry operation function
    const setRetryOperation = useCallback((operation: () => Promise<void>) => {
        setRetryOperation(() => operation);
    }, []);

    // Helper function to check if error is retryable
    const isRetryableError = (error: ZKError): boolean => {
        const retryableErrors = [
            ZKErrorType.NETWORK_ERROR,
            ZKErrorType.PROOF_GENERATION_FAILED,
            ZKErrorType.CONTRACT_NOT_INITIALIZED,
            ZKErrorType.CIRCUIT_NOT_LOADED
        ];
        return retryableErrors.includes(error.type);
    };

    // Helper function to check if error should be auto-retried
    const isAutoRetryableError = (error: ZKError): boolean => {
        const autoRetryableErrors = [
            ZKErrorType.NETWORK_ERROR,
            ZKErrorType.CONTRACT_NOT_INITIALIZED
        ];
        return autoRetryableErrors.includes(error.type);
    };

    // Helper function to check if fallback is available
    const isFallbackAvailable = (operation: string): boolean => {
        if (operation.includes('document_access')) {
            return zkFallbackService.isFallbackAvailable('document_access');
        }
        if (operation.includes('record_listing')) {
            return zkFallbackService.isFallbackAvailable('record_listing');
        }
        if (operation.includes('record_sharing')) {
            return zkFallbackService.isFallbackAvailable('record_sharing');
        }
        if (operation.includes('proof_generation')) {
            return zkFallbackService.isFallbackAvailable('proof_generation');
        }
        return false;
    };

    return [
        errorState,
        {
            setError,
            retry,
            clearError,
            useFallback
        }
    ];
}

/**
 * Hook for executing ZK operations with automatic error handling
 */
export function useZKOperation<T>(
    operation: () => Promise<T>,
    operationName: string,
    options: UseZKErrorHandlingOptions = {}
): {
    execute: () => Promise<T | null>;
    isLoading: boolean;
    error: ZKErrorState;
    actions: ZKErrorActions;
} {
    const [error, actions] = useZKErrorHandling(operationName, options);
    const [isLoading, setIsLoading] = useState(false);

    const execute = useCallback(async (): Promise<T | null> => {
        setIsLoading(true);
        actions.clearError();

        try {
            const result = await operation();
            setIsLoading(false);
            return result;
        } catch (err) {
            setIsLoading(false);
            const zkError = err instanceof ZKError ? err :
                new ZKError(ZKErrorType.PROOF_GENERATION_FAILED, 'Operation failed');

            actions.setError(zkError);
            return null;
        }
    }, [operation, actions]);

    return {
        execute,
        isLoading,
        error,
        actions
    };
}

/**
 * Hook for displaying ZK error notifications
 */
export function useZKErrorNotification() {
    const [notifications, setNotifications] = useState<Array<{
        id: string;
        error: ZKError;
        timestamp: number;
        dismissed: boolean;
    }>>([]);

    const addNotification = useCallback((error: ZKError) => {
        const notification = {
            id: `${Date.now()}-${Math.random()}`,
            error,
            timestamp: Date.now(),
            dismissed: false
        };

        setNotifications(prev => [...prev, notification]);

        // Auto-dismiss low severity errors after 5 seconds
        if (zkErrorHandler.getErrorSeverity(error) === ErrorSeverity.LOW) {
            setTimeout(() => {
                dismissNotification(notification.id);
            }, 5000);
        }
    }, []);

    const dismissNotification = useCallback((id: string) => {
        setNotifications(prev =>
            prev.map(notification =>
                notification.id === id
                    ? { ...notification, dismissed: true }
                    : notification
            )
        );

        // Remove dismissed notifications after animation
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }, 300);
    }, []);

    const clearAllNotifications = useCallback(() => {
        setNotifications([]);
    }, []);

    return {
        notifications: notifications.filter(n => !n.dismissed),
        addNotification,
        dismissNotification,
        clearAllNotifications
    };
}