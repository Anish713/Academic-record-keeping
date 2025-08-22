/**
 * Fallback service for ZK functionality
 * Provides graceful degradation when ZK circuits fail to load or operate
 */

import { ZKError, ZKErrorType, SecureRecord, ZKAccessResult } from '../types/zkTypes';
import { Record } from '../types/records';
import { zkErrorHandler } from '../lib/zkErrorHandler';

export interface FallbackOptions {
    enableLegacyAccess: boolean;
    showLimitedInfo: boolean;
    allowOwnerAccess: boolean;
    logFallbackUsage: boolean;
}

export const DEFAULT_FALLBACK_OPTIONS: FallbackOptions = {
    enableLegacyAccess: true,
    showLimitedInfo: true,
    allowOwnerAccess: true,
    logFallbackUsage: true
};

/**
 * Fallback service that provides alternative functionality when ZK fails
 */
export class ZKFallbackService {
    private static instance: ZKFallbackService;
    private options: FallbackOptions;
    private fallbackUsageCount = 0;

    private constructor(options: Partial<FallbackOptions> = {}) {
        this.options = { ...DEFAULT_FALLBACK_OPTIONS, ...options };
    }

    static getInstance(options?: Partial<FallbackOptions>): ZKFallbackService {
        if (!ZKFallbackService.instance) {
            ZKFallbackService.instance = new ZKFallbackService(options);
        }
        return ZKFallbackService.instance;
    }

    /**
     * Provide fallback document access when ZK proof fails
     */
    async fallbackDocumentAccess(
        recordId: number,
        userAddress: string,
        record: Record,
        originalError: ZKError
    ): Promise<ZKAccessResult> {
        this.incrementFallbackUsage('document_access');

        // Log fallback usage
        if (this.options.logFallbackUsage) {
            console.warn(`Using fallback document access for record ${recordId}`, {
                error: originalError.type,
                userAddress,
                recordId
            });
        }

        try {
            // Check if user is the record owner
            if (this.options.allowOwnerAccess && this.isRecordOwner(record, userAddress)) {
                return {
                    hasAccess: true,
                    ipfsHash: record.ipfsHash, // Use legacy IPFS hash
                    error: undefined
                };
            }

            // Check if legacy access is enabled and user has basic permissions
            if (this.options.enableLegacyAccess) {
                const hasLegacyAccess = await this.checkLegacyAccess(recordId, userAddress, record);
                if (hasLegacyAccess) {
                    return {
                        hasAccess: true,
                        ipfsHash: record.ipfsHash,
                        error: 'Using legacy access due to ZK service unavailability'
                    };
                }
            }

            // Provide limited information if configured
            if (this.options.showLimitedInfo) {
                return {
                    hasAccess: false,
                    error: zkErrorHandler.getUserFriendlyMessage(originalError)
                };
            }

            // Complete access denial
            return {
                hasAccess: false,
                error: 'Document access unavailable due to security service issues'
            };
        } catch (fallbackError) {
            console.error('Fallback document access failed:', fallbackError);
            return {
                hasAccess: false,
                error: 'Unable to verify document access'
            };
        }
    }

    /**
     * Provide fallback record listing when ZK service fails
     */
    async fallbackRecordListing(
        userAddress: string,
        originalError: ZKError,
        allRecords: Record[]
    ): Promise<SecureRecord[]> {
        this.incrementFallbackUsage('record_listing');

        if (this.options.logFallbackUsage) {
            console.warn(`Using fallback record listing for user ${userAddress}`, {
                error: originalError.type,
                recordCount: allRecords.length
            });
        }

        try {
            const fallbackRecords: SecureRecord[] = [];

            for (const record of allRecords) {
                const secureRecord: SecureRecord = {
                    ...record,
                    hasZKAccess: false,
                    accessLevel: this.determineFallbackAccessLevel(record, userAddress),
                    documentUrl: undefined // Don't provide document URL in fallback mode
                };

                // Only include records where user has some level of access
                if (secureRecord.accessLevel !== 'none') {
                    // For owner records, provide document URL if legacy access is enabled
                    if (this.options.enableLegacyAccess && secureRecord.accessLevel === 'owner') {
                        secureRecord.documentUrl = this.getLegacyDocumentUrl(record.ipfsHash);
                    }

                    fallbackRecords.push(secureRecord);
                }
            }

            return fallbackRecords;
        } catch (fallbackError) {
            console.error('Fallback record listing failed:', fallbackError);
            return [];
        }
    }

