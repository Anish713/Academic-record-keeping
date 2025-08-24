// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title IKeyStorage
 * @dev Interface for secure storage and management of encryption keys
 */
interface IKeyStorage {
    
    // Events
    event KeyStored(uint256 indexed recordId, address indexed issuer, uint256 authorizedUsersCount);
    event KeyAccessed(uint256 indexed recordId, address indexed accessor);
    event KeyAccessUpdated(uint256 indexed recordId, address indexed updatedBy, uint256 newAuthorizedUsersCount);
    event KeyRotated(uint256 indexed recordId, address indexed rotatedBy);
    event EmergencyKeyAccess(uint256 indexed recordId, address indexed admin, string reason);

    // Custom errors
    error KeyNotFound(uint256 recordId);
    error UnauthorizedKeyAccess(uint256 recordId, address accessor);
    error KeyAlreadyExists(uint256 recordId);
    error InvalidKeyData();
    error TooManyAuthorizedUsers(uint256 count, uint256 max);
    error KeyRotationNotDue(uint256 recordId, uint256 nextRotationTime);
    error EmergencyAccessLimitExceeded(address admin, uint256 recordId);
    error InvalidAuthorizedUsers();

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
    ) external;

    /**
     * @dev Get encrypted key for authorized accessor
     * @param recordId The ID of the record
     * @param accessor The address requesting access
     * @return The encrypted key data
     */
    function getEncryptedKey(
        uint256 recordId,
        address accessor
    ) external view returns (bytes memory);

    /**
     * @dev Get encrypted key and log access (non-view function for tracking)
     * @param recordId The ID of the record
     * @return The encrypted key data
     */
    function getEncryptedKeyWithLogging(
        uint256 recordId
    ) external returns (bytes memory);

    /**
     * @dev Update authorized users for a key
     * @param recordId The ID of the record
     * @param newAuthorizedUsers New array of authorized users
     */
    function updateKeyAccess(
        uint256 recordId,
        address[] calldata newAuthorizedUsers
    ) external;

    /**
     * @dev Rotate encryption key for a record
     * @param recordId The ID of the record
     * @param newEncryptedKey The new encrypted key data
     */
    function rotateKey(
        uint256 recordId,
        bytes calldata newEncryptedKey
    ) external;

    /**
     * @dev Emergency key access for admins with reason logging
     * @param recordId The ID of the record
     * @param reason The reason for emergency access
     * @return The encrypted key data
     */
    function emergencyKeyAccess(
        uint256 recordId,
        string calldata reason
    ) external returns (bytes memory);

    /**
     * @dev Check if an address has access to a key
     * @param recordId The ID of the record
     * @param accessor The address to check
     * @return True if accessor has permission
     */
    function hasKeyAccess(
        uint256 recordId,
        address accessor
    ) external view returns (bool);

    /**
     * @dev Get authorized users for a record
     * @param recordId The ID of the record
     * @return Array of authorized user addresses
     */
    function getAuthorizedUsers(
        uint256 recordId
    ) external view returns (address[] memory);

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
    );

    /**
     * @dev Get user access count for a record
     * @param recordId The ID of the record
     * @param user The user address
     * @return The number of times user accessed this key
     */
    function getUserAccessCount(
        uint256 recordId,
        address user
    ) external view returns (uint256);

    /**
     * @dev Check if key exists
     * @param recordId The ID of the record
     * @return True if key exists
     */
    function keyExists(uint256 recordId) external view returns (bool);

    /**
     * @dev Set key rotation interval (admin only)
     * @param newInterval New rotation interval in seconds
     */
    function setKeyRotationInterval(uint256 newInterval) external;

    /**
     * @dev Check if key rotation is due
     * @param recordId The ID of the record
     * @return True if rotation is due
     */
    function isKeyRotationDue(uint256 recordId) external view returns (bool);
}