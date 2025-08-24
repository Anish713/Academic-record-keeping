// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title IAccessManager
 * @dev Interface for access permission management and audit logging
 */
interface IAccessManager {
    
    // Enums
    enum AccessType {
        OWNER,      // Student owns the record
        SHARED,     // Record shared with user
        ADMIN,      // Admin access
        EMERGENCY   // Emergency admin access
    }

    // Structs
    struct AccessPermission {
        address accessor;
        uint256 recordId;
        uint256 grantedAt;
        uint256 expiresAt;
        bool isActive;
        AccessType accessType;
        address grantedBy;
    }

    struct SharingToken {
        bytes32 tokenHash;
        uint256 recordId;
        address sharedBy;
        address sharedWith;
        uint256 createdAt;
        uint256 expiresAt;
        bool isRevoked;
        bool isUsed;
        uint256 usageCount;
        uint256 maxUsage;
    }

    struct AccessLog {
        uint256 recordId;
        address accessor;
        string action;
        uint256 timestamp;
        bytes32 proofHash;
        AccessType accessType;
    }

    // Events
    event AccessGranted(uint256 indexed recordId, address indexed accessor, AccessType accessType, uint256 expiresAt);
    event AccessRevoked(uint256 indexed recordId, address indexed accessor, address indexed revokedBy);
    event AccessLogged(uint256 indexed recordId, address indexed accessor, string action, uint256 timestamp);
    event SharingTokenCreated(bytes32 indexed tokenHash, uint256 indexed recordId, address indexed sharedWith, uint256 expiresAt);
    event SharingTokenRevoked(bytes32 indexed tokenHash, uint256 indexed recordId, address indexed revokedBy);
    event SharingTokenUsed(bytes32 indexed tokenHash, uint256 indexed recordId, address indexed user);

    // Custom errors
    error RecordNotFound(uint256 recordId);
    error UnauthorizedAccess(uint256 recordId, address accessor);
    error AccessExpired(uint256 recordId, address accessor, uint256 expiredAt);
    error AccessAlreadyGranted(uint256 recordId, address accessor);
    error AccessNotFound(uint256 recordId, address accessor);
    error InvalidDuration(uint256 duration, uint256 maxDuration);
    error InvalidSharingToken(bytes32 tokenHash);
    error SharingTokenExpired(bytes32 tokenHash, uint256 expiredAt);
    error SharingTokenAlreadyRevoked(bytes32 tokenHash);
    error SharingTokenUsageLimitExceeded(bytes32 tokenHash, uint256 maxUsage);
    error InvalidAccessType(AccessType accessType);
    error InvalidAddress(address addr);

    /**
     * @dev Check if an address has access to a record
     * @param recordId The ID of the record
     * @param accessor The address to check
     * @return True if accessor has valid access
     */
    function hasAccess(uint256 recordId, address accessor) external view returns (bool);

    /**
     * @dev Grant access to a record
     * @param recordId The ID of the record
     * @param accessor The address to grant access to
     * @param duration Duration of access in seconds (0 for permanent)
     * @param accessType Type of access being granted
     */
    function grantAccess(
        uint256 recordId,
        address accessor,
        uint256 duration,
        AccessType accessType
    ) external;

    /**
     * @dev Grant access with default duration
     * @param recordId The ID of the record
     * @param accessor The address to grant access to
     * @param accessType Type of access being granted
     */
    function grantAccessWithDefaultDuration(
        uint256 recordId,
        address accessor,
        AccessType accessType
    ) external;

    /**
     * @dev Revoke access to a record
     * @param recordId The ID of the record
     * @param accessor The address to revoke access from
     */
    function revokeAccess(uint256 recordId, address accessor) external;

    /**
     * @dev Create a sharing token for temporary access
     * @param recordId The ID of the record
     * @param sharedWith The address to share with
     * @param duration Duration of the sharing token
     * @param maxUsage Maximum number of times the token can be used
     * @return tokenHash The hash of the created sharing token
     */
    function createSharingToken(
        uint256 recordId,
        address sharedWith,
        uint256 duration,
        uint256 maxUsage
    ) external returns (bytes32);