    /**
     * Provide fallback sharing functionality
     */
    async fallbackRecordSharing(
        recordId: number,
        ownerAddress: string,
        targetAddress: string,
        originalError: ZKError
    ): Promise<{ success: boolean; error?: string }> {
        this.incrementFallbackUsage('record_sharing');

        if (this.options.logFallbackUsage) {
            console.warn(`Using fallback record sharing for record ${recordId}`, {
                error: originalError.type,
                ownerAddress,
                targetAddress
            });
        }

        // In fallback mode, we can't provide secure sharing
        // But we can log the intent and provide user feedback
        return {
            success: false,
            error: 'Secure sharing is temporarily unavailable. Please try again later.'
        };
    }

    /**
     * Provide fallback university access when ZK proof fails
     * Universities should have access to records they issued
     */
    async fallbackUniversityAccess(
        recordId: number,
        universityAddress: string,
        record: Record,
        originalError: ZKError
    ): Promise<ZKAccessResult> {
        this.incrementFallbackUsage('university_access');

        // Log fallback usage
        if (this.options.logFallbackUsage) {
            console.warn(`Using fallback university access for record ${recordId}`, {
                error: originalError.type,
                universityAddress,
                recordId
            });
        }

        try {
            // Validate inputs
            if (!record || !universityAddress) {
                return {
                    hasAccess: false,
                    error: 'Invalid record or university address'
                };
            }

            // Check if university is the issuer of this record
            if (record.universityAddress &&
                typeof universityAddress === 'string' &&
                record.universityAddress.toLowerCase() === universityAddress.toLowerCase()) {
                return {
                    hasAccess: true,
                    ipfsHash: record.ipfsHash, // Use legacy IPFS hash
                    error: 'Using legacy university access due to ZK service unavailability'
                };
            }

            // Universities should only have access to records they issued
            return {
                hasAccess: false,
                error: 'University does not have access to this record'
            };
        } catch (fallbackError) {
            console.error('Fallback university access failed:', fallbackError);
            return {
                hasAccess: false,
                error: 'Unable to verify university access'
            };
        }
    }

    /**
     * Provide fallback admin access when ZK proof fails
     * Admins should have oversight access to all records
     */
    async fallbackAdminAccess(
        recordId: number,
        adminAddress: string,
        record: Record,
        originalError: ZKError
    ): Promise<ZKAccessResult> {
        this.incrementFallbackUsage('admin_access');

        // Log fallback usage
        if (this.options.logFallbackUsage) {
            console.warn(`Using fallback admin access for record ${recordId}`, {
                error: originalError.type,
                adminAddress,
                recordId
            });
        }

        try {
            // Validate inputs
            if (!record || !adminAddress) {
                return {
                    hasAccess: false,
                    error: 'Invalid record or admin address'
                };
            }

            // Admins should have oversight access to all records for system management
            // This is a fallback mechanism when ZK proofs fail
            return {
                hasAccess: true,
                ipfsHash: record.ipfsHash, // Use legacy IPFS hash for admin oversight
                error: 'Using legacy admin oversight access due to ZK service unavailability'
            };
        } catch (fallbackError) {
            console.error('Fallback admin access failed:', fallbackError);
            return {
                hasAccess: false,
                error: 'Unable to verify admin access'
            };
        }
    }

