/**
 * React component for displaying ZK errors with user-friendly messages
 * Provides retry buttons and fallback options
 */

import React from 'react';
import { ZKError, ZKErrorType } from '../../types/zkTypes';
import { ErrorSeverity } from '../../lib/zkErrorHandler';
import { ZKErrorState, ZKErrorActions } from '../../hooks/useZKErrorHandling';

interface ZKErrorDisplayProps {
  error: ZKErrorState;
  actions: ZKErrorActions;
  className?: string;
  showDetails?: boolean;
  compact?: boolean;
}

/**
 * Main error display component
 */
export function ZKErrorDisplay({
  error,
  actions,
  className = '',
  showDetails = false,
  compact = false
}: ZKErrorDisplayProps) {
  if (!error.error) {
    return null;
  }

  const severityStyles = getSeverityStyles(error.severity);
  const icon = getSeverityIcon(error.severity);

  return (
    <div className={`zk-error-display ${severityStyles.container} ${className}`}>
      <div className="flex items-start space-x-3">
        <div className={`flex-shrink-0 ${severityStyles.icon}`}>
          {icon}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className={`text-sm font-medium ${severityStyles.title}`}>
              {getErrorTitle(error.error.type)}
            </h3>
            
            <button
              onClick={actions.clearError}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Dismiss error"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          
          <div className={`mt-1 text-sm ${severityStyles.message}`}>
            {error.userMessage}
          </div>

          {showDetails && error.error && (
            <details className="mt-2">
              <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                Technical Details
              </summary>
              <div className="mt-1 text-xs text-gray-600 font-mono bg-gray-50 p-2 rounded">
                <div><strong>Type:</strong> {error.error.type}</div>
                <div><strong>Message:</strong> {error.error.message}</div>
                {error.error.details && (
                  <div><strong>Details:</strong> {JSON.stringify(error.error.details, null, 2)}</div>
                )}
              </div>
            </details>
          )}

          {!compact && (
            <div className="mt-3 flex flex-wrap gap-2">
              {error.canRetry && (
                <button
                  onClick={actions.retry}
                  disabled={error.isRetrying}
                  className={`inline-flex items-center px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    error.isRetrying
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                  }`}
                >
                  {error.isRetrying ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-3 w-3" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Retrying...
                    </>
                  ) : (
                    <>
                      <svg className="-ml-1 mr-2 h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                      </svg>
                      Try Again ({error.retryCount + 1}/{3})
                    </>
                  )}
                </button>
              )}

              {error.fallbackAvailable && (
                <button
                  onClick={actions.useFallback}
                  className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-md bg-yellow-100 text-yellow-800 hover:bg-yellow-200 transition-colors"
                >
                  <svg className="-ml-1 mr-2 h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Use Compatibility Mode
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Compact error display for inline use
 */
export function ZKErrorBadge({
  error,
  actions,
  className = ''
}: Omit<ZKErrorDisplayProps, 'compact' | 'showDetails'>) {
  if (!error.error) {
    return null;
  }

  const severityStyles = getSeverityStyles(error.severity);

  return (
    <div className={`inline-flex items-center space-x-2 px-2 py-1 rounded-md text-xs ${severityStyles.badge} ${className}`}>
      <span>{getSeverityIcon(error.severity, 'w-3 h-3')}</span>
      <span>{error.userMessage}</span>
      
      {error.canRetry && (
        <button
          onClick={actions.retry}
          disabled={error.isRetrying}
          className="ml-1 hover:opacity-75 transition-opacity"
          title="Retry"
        >
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
        </button>
      )}
      
      <button
        onClick={actions.clearError}
        className="ml-1 hover:opacity-75 transition-opacity"
        title="Dismiss"
      >
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  );
}

/**
 * Error notification toast component
 */
export function ZKErrorToast({
  error,
  onDismiss,
  className = ''
}: {
  error: ZKError;
  onDismiss: () => void;
  className?: string;
}) {
  const severity = getSeverityStyles(getSeverityFromError(error));
  const icon = getSeverityIcon(getSeverityFromError(error));

  return (
    <div className={`zk-error-toast ${severity.toast} ${className} animate-slide-in`}>
      <div className="flex items-start space-x-3">
        <div className={`flex-shrink-0 ${severity.icon}`}>
          {icon}
        </div>
        
        <div className="flex-1">
          <h4 className={`text-sm font-medium ${severity.title}`}>
            {getErrorTitle(error.type)}
          </h4>
          <p className={`mt-1 text-sm ${severity.message}`}>
            {getErrorMessage(error)}
          </p>
        </div>
        
        <button
          onClick={onDismiss}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// Helper functions

function getSeverityStyles(severity: ErrorSeverity) {
  switch (severity) {
    case ErrorSeverity.CRITICAL:
      return {
        container: 'bg-red-50 border border-red-200 rounded-md p-4',
        icon: 'text-red-400',
        title: 'text-red-800',
        message: 'text-red-700',
        badge: 'bg-red-100 text-red-800',
        toast: 'bg-red-50 border-l-4 border-red-400 p-4 shadow-lg'
      };
    case ErrorSeverity.HIGH:
      return {
        container: 'bg-orange-50 border border-orange-200 rounded-md p-4',
        icon: 'text-orange-400',
        title: 'text-orange-800',
        message: 'text-orange-700',
        badge: 'bg-orange-100 text-orange-800',
        toast: 'bg-orange-50 border-l-4 border-orange-400 p-4 shadow-lg'
      };
    case ErrorSeverity.MEDIUM:
      return {
        container: 'bg-yellow-50 border border-yellow-200 rounded-md p-4',
        icon: 'text-yellow-400',
        title: 'text-yellow-800',
        message: 'text-yellow-700',
        badge: 'bg-yellow-100 text-yellow-800',
        toast: 'bg-yellow-50 border-l-4 border-yellow-400 p-4 shadow-lg'
      };
    case ErrorSeverity.LOW:
    default:
      return {
        container: 'bg-blue-50 border border-blue-200 rounded-md p-4',
        icon: 'text-blue-400',
        title: 'text-blue-800',
        message: 'text-blue-700',
        badge: 'bg-blue-100 text-blue-800',
        toast: 'bg-blue-50 border-l-4 border-blue-400 p-4 shadow-lg'
      };
  }
}

function getSeverityIcon(severity: ErrorSeverity, className: string = 'w-5 h-5') {
  switch (severity) {
    case ErrorSeverity.CRITICAL:
      return (
        <svg className={className} fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
      );
    case ErrorSeverity.HIGH:
      return (
        <svg className={className} fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      );
    case ErrorSeverity.MEDIUM:
      return (
        <svg className={className} fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
      );
    case ErrorSeverity.LOW:
    default:
      return (
        <svg className={className} fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
      );
  }
}

function getErrorTitle(errorType: ZKErrorType): string {
  switch (errorType) {
    case ZKErrorType.CIRCUIT_NOT_LOADED:
      return 'Security System Loading';
    case ZKErrorType.PROOF_GENERATION_FAILED:
      return 'Verification Failed';
    case ZKErrorType.PROOF_VERIFICATION_FAILED:
      return 'Access Verification Failed';
    case ZKErrorType.ACCESS_DENIED:
      return 'Access Denied';
    case ZKErrorType.NETWORK_ERROR:
      return 'Connection Issue';
    case ZKErrorType.WALLET_NOT_CONNECTED:
      return 'Wallet Required';
    case ZKErrorType.CONTRACT_NOT_INITIALIZED:
      return 'System Unavailable';
    default:
      return 'Security Error';
  }
}

function getErrorMessage(error: ZKError): string {
  // This would use the zkErrorHandler.getUserFriendlyMessage in a real implementation
  return error.message;
}

function getSeverityFromError(error: ZKError): ErrorSeverity {
  // This would use zkErrorHandler.getErrorSeverity in a real implementation
  switch (error.type) {
    case ZKErrorType.ACCESS_DENIED:
    case ZKErrorType.WALLET_NOT_CONNECTED:
      return ErrorSeverity.LOW;
    case ZKErrorType.NETWORK_ERROR:
    case ZKErrorType.PROOF_GENERATION_FAILED:
      return ErrorSeverity.MEDIUM;
    case ZKErrorType.CONTRACT_NOT_INITIALIZED:
    case ZKErrorType.ENCRYPTION_FAILED:
      return ErrorSeverity.HIGH;
    default:
      return ErrorSeverity.MEDIUM;
  }
}