// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/security/Pausable.sol";
import "./abstract/RoleManager.sol";

/**
 * @title KeyStorage
 * @dev Secure storage and management of encryption keys using role-based access control
 * @notice This contract manages encrypted keys for academic records with fine-grained access control
 */
contract KeyStorage is RoleManager, Pausable {
    
    // Events
    event KeyStored(uint256 indexed recordId, address indexed issuer, uint256 authorizedUsersCount);
    event KeyAccessed(uint256 indexed recordId, address indexed accessor);
    event KeyAccessUpdated(uint256 indexed recordId, address indexed updatedBy, uint256 newAuthorizedUsersCount);
    event KeyRotated(uint256 indexed recordId, address indexed rotatedBy);
    event EmergencyKeyAccess(uint256 indexed recordId, address indexed admin, string reason);

    // Structs
    struct EncryptedKeyData {
        bytes encryptedKey;           // The encrypted key data
        address issuer;               // University that created the record
        uint256 createdAt;            // Timestamp when key was stored
        uint256 lastRotated;          // Timestamp of last key rotation
        bool exists;                  // Flag to check if key exists
        mapping(address => bool) authorizedUsers;  // Mapping of authorized users
        address[] authorizedUsersList;             // Array to track authorized users
    }

    // Storage
    mapping(uint256 => EncryptedKeyData) private keyStorage;
    mapping(uint256 => mapping(address => uint256)) private userAccessCount; // Track access frequency
    
    // Access control settings
    uint256 public constant MAX_AUTHORIZED_USERS = 100;  // Prevent gas limit issues
    uint256 public keyRotationInterval = 365 days;       // Default rotation interval
    
    // Emergency access tracking
    mapping(uint256 => mapping(address => uint256)) private emergencyAccessCount;
    uint256 public constant MAX_EMERGENCY_ACCESS_PER_ADMIN = 10; // Per record limit

    // Custom errors
    error KeyNotFound(uint256 recordId);
    error UnauthorizedKeyAccess(uint256 recordId, address accessor);
    error KeyAlreadyExists(uint256 recordId);
    error InvalidKeyData();
    error TooManyAuthorizedUsers(uint256 count, uint256 max);
    error KeyRotationNotDue(uint256 recordId, uint256 nextRotationTime);
    error EmergencyAccessLimitExceeded(address admin, uint256 recordId);
    error InvalidAuthorizedUsers();

    constructor() RoleManager() {}

    /**
     * @dev Store encrypted key for a record with authorized users
     * @param recordId The ID of the record
     * @param encryptedKey The encrypted key data
     * @param authorizedUsers Array of addresses authorized to access this key
     */
    function storeEncryptedKey(
        uint256 recordId,
        bytes calldata encryptedKey,
        address[] calldata authorizedUsers
    ) external onlyRole(UNIVERSITY_ROLE) whenNotPaused {
        if (keyStorage[recordId].exists) {
            revert KeyAlreadyExists(recordId);
        }
        
        if (encryptedKey.length == 0) {
            revert InvalidKeyData();
        }
        
        if (authorizedUsers.length == 0 || authorizedUsers.length > MAX_AUTHORIZED_USERS) {
            revert TooManyAuthorizedUsers(authorizedUsers.length, MAX_AUTHORIZED_USERS);
        }

        // Validate authorized users (no zero addresses, no duplicates)
        _validateAuthorizedUsers(authorizedUsers);

        EncryptedKeyData storage keyData = keyStorage[recordId];
        keyData.encryptedKey = encryptedKey;
        keyData.issuer = msg.sender;
        keyData.createdAt = block.timestamp;
        keyData.lastRotated = block.timestamp;
        keyData.exists = true;

        // Set authorized users
        for (uint256 i = 0; i < authorizedUsers.length; i++) {
            keyData.authorizedUsers[authorizedUsers[i]] = true;
            keyData.authorizedUsersList.push(authorizedUsers[i]);
        }

        emit KeyStored(recordId, msg.sender, authorizedUsers.length);
    }

    /**
     * @dev Get encrypted key for authorized accessor
     * @param recordId The ID of the record
     * @param accessor The address requesting access
     * @return The encrypted key data
     */
    function getEncryptedKey(
        uint256 recordId,
        address accessor
    ) external view returns (bytes memory) {
        if (!keyStorage[recordId].exists) {
            revert KeyNotFound(recordId);
        }

        EncryptedKeyData storage keyData = keyStorage[recordId];
        
        // Check access permissions
        if (!_hasKeyAccess(recordId, accessor)) {
            revert UnauthorizedKeyAccess(recordId, accessor);
        }

        return keyData.encryptedKey;
    }

    /**
     * @dev Get encrypted key and log access (non-view function for tracking)
     * @param recordId The ID of the record
     * @return The encrypted key data
     */
    function getEncryptedKeyWithLogging(
        uint256 recordId
    ) external whenNotPaused returns (bytes memory) {
        if (!keyStorage[recordId].exists) {
            revert KeyNotFound(recordId);
        }

        if (!_hasKeyAccess(recordId, msg.sender)) {
            revert UnauthorizedKeyAccess(recordId, msg.sender);
        }

        // Log access
        userAccessCount[recordId][msg.sender]++;
        emit KeyAccessed(recordId, msg.sender);

        return keyStorage[recordId].encryptedKey;
    }

    /**
     * @dev Update authorized users for a key
     * @param recordId The ID of the record
     * @param newAuthorizedUsers New array of authorized users
     */
    function updateKeyAccess(
        uint256 recordId,
        address[] calldata newAuthorizedUsers
    ) external whenNotPaused {
        if (!keyStorage[recordId].exists) {
            revert KeyNotFound(recordId);
        }

        EncryptedKeyData storage keyData = keyStorage[recordId];
        
        // Only issuer or admin can update access
        if (msg.sender != keyData.issuer && !hasRole(ADMIN_ROLE, msg.sender) && msg.sender != SUPER_ADMIN) {
            revert UnauthorizedKeyAccess(recordId, msg.sender);
        }

        if (newAuthorizedUsers.length == 0 || newAuthorizedUsers.length > MAX_AUTHORIZED_USERS) {
            revert TooManyAuthorizedUsers(newAuthorizedUsers.length, MAX_AUTHORIZED_USERS);
        }

        // Validate new authorized users
        _validateAuthorizedUsers(newAuthorizedUsers);

        // Clear existing authorized users
        for (uint256 i = 0; i < keyData.authorizedUsersList.length; i++) {
            keyData.authorizedUsers[keyData.authorizedUsersList[i]] = false;
        }
        delete keyData.authorizedUsersList;

        // Set new authorized users
        for (uint256 i = 0; i < newAuthorizedUsers.length; i++) {
            keyData.authorizedUsers[newAuthorizedUsers[i]] = true;
            keyData.authorizedUsersList.push(newAuthorizedUsers[i]);
        }

        emit KeyAccessUpdated(recordId, msg.sender, newAuthorizedUsers.length);
    }

    /**
     * @dev Rotate encryption key for a record
     * @param recordId The ID of the record
     * @param newEncryptedKey The new encrypted key data
     */
    function rotateKey(
        uint256 recordId,
        bytes calldata newEncryptedKey
    ) external whenNotPaused {
        if (!keyStorage[recordId].exists) {
            revert KeyNotFound(recordId);
        }

        if (newEncryptedKey.length == 0) {
            revert InvalidKeyData();
        }

        EncryptedKeyData storage keyData = keyStorage[recordId];
        
        // Only issuer or admin can rotate keys
        if (msg.sender != keyData.issuer && !hasRole(ADMIN_ROLE, msg.sender) && msg.sender != SUPER_ADMIN) {
            revert UnauthorizedKeyAccess(recordId, msg.sender);
        }

        // Check if rotation is due (can be overridden by admin)
        if (!hasRole(ADMIN_ROLE, msg.sender) && msg.sender != SUPER_ADMIN) {
            uint256 nextRotationTime = keyData.lastRotated + keyRotationInterval;
            if (block.timestamp < nextRotationTime) {
                revert KeyRotationNotDue(recordId, nextRotationTime);
            }
        }

        keyData.encryptedKey = newEncryptedKey;
        keyData.lastRotated = block.timestamp;

        emit KeyRotated(recordId, msg.sender);
    }

    /**
     * @dev Emergency key access for admins with reason logging
     * @param recordId The ID of the record
     * @param reason The reason for emergency access
     * @return The encrypted key data
     */
    function emergencyKeyAccess(
        uint256 recordId,
        string calldata reason
    ) external onlyAdminOrSuper whenNotPaused returns (bytes memory) {
        if (!keyStorage[recordId].exists) {
            revert KeyNotFound(recordId);
        }

        if (bytes(reason).length == 0) {
            revert InvalidKeyData();
        }

        // Check emergency access limit
        if (emergencyAccessCount[recordId][msg.sender] >= MAX_EMERGENCY_ACCESS_PER_ADMIN) {
            revert EmergencyAccessLimitExceeded(msg.sender, recordId);
        }

        emergencyAccessCount[recordId][msg.sender]++;
        emit EmergencyKeyAccess(recordId, msg.sender, reason);

        return keyStorage[recordId].encryptedKey;
    }

    /**
     * @dev Check if an address has access to a key
     * @param recordId The ID of the record
     * @param accessor The address to check
     * @return True if accessor has permission
     */
    function hasKeyAccess(
        uint256 recordId,
        address accessor
    ) external view returns (bool) {
        if (!keyStorage[recordId].exists) {
            return false;
        }
        return _hasKeyAccess(recordId, accessor);
    }

    /**
     * @dev Get authorized users for a record
     * @param recordId The ID of the record
     * @return Array of authorized user addresses
     */
    function getAuthorizedUsers(
        uint256 recordId
    ) external view returns (address[] memory) {
        if (!keyStorage[recordId].exists) {
            revert KeyNotFound(recordId);
        }

        EncryptedKeyData storage keyData = keyStorage[recordId];
        
        // Only issuer, authorized users, or admin can view authorized users list
        if (msg.sender != keyData.issuer && 
            !keyData.authorizedUsers[msg.sender] && 
            !hasRole(ADMIN_ROLE, msg.sender) && 
            msg.sender != SUPER_ADMIN) {
            revert UnauthorizedKeyAccess(recordId, msg.sender);
        }

        return keyData.authorizedUsersList;
    }

    /**
     * @dev Get key metadata
     * @param recordId The ID of the record
     * @return issuer The issuer address
     * @return createdAt Creation timestamp
     * @return lastRotated Last rotation timestamp
     * @return authorizedCount Number of authorized users
     */
    function getKeyMetadata(
        uint256 recordId
    ) external view returns (
        address issuer,
        uint256 createdAt,
        uint256 lastRotated,
        uint256 authorizedCount
    ) {
        if (!keyStorage[recordId].exists) {
            revert KeyNotFound(recordId);
        }

        EncryptedKeyData storage keyData = keyStorage[recordId];
        return (
            keyData.issuer,
            keyData.createdAt,
            keyData.lastRotated,
            keyData.authorizedUsersList.length
        );
    }

    /**
     * @dev Get user access count for a record
     * @param recordId The ID of the record
     * @param user The user address
     * @return The number of times user accessed this key
     */
    function getUserAccessCount(
        uint256 recordId,
        address user
    ) external view returns (uint256) {
        return userAccessCount[recordId][user];
    }

    /**
     * @dev Check if key exists
     * @param recordId The ID of the record
     * @return True if key exists
     */
    function keyExists(uint256 recordId) external view returns (bool) {
        return keyStorage[recordId].exists;
    }

    /**
     * @dev Set key rotation interval (admin only)
     * @param newInterval New rotation interval in seconds
     */
    function setKeyRotationInterval(
        uint256 newInterval
    ) external onlyAdminOrSuper {
        require(newInterval >= 1 days, "Interval too short");
        require(newInterval <= 1095 days, "Interval too long"); // Max 3 years
        keyRotationInterval = newInterval;
    }

    /**
     * @dev Check if key rotation is due
     * @param recordId The ID of the record
     * @return True if rotation is due
     */
    function isKeyRotationDue(uint256 recordId) external view returns (bool) {
        if (!keyStorage[recordId].exists) {
            return false;
        }
        return block.timestamp >= keyStorage[recordId].lastRotated + keyRotationInterval;
    }

    // Internal functions

    /**
     * @dev Internal function to check key access permissions
     */
    function _hasKeyAccess(
        uint256 recordId,
        address accessor
    ) internal view returns (bool) {
        EncryptedKeyData storage keyData = keyStorage[recordId];
        
        // Issuer always has access
        if (accessor == keyData.issuer) {
            return true;
        }
        
        // Authorized users have access
        if (keyData.authorizedUsers[accessor]) {
            return true;
        }
        
        // Admin and super admin have access
        if (hasRole(ADMIN_ROLE, accessor) || accessor == SUPER_ADMIN) {
            return true;
        }
        
        return false;
    }

    /**
     * @dev Validate authorized users array
     */
    function _validateAuthorizedUsers(
        address[] calldata authorizedUsers
    ) internal pure {
        for (uint256 i = 0; i < authorizedUsers.length; i++) {
            if (authorizedUsers[i] == address(0)) {
                revert InvalidAuthorizedUsers();
            }
            
            // Check for duplicates
            for (uint256 j = i + 1; j < authorizedUsers.length; j++) {
                if (authorizedUsers[i] == authorizedUsers[j]) {
                    revert InvalidAuthorizedUsers();
                }
            }
        }
    }

    // Pause controls
    function pause() external onlyAdminOrSuper {
        _pause();
    }

    function unpause() external onlyAdminOrSuper {
        _unpause();
    }
}