    /**
     * Provide fallback proof generation (returns mock proof for testing)
     */
    async fallbackProofGeneration(
        recordId: number,
        userAddress: string,
        originalError: ZKError
    ): Promise<{ success: boolean; mockProof?: any; error?: string }> {
        this.incrementFallbackUsage('proof_generation');

        if (this.options.logFallbackUsage) {
            console.warn(`Using fallback proof generation for record ${recordId}`, {
                error: originalError.type,
                userAddress
            });
        }

        // In development/testing, we might want to return a mock proof
        if (process.env.NODE_ENV === 'development') {
            return {
                success: true,
                mockProof: {
                    pi_a: ['0', '0'],
                    pi_b: [['0', '0'], ['0', '0']],
                    pi_c: ['0', '0'],
                    publicSignals: [recordId.toString(), userAddress, '0']
                },
                error: 'Using mock proof in development mode'
            };
        }

        return {
            success: false,
            error: 'Proof generation is temporarily unavailable'
        };
    }

    /**
     * Check if user is the owner of a record
     */
    private isRecordOwner(record: Record, userAddress: string): boolean {
        return record.studentAddress.toLowerCase() === userAddress.toLowerCase();
    }

    /**
     * Check legacy access permissions
     */
    private async checkLegacyAccess(
        recordId: number,
        userAddress: string,
        record: Record
    ): Promise<boolean> {
        // Check if user is the owner
        if (this.isRecordOwner(record, userAddress)) {
            return true;
        }

        // Check if user is the issuing university
        if (record.universityAddress &&
            record.universityAddress.toLowerCase() === userAddress.toLowerCase()) {
            return true;
        }

        // In a real implementation, you might check a legacy sharing database
        // For now, we'll return false for non-owners
        return false;
    }

    /**
     * Determine fallback access level for a record
     */
    private determineFallbackAccessLevel(
        record: Record,
        userAddress: string
    ): SecureRecord['accessLevel'] {
        if (this.isRecordOwner(record, userAddress)) {
            return 'owner';
        }

        if (record.universityAddress &&
            record.universityAddress.toLowerCase() === userAddress.toLowerCase()) {
            return 'university';
        }

        // In a real implementation, you might check for admin roles
        // For now, we'll assume no access for other users
        return 'none';
    }

    /**
     * Get legacy document URL (without ZK protection)
     */
    private getLegacyDocumentUrl(ipfsHash: string): string {
        // This would use your IPFS gateway configuration
        return `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
    }

    /**
     * Increment fallback usage counter and log
     */
    private incrementFallbackUsage(operation: string): void {
        this.fallbackUsageCount++;

        if (this.options.logFallbackUsage) {
            console.info(`Fallback usage: ${operation} (total: ${this.fallbackUsageCount})`);
        }
    }

    /**
     * Get fallback usage statistics
     */
    getFallbackStats(): {
        totalUsage: number;
        isEnabled: boolean;
        options: FallbackOptions;
    } {
        return {
            totalUsage: this.fallbackUsageCount,
            isEnabled: this.options.enableLegacyAccess,
            options: this.options
        };
    }

    /**
     * Reset fallback usage counter
     */
    resetStats(): void {
        this.fallbackUsageCount = 0;
    }

    /**
     * Update fallback options
     */
    updateOptions(newOptions: Partial<FallbackOptions>): void {
        this.options = { ...this.options, ...newOptions };
    }

    /**
     * Check if fallback is available for a specific operation
     */
    isFallbackAvailable(operation: 'document_access' | 'record_listing' | 'record_sharing' | 'proof_generation'): boolean {
        switch (operation) {
            case 'document_access':
            case 'record_listing':
                return this.options.enableLegacyAccess || this.options.showLimitedInfo;
            case 'record_sharing':
                return false; // Secure sharing requires ZK
            case 'proof_generation':
                return process.env.NODE_ENV === 'development';
            default:
                return false;
        }
    }

    /**
     * Get fallback status message for users
     */
    getFallbackStatusMessage(): string {
        if (!this.options.enableLegacyAccess) {
            return 'Security features are temporarily unavailable. Some functionality may be limited.';
        }

        return 'Operating in compatibility mode. Some advanced security features are temporarily unavailable.';
    }
}

// Export singleton instance
export const zkFallbackService = ZKFallbackService.getInstance();