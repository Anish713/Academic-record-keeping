/**
 * Access Token Service for managing sharing tokens and time-limited access
 * 
 * This service handles the creation, validation, and management of access tokens
 * for secure record sharing with expiration and revocation capabilities.
 */

import { zkpService, ZKProof, RecordSharingInput } from './zkp';
import { encryptionService } from './encryption';

// Error types for access token operations
export enum AccessTokenErrorType {
    TOKEN_CREATION_FAILED = "TOKEN_CREATION_FAILED",
    TOKEN_VALIDATION_FAILED = "TOKEN_VALIDATION_FAILED",
    TOKEN_EXPIRED = "TOKEN_EXPIRED",
    TOKEN_REVOKED = "TOKEN_REVOKED",
    TOKEN_NOT_FOUND = "TOKEN_NOT_FOUND",
    INVALID_TOKEN_FORMAT = "INVALID_TOKEN_FORMAT",
    UNAUTHORIZED_ACCESS = "UNAUTHORIZED_ACCESS",
    AUDIT_LOG_FAILED = "AUDIT_LOG_FAILED"
}

export class AccessTokenError extends Error {
    constructor(
        public type: AccessTokenErrorType,
        public details: string,
        public tokenId?: string,
        public recordId?: number
    ) {
        super(`Access Token Error [${type}]: ${details}`);
        this.name = 'AccessTokenError';
    }
}

// Interfaces for access tokens
export interface AccessToken {
    tokenId: string;
    recordId: number;
    ownerAddress: string;
    sharedWithAddress: string;
    createdAt: number;
    expiresAt: number;
    permissions: AccessPermission[];
    zkProofHash: string;
    signature: string;
    isRevoked: boolean;
}

export interface AccessPermission {
    action: AccessAction;
    granted: boolean;
    expiresAt?: number;
}

export enum AccessAction {
    VIEW = "VIEW",
    DOWNLOAD = "DOWNLOAD",
    VERIFY = "VERIFY",
    SHARE = "SHARE"
}

export interface SharingTokenRequest {
    recordId: number;
    sharedWithAddress: string;
    duration: number; // in seconds
    permissions: AccessAction[];
    ownerAddress: string;
    shareSecret?: string;
}

export interface TokenValidationResult {
    isValid: boolean;
    token?: AccessToken;
    error?: string;
    remainingTime?: number;
}

export interface AuditLogEntry {
    tokenId: string;
    recordId: number;
    action: string;
    userAddress: string;
    timestamp: number;
    success: boolean;
    details?: string;
}

export class AccessTokenService {
    private static instance: AccessTokenService;
    private tokenStorage: Map<string, AccessToken> = new Map();
    private revokedTokens: Set<string> = new Set();
    private auditLog: AuditLogEntry[] = [];
    private readonly MAX_TOKEN_DURATION = 30 * 24 * 60 * 60; // 30 days in seconds
    private readonly DEFAULT_PERMISSIONS = [AccessAction.VIEW, AccessAction.VERIFY];

    private constructor() { }

    public static getInstance(): AccessTokenService {
        if (!AccessTokenService.instance) {
            AccessTokenService.instance = new AccessTokenService();
        }
        return AccessTokenService.instance;
    }

    /**
     * Create a new sharing token with ZK proof
     */
    public async createSharingToken(
        request: SharingTokenRequest
    ): Promise<AccessToken> {
        try {
            this.validateSharingRequest(request);

            const currentTime = Math.floor(Date.now() / 1000);
            const expiryTime = currentTime + Math.min(request.duration, this.MAX_TOKEN_DURATION);
            const tokenId = this.generateTokenId();

            // Generate ZK proof for sharing
            const sharingInput: RecordSharingInput = {
                recordId: request.recordId.toString(),
                ownerAddress: request.ownerAddress,
                sharedWithAddress: request.sharedWithAddress,
                expiryTime: expiryTime.toString(),
                currentTime: currentTime.toString(),
                shareSecret: request.shareSecret || this.generateShareSecret(),
                userAddress: request.ownerAddress
            };

            const zkProof = await zkpService.generateSharingProof(sharingInput);

            // Create access permissions
            const permissions: AccessPermission[] = request.permissions.map(action => ({
                action,
                granted: true,
                expiresAt: expiryTime
            }));

            // Create token signature
            const signature = await this.createTokenSignature(
                tokenId,
                request.recordId,
                request.ownerAddress,
                request.sharedWithAddress,
                expiryTime
            );

            const token: AccessToken = {
                tokenId,
                recordId: request.recordId,
                ownerAddress: request.ownerAddress,
                sharedWithAddress: request.sharedWithAddress,
                createdAt: currentTime,
                expiresAt: expiryTime,
                permissions,
                zkProofHash: zkProof.publicSignals[1] || '',
                signature,
                isRevoked: false
            };

            // Store token
            this.tokenStorage.set(tokenId, token);

            // Log token creation
            await this.logAuditEvent({
                tokenId,
                recordId: request.recordId,
                action: 'TOKEN_CREATED',
                userAddress: request.ownerAddress,
                timestamp: currentTime,
                success: true,
                details: `Token created for ${request.sharedWithAddress} with permissions: ${request.permissions.join(', ')}`
            });

            console.log(`✅ Sharing token created: ${tokenId}`);
            return token;
        } catch (error) {
            console.error('❌ Failed to create sharing token:', error);

            if (error instanceof AccessTokenError) {
                throw error;
            }

            throw new AccessTokenError(
                AccessTokenErrorType.TOKEN_CREATION_FAILED,
                `Token creation failed: ${error instanceof Error ? error.message : String(error)}`,
                undefined,
                request.recordId
            );
        }
    }