    /**
     * @dev Validate and use a sharing token
     * @param tokenHash The hash of the sharing token
     * @param recordId The ID of the record
     * @param accessor The address trying to access
     * @return True if token is valid and can be used
     */
    function validateSharingToken(
        bytes32 tokenHash,
        uint256 recordId,
        address accessor
    ) external returns (bool);

    /**
     * @dev Revoke a sharing token
     * @param tokenHash The hash of the sharing token to revoke
     */
    function revokeSharingToken(bytes32 tokenHash) external;

    /**
     * @dev Log access to a record
     * @param recordId The ID of the record
     * @param accessor The address accessing the record
     * @param action The action being performed
     * @param proofHash Optional proof hash for ZK verification
     */
    function logAccess(
        uint256 recordId,
        address accessor,
        string calldata action,
        bytes32 proofHash
    ) external;

    /**
     * @dev Get access history for a record
     * @param recordId The ID of the record
     * @return Array of access logs
     */
    function getAccessHistory(uint256 recordId) external view returns (AccessLog[] memory);

    /**
     * @dev Get user's access history
     * @param user The user address
     * @return Array of access logs for the user
     */
    function getUserAccessHistory(address user) external view returns (AccessLog[] memory);

    /**
     * @dev Get access permission details
     * @param recordId The ID of the record
     * @param accessor The accessor address
     * @return The access permission struct
     */
    function getAccessPermission(
        uint256 recordId,
        address accessor
    ) external view returns (AccessPermission memory);

    /**
     * @dev Get all accessors for a record
     * @param recordId The ID of the record
     * @return Array of accessor addresses
     */
    function getRecordAccessors(uint256 recordId) external view returns (address[] memory);

    /**
     * @dev Get records accessible by a user
     * @param user The user address
     * @return Array of record IDs
     */
    function getUserAccessibleRecords(address user) external view returns (uint256[] memory);

    /**
     * @dev Get sharing token details
     * @param tokenHash The hash of the sharing token
     * @return The sharing token struct
     */
    function getSharingToken(bytes32 tokenHash) external view returns (SharingToken memory);

    /**
     * @dev Get sharing tokens for a record
     * @param recordId The ID of the record
     * @return Array of token hashes
     */
    function getRecordSharingTokens(uint256 recordId) external view returns (bytes32[] memory);

    /**
     * @dev Get sharing tokens for a user
     * @param user The user address
     * @return Array of token hashes
     */
    function getUserSharingTokens(address user) external view returns (bytes32[] memory);

    /**
     * @dev Get access statistics for a record
     * @param recordId The ID of the record
     * @return accessCount Total number of accesses
     * @return accessorCount Number of unique accessors
     * @return tokenCount Number of sharing tokens created
     */
    function getRecordAccessStats(
        uint256 recordId
    ) external view returns (
        uint256 accessCount,
        uint256 accessorCount,
        uint256 tokenCount
    );

    /**
     * @dev Get user access statistics
     * @param user The user address
     * @return totalAccess Total number of accesses by user
     * @return accessibleRecords Number of records user can access
     * @return sharingTokenCount Number of sharing tokens user has
     */
    function getUserAccessStats(
        address user
    ) external view returns (
        uint256 totalAccess,
        uint256 accessibleRecords,
        uint256 sharingTokenCount
    );

    /**
     * @dev Set default access duration (admin only)
     * @param duration New default duration in seconds
     */
    function setDefaultAccessDuration(uint256 duration) external;

    /**
     * @dev Set maximum access duration (admin only)
     * @param duration New maximum duration in seconds
     */
    function setMaxAccessDuration(uint256 duration) external;

    /**
     * @dev Set maximum sharing token usage (admin only)
     * @param maxUsage New maximum usage count
     */
    function setMaxSharingTokenUsage(uint256 maxUsage) external;
}