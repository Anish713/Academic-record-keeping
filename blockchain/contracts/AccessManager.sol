// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/security/Pausable.sol";
import "./abstract/RoleManager.sol";

/**
 * @title AccessManager
 * @dev Manages access permissions, sharing tokens, and audit trails for academic records
 * @notice This contract handles access control logic with time-based permissions and comprehensive audit logging
 */
contract AccessManager is RoleManager, Pausable {
    
    // Enums
    enum AccessType {
        OWNER,      // Student owns the record
        SHARED,     // Record shared with user
        ADMIN,      // Admin access
        EMERGENCY   // Emergency admin access
    }

    // Events
    event AccessGranted(uint256 indexed recordId, address indexed accessor, AccessType accessType, uint256 expiresAt);
    event AccessRevoked(uint256 indexed recordId, address indexed accessor, address indexed revokedBy);
    event AccessLogged(uint256 indexed recordId, address indexed accessor, string action, uint256 timestamp);
    event SharingTokenCreated(bytes32 indexed tokenHash, uint256 indexed recordId, address indexed sharedWith, uint256 expiresAt);
    event SharingTokenRevoked(bytes32 indexed tokenHash, uint256 indexed recordId, address indexed revokedBy);
    event SharingTokenUsed(bytes32 indexed tokenHash, uint256 indexed recordId, address indexed user);

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

    // Storage
    mapping(uint256 => mapping(address => AccessPermission)) private recordPermissions;
    mapping(uint256 => address[]) private recordAccessors; // Track all accessors per record
    mapping(address => uint256[]) private userAccessibleRecords; // Track records accessible by user
    
    mapping(bytes32 => SharingToken) private sharingTokens;
    mapping(uint256 => bytes32[]) private recordSharingTokens; // Track tokens per record
    mapping(address => bytes32[]) private userSharingTokens; // Track tokens per user
    
    mapping(uint256 => AccessLog[]) private recordAccessLogs;
    mapping(address => AccessLog[]) private userAccessLogs;
    
    // Settings
    uint256 public defaultAccessDuration = 30 days;
    uint256 public maxAccessDuration = 365 days;
    uint256 public maxSharingTokenUsage = 10;
    
    // Access tracking
    mapping(uint256 => uint256) private recordAccessCount;
    mapping(address => uint256) private userTotalAccessCount;

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

    constructor() RoleManager() {}

    /**
     * @dev Check if an address has access to a record
     * @param recordId The ID of the record
     * @param accessor The address to check
     * @return True if accessor has valid access
     */
    function hasAccess(
        uint256 recordId,
        address accessor
    ) external view returns (bool) {
        return _hasValidAccess(recordId, accessor);
    }

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
    ) external whenNotPaused {
        if (accessor == address(0)) {
            revert InvalidAddress(accessor);
        }
        
        if (duration > maxAccessDuration) {
            revert InvalidDuration(duration, maxAccessDuration);
        }

        // Check authorization to grant access
        if (!_canGrantAccess(recordId, msg.sender, accessType)) {
            revert UnauthorizedAccess(recordId, msg.sender);
        }

        // Check if access already exists and is active
        AccessPermission storage permission = recordPermissions[recordId][accessor];
        if (permission.isActive && permission.expiresAt > block.timestamp) {
            revert AccessAlreadyGranted(recordId, accessor);
        }

        uint256 expiresAt = duration == 0 ? type(uint256).max : block.timestamp + duration;
        
        // Update or create permission
        permission.accessor = accessor;
        permission.recordId = recordId;
        permission.grantedAt = block.timestamp;
        permission.expiresAt = expiresAt;
        permission.isActive = true;
        permission.accessType = accessType;
        permission.grantedBy = msg.sender;

        // Add to tracking arrays if new accessor
        if (!_isAccessorTracked(recordId, accessor)) {
            recordAccessors[recordId].push(accessor);
            userAccessibleRecords[accessor].push(recordId);
        }

        emit AccessGranted(recordId, accessor, accessType, expiresAt);
    }

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
    ) external whenNotPaused {
        if (accessor == address(0)) {
            revert InvalidAddress(accessor);
        }

        // Check authorization to grant access
        if (!_canGrantAccess(recordId, msg.sender, accessType)) {
            revert UnauthorizedAccess(recordId, msg.sender);
        }

        // Check if access already exists and is active
        AccessPermission storage permission = recordPermissions[recordId][accessor];
        if (permission.isActive && permission.expiresAt > block.timestamp) {
            revert AccessAlreadyGranted(recordId, accessor);
        }

        uint256 expiresAt = block.timestamp + defaultAccessDuration;
        
        // Update or create permission
        permission.accessor = accessor;
        permission.recordId = recordId;
        permission.grantedAt = block.timestamp;
        permission.expiresAt = expiresAt;
        permission.isActive = true;
        permission.accessType = accessType;
        permission.grantedBy = msg.sender;

        // Add to tracking arrays if new accessor
        if (!_isAccessorTracked(recordId, accessor)) {
            recordAccessors[recordId].push(accessor);
            userAccessibleRecords[accessor].push(recordId);
        }

        emit AccessGranted(recordId, accessor, accessType, expiresAt);
    }

    /**
     * @dev Revoke access to a record
     * @param recordId The ID of the record
     * @param accessor The address to revoke access from
     */
    function revokeAccess(
        uint256 recordId,
        address accessor
    ) external whenNotPaused {
        AccessPermission storage permission = recordPermissions[recordId][accessor];
        
        if (!permission.isActive) {
            revert AccessNotFound(recordId, accessor);
        }

        // Check authorization to revoke access
        if (!_canRevokeAccess(recordId, accessor, msg.sender)) {
            revert UnauthorizedAccess(recordId, msg.sender);
        }

        permission.isActive = false;
        
        emit AccessRevoked(recordId, accessor, msg.sender);
    }

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
    ) external whenNotPaused returns (bytes32) {
        if (sharedWith == address(0)) {
            revert InvalidAddress(sharedWith);
        }
        
        if (duration > maxAccessDuration) {
            revert InvalidDuration(duration, maxAccessDuration);
        }

        if (maxUsage == 0 || maxUsage > maxSharingTokenUsage) {
            maxUsage = maxSharingTokenUsage;
        }

        // Check if caller has access to the record
        if (!_hasValidAccess(recordId, msg.sender)) {
            revert UnauthorizedAccess(recordId, msg.sender);
        }

        // Generate unique token hash
        bytes32 tokenHash = keccak256(
            abi.encodePacked(
                recordId,
                msg.sender,
                sharedWith,
                block.timestamp,
                block.prevrandao
            )
        );

        uint256 expiresAt = block.timestamp + duration;

        // Create sharing token
        SharingToken storage token = sharingTokens[tokenHash];
        token.tokenHash = tokenHash;
        token.recordId = recordId;
        token.sharedBy = msg.sender;
        token.sharedWith = sharedWith;
        token.createdAt = block.timestamp;
        token.expiresAt = expiresAt;
        token.isRevoked = false;
        token.isUsed = false;
        token.usageCount = 0;
        token.maxUsage = maxUsage;

        // Add to tracking arrays
        recordSharingTokens[recordId].push(tokenHash);
        userSharingTokens[sharedWith].push(tokenHash);

        emit SharingTokenCreated(tokenHash, recordId, sharedWith, expiresAt);
        
        return tokenHash;
    }

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
    ) external whenNotPaused returns (bool) {
        SharingToken storage token = sharingTokens[tokenHash];
        
        if (token.tokenHash == bytes32(0)) {
            revert InvalidSharingToken(tokenHash);
        }
        
        if (token.recordId != recordId) {
            revert InvalidSharingToken(tokenHash);
        }
        
        if (token.sharedWith != accessor) {
            revert UnauthorizedAccess(recordId, accessor);
        }
        
        if (token.isRevoked) {
            revert SharingTokenAlreadyRevoked(tokenHash);
        }
        
        if (block.timestamp > token.expiresAt) {
            revert SharingTokenExpired(tokenHash, token.expiresAt);
        }
        
        if (token.usageCount >= token.maxUsage) {
            revert SharingTokenUsageLimitExceeded(tokenHash, token.maxUsage);
        }

        // Mark token as used and increment usage count
        token.isUsed = true;
        token.usageCount++;

        emit SharingTokenUsed(tokenHash, recordId, accessor);
        
        return true;
    }

    /**
     * @dev Revoke a sharing token
     * @param tokenHash The hash of the sharing token to revoke
     */
    function revokeSharingToken(
        bytes32 tokenHash
    ) external whenNotPaused {
        SharingToken storage token = sharingTokens[tokenHash];
        
        if (token.tokenHash == bytes32(0)) {
            revert InvalidSharingToken(tokenHash);
        }

        // Check if caller can revoke this token
        if (token.sharedBy != msg.sender && 
            !hasRole(ADMIN_ROLE, msg.sender) && 
            msg.sender != SUPER_ADMIN) {
            revert UnauthorizedAccess(token.recordId, msg.sender);
        }

        token.isRevoked = true;
        
        emit SharingTokenRevoked(tokenHash, token.recordId, msg.sender);
    }

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
    ) external whenNotPaused {
        // Verify the caller has access or is authorized to log
        if (!_hasValidAccess(recordId, accessor) && 
            !hasRole(ADMIN_ROLE, msg.sender) && 
            msg.sender != SUPER_ADMIN) {
            revert UnauthorizedAccess(recordId, msg.sender);
        }

        AccessPermission storage permission = recordPermissions[recordId][accessor];
        AccessType accessType = permission.isActive ? permission.accessType : AccessType.ADMIN;

        AccessLog memory log = AccessLog({
            recordId: recordId,
            accessor: accessor,
            action: action,
            timestamp: block.timestamp,
            proofHash: proofHash,
            accessType: accessType
        });

        recordAccessLogs[recordId].push(log);
        userAccessLogs[accessor].push(log);
        
        // Update access counters
        recordAccessCount[recordId]++;
        userTotalAccessCount[accessor]++;

        emit AccessLogged(recordId, accessor, action, block.timestamp);
    }

    /**
     * @dev Get access history for a record
     * @param recordId The ID of the record
     * @return Array of access logs
     */
    function getAccessHistory(
        uint256 recordId
    ) external view returns (AccessLog[] memory) {
        // Check if caller has access to view history
        if (!_hasValidAccess(recordId, msg.sender) && 
            !hasRole(ADMIN_ROLE, msg.sender) && 
            msg.sender != SUPER_ADMIN) {
            revert UnauthorizedAccess(recordId, msg.sender);
        }

        return recordAccessLogs[recordId];
    }

    /**
     * @dev Get user's access history
     * @param user The user address
     * @return Array of access logs for the user
     */
    function getUserAccessHistory(
        address user
    ) external view returns (AccessLog[] memory) {
        // Only the user themselves, admin, or super admin can view user history
        if (msg.sender != user && 
            !hasRole(ADMIN_ROLE, msg.sender) && 
            msg.sender != SUPER_ADMIN) {
            revert UnauthorizedAccess(0, msg.sender);
        }

        return userAccessLogs[user];
    }

    /**
     * @dev Get access permission details
     * @param recordId The ID of the record
     * @param accessor The accessor address
     * @return The access permission struct
     */
    function getAccessPermission(
        uint256 recordId,
        address accessor
    ) external view returns (AccessPermission memory) {
        return recordPermissions[recordId][accessor];
    }

    /**
     * @dev Get all accessors for a record
     * @param recordId The ID of the record
     * @return Array of accessor addresses
     */
    function getRecordAccessors(
        uint256 recordId
    ) external view returns (address[] memory) {
        // Check if caller has access to view accessors
        if (!_hasValidAccess(recordId, msg.sender) && 
            !hasRole(ADMIN_ROLE, msg.sender) && 
            msg.sender != SUPER_ADMIN) {
            revert UnauthorizedAccess(recordId, msg.sender);
        }

        return recordAccessors[recordId];
    }

    /**
     * @dev Get records accessible by a user
     * @param user The user address
     * @return Array of record IDs
     */
    function getUserAccessibleRecords(
        address user
    ) external view returns (uint256[] memory) {
        // Only the user themselves, admin, or super admin can view accessible records
        if (msg.sender != user && 
            !hasRole(ADMIN_ROLE, msg.sender) && 
            msg.sender != SUPER_ADMIN) {
            revert UnauthorizedAccess(0, msg.sender);
        }

        return userAccessibleRecords[user];
    }

    /**
     * @dev Get sharing token details
     * @param tokenHash The hash of the sharing token
     * @return The sharing token struct
     */
    function getSharingToken(
        bytes32 tokenHash
    ) external view returns (SharingToken memory) {
        SharingToken memory token = sharingTokens[tokenHash];
        
        if (token.tokenHash == bytes32(0)) {
            revert InvalidSharingToken(tokenHash);
        }

        // Check if caller can view this token
        if (token.sharedBy != msg.sender && 
            token.sharedWith != msg.sender &&
            !hasRole(ADMIN_ROLE, msg.sender) && 
            msg.sender != SUPER_ADMIN) {
            revert UnauthorizedAccess(token.recordId, msg.sender);
        }

        return token;
    }

    /**
     * @dev Get sharing tokens for a record
     * @param recordId The ID of the record
     * @return Array of token hashes
     */
    function getRecordSharingTokens(
        uint256 recordId
    ) external view returns (bytes32[] memory) {
        // Check if caller has access to view tokens
        if (!_hasValidAccess(recordId, msg.sender) && 
            !hasRole(ADMIN_ROLE, msg.sender) && 
            msg.sender != SUPER_ADMIN) {
            revert UnauthorizedAccess(recordId, msg.sender);
        }

        return recordSharingTokens[recordId];
    }

    /**
     * @dev Get sharing tokens for a user
     * @param user The user address
     * @return Array of token hashes
     */
    function getUserSharingTokens(
        address user
    ) external view returns (bytes32[] memory) {
        // Only the user themselves, admin, or super admin can view user tokens
        if (msg.sender != user && 
            !hasRole(ADMIN_ROLE, msg.sender) && 
            msg.sender != SUPER_ADMIN) {
            revert UnauthorizedAccess(0, msg.sender);
        }

        return userSharingTokens[user];
    }

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
    ) {
        // Check if caller has access to view stats
        if (!_hasValidAccess(recordId, msg.sender) && 
            !hasRole(ADMIN_ROLE, msg.sender) && 
            msg.sender != SUPER_ADMIN) {
            revert UnauthorizedAccess(recordId, msg.sender);
        }

        return (
            recordAccessCount[recordId],
            recordAccessors[recordId].length,
            recordSharingTokens[recordId].length
        );
    }

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
    ) {
        // Only the user themselves, admin, or super admin can view user stats
        if (msg.sender != user && 
            !hasRole(ADMIN_ROLE, msg.sender) && 
            msg.sender != SUPER_ADMIN) {
            revert UnauthorizedAccess(0, msg.sender);
        }

        return (
            userTotalAccessCount[user],
            userAccessibleRecords[user].length,
            userSharingTokens[user].length
        );
    }

    // Admin functions

    /**
     * @dev Set default access duration (admin only)
     * @param duration New default duration in seconds
     */
    function setDefaultAccessDuration(
        uint256 duration
    ) external onlyAdminOrSuper {
        require(duration <= maxAccessDuration, "Duration exceeds maximum");
        defaultAccessDuration = duration;
    }

    /**
     * @dev Set maximum access duration (admin only)
     * @param duration New maximum duration in seconds
     */
    function setMaxAccessDuration(
        uint256 duration
    ) external onlyAdminOrSuper {
        require(duration >= defaultAccessDuration, "Duration below default");
        maxAccessDuration = duration;
    }

    /**
     * @dev Set maximum sharing token usage (admin only)
     * @param maxUsage New maximum usage count
     */
    function setMaxSharingTokenUsage(
        uint256 maxUsage
    ) external onlyAdminOrSuper {
        require(maxUsage > 0, "Max usage must be positive");
        maxSharingTokenUsage = maxUsage;
    }

    // Internal functions

    /**
     * @dev Check if an address has valid access to a record
     */
    function _hasValidAccess(
        uint256 recordId,
        address accessor
    ) internal view returns (bool) {
        // Admin and super admin always have access
        if (hasRole(ADMIN_ROLE, accessor) || accessor == SUPER_ADMIN) {
            return true;
        }

        AccessPermission storage permission = recordPermissions[recordId][accessor];
        
        return permission.isActive && 
               permission.expiresAt > block.timestamp;
    }

    /**
     * @dev Check if caller can grant access
     */
    function _canGrantAccess(
        uint256 recordId,
        address granter,
        AccessType accessType
    ) internal view returns (bool) {
        // Admin and super admin can always grant access
        if (hasRole(ADMIN_ROLE, granter) || granter == SUPER_ADMIN) {
            return true;
        }

        // Record owner can grant SHARED access
        if (accessType == AccessType.SHARED && _hasValidAccess(recordId, granter)) {
            return true;
        }

        return false;
    }

    /**
     * @dev Check if caller can revoke access
     */
    function _canRevokeAccess(
        uint256 recordId,
        address accessor,
        address revoker
    ) internal view returns (bool) {
        // Admin and super admin can always revoke access
        if (hasRole(ADMIN_ROLE, revoker) || revoker == SUPER_ADMIN) {
            return true;
        }

        AccessPermission storage permission = recordPermissions[recordId][accessor];
        
        // Granter can revoke access they granted
        if (permission.grantedBy == revoker) {
            return true;
        }

        // User can revoke their own access
        if (accessor == revoker) {
            return true;
        }

        return false;
    }

    /**
     * @dev Check if accessor is already tracked for a record
     */
    function _isAccessorTracked(
        uint256 recordId,
        address accessor
    ) internal view returns (bool) {
        address[] storage accessors = recordAccessors[recordId];
        for (uint256 i = 0; i < accessors.length; i++) {
            if (accessors[i] == accessor) {
                return true;
            }
        }
        return false;
    }

    // Pause controls
    function pause() external onlyAdminOrSuper {
        _pause();
    }

    function unpause() external onlyAdminOrSuper {
        _unpause();
    }
}