    /**
     * Validate an access token
     */
    public async validateAccessToken(
        tokenId: string,
        userAddress: string,
        action: AccessAction
    ): Promise<TokenValidationResult> {
        try {
            const token = this.tokenStorage.get(tokenId);

            if (!token) {
                await this.logAuditEvent({
                    tokenId,
                    recordId: 0,
                    action: 'TOKEN_VALIDATION',
                    userAddress,
                    timestamp: Math.floor(Date.now() / 1000),
                    success: false,
                    details: 'Token not found'
                });

                return {
                    isValid: false,
                    error: 'Token not found'
                };
            }

            // Check if token is revoked
            if (token.isRevoked || this.revokedTokens.has(tokenId)) {
                await this.logAuditEvent({
                    tokenId,
                    recordId: token.recordId,
                    action: 'TOKEN_VALIDATION',
                    userAddress,
                    timestamp: Math.floor(Date.now() / 1000),
                    success: false,
                    details: 'Token is revoked'
                });

                return {
                    isValid: false,
                    error: 'Token is revoked'
                };
            }

            const currentTime = Math.floor(Date.now() / 1000);

            // Check if token is expired
            if (token.expiresAt <= currentTime) {
                await this.logAuditEvent({
                    tokenId,
                    recordId: token.recordId,
                    action: 'TOKEN_VALIDATION',
                    userAddress,
                    timestamp: currentTime,
                    success: false,
                    details: 'Token is expired'
                });

                return {
                    isValid: false,
                    error: 'Token is expired'
                };
            }

            // Check if user is authorized
            if (token.sharedWithAddress.toLowerCase() !== userAddress.toLowerCase()) {
                await this.logAuditEvent({
                    tokenId,
                    recordId: token.recordId,
                    action: 'TOKEN_VALIDATION',
                    userAddress,
                    timestamp: currentTime,
                    success: false,
                    details: 'Unauthorized user'
                });

                return {
                    isValid: false,
                    error: 'Unauthorized user'
                };
            }

            // Check if action is permitted
            const permission = token.permissions.find(p => p.action === action);
            if (!permission || !permission.granted) {
                await this.logAuditEvent({
                    tokenId,
                    recordId: token.recordId,
                    action: 'TOKEN_VALIDATION',
                    userAddress,
                    timestamp: currentTime,
                    success: false,
                    details: `Action ${action} not permitted`
                });

                return {
                    isValid: false,
                    error: `Action ${action} not permitted`
                };
            }

            // Check permission-specific expiry
            if (permission.expiresAt && permission.expiresAt <= currentTime) {
                await this.logAuditEvent({
                    tokenId,
                    recordId: token.recordId,
                    action: 'TOKEN_VALIDATION',
                    userAddress,
                    timestamp: currentTime,
                    success: false,
                    details: `Permission for ${action} has expired`
                });

                return {
                    isValid: false,
                    error: `Permission for ${action} has expired`
                };
            }

            // Log successful validation
            await this.logAuditEvent({
                tokenId,
                recordId: token.recordId,
                action: 'TOKEN_VALIDATION',
                userAddress,
                timestamp: currentTime,
                success: true,
                details: `Token validated for action: ${action}`
            });

            return {
                isValid: true,
                token,
                remainingTime: token.expiresAt - currentTime
            };
        } catch (error) {
            console.error('❌ Failed to validate access token:', error);

            throw new AccessTokenError(
                AccessTokenErrorType.TOKEN_VALIDATION_FAILED,
                `Token validation failed: ${error instanceof Error ? error.message : String(error)}`,
                tokenId
            );
        }
    }

