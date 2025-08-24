// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../interfaces/IAcademicRecords.sol";
import "../interfaces/IZKPManager.sol";
import "../interfaces/IAccessManager.sol";
import "../interfaces/IKeyStorage.sol";
import "./RecordStorage.sol";

/**
 * @title SecureRecordOperations
 * @dev Library for secure record operations to reduce main contract size
 */
library SecureRecordOperations {
    using RecordStorage for RecordStorage.RecordData;

    event AccessLogged(uint256 indexed recordId, address indexed accessor, string action, bytes32 proofHash, uint256 timestamp);
    event SharingTokenCreated(uint256 indexed recordId, address indexed creator, address indexed sharedWith, bytes32 tokenHash, uint256 expiryTime);
    event AccessPermissionRevoked(uint256 indexed recordId, address indexed user, IAcademicRecords.AccessType accessType);
    event EmergencyAccess(uint256 indexed recordId, address indexed accessor, string reason, uint256 timestamp);
    event EncryptionKeyRotated(uint256 indexed recordId, address indexed rotatedBy, uint256 timestamp);

    /**
     * @dev Get secure record with access control
     */
    function getSecureRecordWithAccess(
        RecordStorage.RecordData storage recordData,
        uint256 recordId,
        bytes32 proofHash,
        address accessor,
        IZKPManager zkpManager,
        IAccessManager accessManager,
        address superAdmin
    ) external returns (IAcademicRecords.SecureRecord memory) {
        require(recordData.isRecordSecure(recordId) && address(zkpManager) != address(0) && address(accessManager) != address(0), "Invalid request");

        // Verify access
        bool hasZKAccess = zkpManager.verifyAccessProof(proofHash, recordId, accessor);
        bool hasTraditionalAccess = accessManager.hasAccess(recordId, accessor);
        require(hasZKAccess || hasTraditionalAccess, "Access denied");

        IAcademicRecords.SecureRecord memory record = recordData.getSecureRecord(recordId, accessor);

        // Limit data for non-full access users
        if (!_hasFullAccess(recordData, recordId, accessor, superAdmin)) {
            record.encryptedIPFSHash = "";
            record.encryptedMetadataHash = "";
        }

        emit AccessLogged(recordId, accessor, "VIEW", proofHash, block.timestamp);
        return record;
    }

    /**
     * @dev Get decrypted record data
     */
    function getDecryptedRecord(
        RecordStorage.RecordData storage recordData,
        uint256 recordId,
        bytes32 proofHash,
        address accessor,
        IZKPManager zkpManager,
        IAccessManager accessManager,
        address superAdmin
    ) external returns (bytes memory encryptedIPFSHash, bytes memory encryptedMetadataHash) {
        require(recordData.isRecordSecure(recordId) && address(zkpManager) != address(0) && address(accessManager) != address(0), "Invalid request");

        // Verify access permissions
        bool hasZKAccess = zkpManager.verifyAccessProof(proofHash, recordId, accessor);
        bool hasTraditionalAccess = accessManager.hasAccess(recordId, accessor);
        require(hasZKAccess || hasTraditionalAccess && _hasFullAccess(recordData, recordId, accessor, superAdmin), "Insufficient permissions");

        bytes memory encryptedIPFS = recordData.getEncryptedIPFSHash(recordId, accessor);
        bytes memory encryptedMetadata = recordData.getEncryptedMetadataHash(recordId, accessor);
        
        emit AccessLogged(recordId, accessor, "DOWNLOAD", proofHash, block.timestamp);
        return (encryptedIPFS, encryptedMetadata);
    }

    /**
     * @dev Share secure record
     */
    function shareSecureRecord(
        RecordStorage.RecordData storage recordData,
        uint256 recordId,
        address sharedWith,
        uint256 duration,
        uint256 maxUsage,
        address sharer
    ) external returns (bytes32) {
        require(recordData.isRecordSecure(recordId) && sharedWith != address(0), "Invalid input");

        (,,,address studentAddress,,,,,,) = recordData.getRecordMetadata(recordId);
        require(studentAddress == sharer, "Not your record");

        bytes32 sharingToken = recordData.createSharingToken(recordId, sharedWith, duration, maxUsage, sharer);
        
        uint256 expiryTime = duration > 0 ? block.timestamp + duration : 0;
        emit SharingTokenCreated(recordId, sharer, sharedWith, sharingToken, expiryTime);
        return sharingToken;
    }

    /**
     * @dev Revoke secure record access
     */
    function revokeSecureRecordAccess(
        RecordStorage.RecordData storage recordData,
        uint256 recordId,
        address user,
        address revoker,
        IAccessManager accessManager
    ) external {
        require(recordData.isRecordSecure(recordId) && address(accessManager) != address(0), "Invalid request");

        (,,,address studentAddress,,,,,address issuer,) = recordData.getRecordMetadata(recordId);
        require(studentAddress == revoker || issuer == revoker, "Not authorized");

        recordData.revokeSecureAccess(recordId, user, revoker);
        emit AccessPermissionRevoked(recordId, user, IAcademicRecords.AccessType.SHARED);
    }

    /**
     * @dev Emergency access to secure record
     */
    function emergencyAccess(
        RecordStorage.RecordData storage recordData,
        uint256 recordId,
        string calldata reason,
        address accessor,
        IAccessManager accessManager
    ) external returns (IAcademicRecords.SecureRecord memory) {
        require(recordData.isRecordSecure(recordId) && bytes(reason).length > 0, "Invalid request");

        if (address(accessManager) != address(0)) {
            accessManager.logAccess(recordId, accessor, "EMERGENCY_ACCESS", bytes32(0));
        }

        emit EmergencyAccess(recordId, accessor, reason, block.timestamp);
        return recordData.getSecureRecord(recordId, accessor);
    }

    /**
     * @dev Rotate record encryption key
     */
    function rotateRecordKey(
        RecordStorage.RecordData storage recordData,
        uint256 recordId,
        bytes calldata newEncryptedKey,
        address rotator,
        address superAdmin,
        IKeyStorage keyStorage
    ) external {
        require(recordData.isRecordSecure(recordId) && address(keyStorage) != address(0), "Invalid request");

        (,,,,,,,,address issuer,) = recordData.getRecordMetadata(recordId);
        require(issuer == rotator || rotator == superAdmin, "Not authorized");

        keyStorage.rotateKey(recordId, newEncryptedKey);
        emit EncryptionKeyRotated(recordId, rotator, block.timestamp);
    }

    /**
     * @dev Check if accessor has full access to record
     */
    function _hasFullAccess(
        RecordStorage.RecordData storage recordData,
        uint256 recordId,
        address accessor,
        address superAdmin
    ) internal view returns (bool) {
        if (!recordData.isRecordSecure(recordId)) return false;

        (,,,address studentAddress,,,,,address issuer,) = recordData.getRecordMetadata(recordId);

        return (studentAddress == accessor || 
                issuer == accessor || 
                accessor == superAdmin);
    }
}