    /**
     * Revoke an access token
     */
    public async revokeAccessToken(
        tokenId: string,
        revokedBy: string,
        reason?: string
    ): Promise<boolean> {
        try {
            const token = this.tokenStorage.get(tokenId);

            if (!token) {
                throw new AccessTokenError(
                    AccessTokenErrorType.TOKEN_NOT_FOUND,
                    'Token not found',
                    tokenId
                );
            }

            // Check if user has permission to revoke (owner or admin)
            if (token.ownerAddress.toLowerCase() !== revokedBy.toLowerCase()) {
                throw new AccessTokenError(
                    AccessTokenErrorType.UNAUTHORIZED_ACCESS,
                    'Only token owner can revoke the token',
                    tokenId
                );
            }

            // Mark token as revoked
            token.isRevoked = true;
            this.revokedTokens.add(tokenId);
            this.tokenStorage.set(tokenId, token);

            // Log revocation
            await this.logAuditEvent({
                tokenId,
                recordId: token.recordId,
                action: 'TOKEN_REVOKED',
                userAddress: revokedBy,
                timestamp: Math.floor(Date.now() / 1000),
                success: true,
                details: reason || 'Token revoked by owner'
            });

            console.log(`✅ Token revoked: ${tokenId}`);
            return true;
        } catch (error) {
            console.error('❌ Failed to revoke access token:', error);

            if (error instanceof AccessTokenError) {
                throw error;
            }

            throw new AccessTokenError(
                AccessTokenErrorType.TOKEN_VALIDATION_FAILED,
                `Token revocation failed: ${error instanceof Error ? error.message : String(error)}`,
                tokenId
            );
        }
    }

    /**
     * Refresh an access token (extend expiry)
     */
    public async refreshAccessToken(
        tokenId: string,
        requestedBy: string,
        additionalDuration: number
    ): Promise<AccessToken> {
        try {
            const token = this.tokenStorage.get(tokenId);

            if (!token) {
                throw new AccessTokenError(
                    AccessTokenErrorType.TOKEN_NOT_FOUND,
                    'Token not found',
                    tokenId
                );
            }

            // Check if user has permission to refresh
            if (token.ownerAddress.toLowerCase() !== requestedBy.toLowerCase()) {
                throw new AccessTokenError(
                    AccessTokenErrorType.UNAUTHORIZED_ACCESS,
                    'Only token owner can refresh the token',
                    tokenId
                );
            }

            // Check if token is not revoked
            if (token.isRevoked || this.revokedTokens.has(tokenId)) {
                throw new AccessTokenError(
                    AccessTokenErrorType.TOKEN_REVOKED,
                    'Cannot refresh revoked token',
                    tokenId
                );
            }

            const currentTime = Math.floor(Date.now() / 1000);
            const newExpiryTime = Math.min(
                token.expiresAt + additionalDuration,
                currentTime + this.MAX_TOKEN_DURATION
            );

            // Update token expiry
            token.expiresAt = newExpiryTime;

            // Update permission expiries
            token.permissions.forEach(permission => {
                if (permission.expiresAt) {
                    permission.expiresAt = newExpiryTime;
                }
            });

            this.tokenStorage.set(tokenId, token);

            // Log refresh
            await this.logAuditEvent({
                tokenId,
                recordId: token.recordId,
                action: 'TOKEN_REFRESHED',
                userAddress: requestedBy,
                timestamp: currentTime,
                success: true,
                details: `Token expiry extended to ${new Date(newExpiryTime * 1000).toISOString()}`
            });

            console.log(`✅ Token refreshed: ${tokenId}`);
            return token;
        } catch (error) {
            console.error('❌ Failed to refresh access token:', error);

            if (error instanceof AccessTokenError) {
                throw error;
            }

            throw new AccessTokenError(
                AccessTokenErrorType.TOKEN_VALIDATION_FAILED,
                `Token refresh failed: ${error instanceof Error ? error.message : String(error)}`,
                tokenId
            );
        }
    }

    /**
     * Get tokens for a specific record
     */
    public getTokensForRecord(recordId: number, ownerAddress: string): AccessToken[] {
        const tokens: AccessToken[] = [];

        for (const [, token] of this.tokenStorage) {
            if (token.recordId === recordId &&
                token.ownerAddress.toLowerCase() === ownerAddress.toLowerCase()) {
                tokens.push(token);
            }
        }

        return tokens;
    }

    /**
     * Get tokens shared with a specific user
     */
    public getTokensForUser(userAddress: string): AccessToken[] {
        const tokens: AccessToken[] = [];

        for (const [, token] of this.tokenStorage) {
            if (token.sharedWithAddress.toLowerCase() === userAddress.toLowerCase() &&
                !token.isRevoked &&
                !this.revokedTokens.has(token.tokenId) &&
                token.expiresAt > Math.floor(Date.now() / 1000)) {
                tokens.push(token);
            }
        }

        return tokens;
    }

    /**
     * Get audit log for a specific record
     */
    public getAuditLog(recordId: number, limit: number = 100): AuditLogEntry[] {
        return this.auditLog
            .filter(entry => entry.recordId === recordId)
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit);
    }

    /**
     * Clean up expired tokens
     */
    public cleanupExpiredTokens(): number {
        const currentTime = Math.floor(Date.now() / 1000);
        let cleanedCount = 0;

        for (const [tokenId, token] of this.tokenStorage) {
            if (token.expiresAt <= currentTime) {
                this.tokenStorage.delete(tokenId);
                cleanedCount++;
            }
        }

        // Clean up old audit logs (keep last 1000 entries)
        if (this.auditLog.length > 1000) {
            this.auditLog = this.auditLog
                .sort((a, b) => b.timestamp - a.timestamp)
                .slice(0, 1000);
        }

        if (cleanedCount > 0) {
            console.log(`🧹 Cleaned up ${cleanedCount} expired tokens`);
        }

        return cleanedCount;
    }

    // Private helper methods

    private validateSharingRequest(request: SharingTokenRequest): void {
        if (!request.recordId || request.recordId <= 0) {
            throw new AccessTokenError(
                AccessTokenErrorType.TOKEN_CREATION_FAILED,
                'Invalid record ID'
            );
        }

        if (!this.isValidEthereumAddress(request.ownerAddress)) {
            throw new AccessTokenError(
                AccessTokenErrorType.TOKEN_CREATION_FAILED,
                'Invalid owner address'
            );
        }

        if (!this.isValidEthereumAddress(request.sharedWithAddress)) {
            throw new AccessTokenError(
                AccessTokenErrorType.TOKEN_CREATION_FAILED,
                'Invalid shared with address'
            );
        }

        if (request.duration <= 0 || request.duration > this.MAX_TOKEN_DURATION) {
            throw new AccessTokenError(
                AccessTokenErrorType.TOKEN_CREATION_FAILED,
                `Invalid duration. Must be between 1 and ${this.MAX_TOKEN_DURATION} seconds`
            );
        }

        if (!request.permissions || request.permissions.length === 0) {
            request.permissions = [...this.DEFAULT_PERMISSIONS];
        }
    }

    private generateTokenId(): string {
        const timestamp = Date.now().toString(36);
        const randomBytes = new Uint8Array(16);
        crypto.getRandomValues(randomBytes);
        const randomString = Array.from(randomBytes, byte => byte.toString(16).padStart(2, '0')).join('');
        return `token_${timestamp}_${randomString}`;
    }

    private generateShareSecret(): string {
        const randomBytes = new Uint8Array(32);
        crypto.getRandomValues(randomBytes);
        return Array.from(randomBytes, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    private async createTokenSignature(
        tokenId: string,
        recordId: number,
        ownerAddress: string,
        sharedWithAddress: string,
        expiryTime: number
    ): Promise<string> {
        const message = `${tokenId}:${recordId}:${ownerAddress}:${sharedWithAddress}:${expiryTime}`;
        const encoder = new TextEncoder();
        const data = encoder.encode(message);

        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = new Uint8Array(hashBuffer);
        return Array.from(hashArray, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    private async logAuditEvent(entry: AuditLogEntry): Promise<void> {
        try {
            this.auditLog.push(entry);

            // In a real implementation, you might want to persist this to a database
            // or send to an external audit service
            console.log(`📝 Audit log: ${entry.action} for token ${entry.tokenId} by ${entry.userAddress}`);
        } catch (error) {
            console.error('❌ Failed to log audit event:', error);
            // Don't throw here to avoid breaking the main operation
        }
    }

    private isValidEthereumAddress(address: string): boolean {
        return /^0x[a-fA-F0-9]{40}$/.test(address);
    }
}

// Export singleton instance
export const accessTokenService = AccessTokenService.getInstance();