// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./interfaces/IZKPInterfaces.sol";

/**
 * @title AccessManager
 * @dev Manages encrypted record access using ZKP verification
 */
contract AccessManager is IAccessManager, AccessControl, Pausable {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant UNIVERSITY_ROLE = keccak256("UNIVERSITY_ROLE");

    // Mapping from record ID to encrypted record data
    mapping(uint256 => EncryptedRecord) private encryptedRecords;
    
    // Mapping from record ID to user address to encrypted key
    mapping(uint256 => mapping(address => bytes)) private userEncryptedKeys;
    
    // Mapping from record ID to user address to access status
    mapping(uint256 => mapping(address => bool)) private recordAccess;
    
    // Track access grants and revocations for audit
    mapping(uint256 => address[]) private accessGrantHistory;
    mapping(uint256 => address[]) private accessRevokeHistory;

    // Reference to other contracts
    IZKPManager public zkpManager;
    IKeyStorage public keyStorage;
    address public academicRecordsContract;

    /**
     * @dev Constructor
     * @param _admin Admin address
     */
    constructor(address _admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);
    }

    /**
     * @dev Set contract addresses
     */
    function setContractAddresses(
        address _zkpManager,
        address _keyStorage,
        address _academicRecords
    ) external onlyRole(ADMIN_ROLE) {
        zkpManager = IZKPManager(_zkpManager);
        keyStorage = IKeyStorage(_keyStorage);
        academicRecordsContract = _academicRecords;
    }

    /**
     * @dev Store encrypted record data
     */
    function storeEncryptedRecord(
        uint256 recordId,
        bytes32 encryptedHashHash,
        bytes memory encryptedKey
    ) external override whenNotPaused returns (bool success) {
        require(encryptedHashHash != bytes32(0), "Invalid encrypted hash");
        require(encryptedKey.length > 0, "Invalid encrypted key");
        
        // Only allow universities or record owners to store encrypted records
        require(
            hasRole(UNIVERSITY_ROLE, msg.sender) || _isRecordOwner(recordId, msg.sender),
            "Not authorized to store encrypted record"
        );

        // Store encrypted record
        encryptedRecords[recordId] = EncryptedRecord({
            encryptedHashHash: encryptedHashHash,
            encryptedKey: encryptedKey,
            timestamp: block.timestamp,
            isActive: true
        });

        // Grant access to the record owner (encrypted with their key)
        userEncryptedKeys[recordId][msg.sender] = encryptedKey;
        recordAccess[recordId][msg.sender] = true;

        emit RecordEncrypted(recordId, msg.sender, encryptedHashHash, block.timestamp);
        return true;
    }

    /**
     * @dev Grant access to a record using ZKP
     */
    function grantAccess(
        uint256 recordId,
        address grantTo,
        bytes memory encryptedKeyForGrantee,
        IZKPManager.Proof memory proof,
        uint256[] memory publicSignals
    ) external override whenNotPaused returns (bool success) {
        require(encryptedRecords[recordId].isActive, "Record not found or inactive");
        require(grantTo != address(0), "Invalid grantee address");
        require(encryptedKeyForGrantee.length > 0, "Invalid encrypted key");
        require(keyStorage.hasKeys(grantTo), "Grantee has no encryption keys");

        // Verify ZKP proof of ownership or sharing rights
        uint256[] memory signals = new uint256[](4);
        signals[0] = uint256(uint160(publicSignals[0]));
        signals[1] = publicSignals[1];
        signals[2] = publicSignals[2];
        signals[3] = publicSignals[3];
        
        require(
            zkpManager.verifyProof(proof, signals, 1), // Using sharing circuit
            "Invalid ZK proof"
        );

        // Validate public signals
        address prover = address(uint160(publicSignals[0]));
        uint256 proofRecordId = publicSignals[1];
        
        require(prover == msg.sender, "Proof not for sender");
        require(proofRecordId == recordId, "Record ID mismatch");

        // Check if sender has access to grant
        require(recordAccess[recordId][msg.sender], "Sender has no access to grant");

        // Grant access
        userEncryptedKeys[recordId][grantTo] = encryptedKeyForGrantee;
        recordAccess[recordId][grantTo] = true;
        accessGrantHistory[recordId].push(grantTo);

        emit AccessGranted(recordId, grantTo, msg.sender, block.timestamp);
        return true;
    }

    /**
     * @dev Revoke access to a record
     */
    function revokeAccess(
        uint256 recordId,
        address revokeFrom,
        IZKPManager.Proof memory proof,
        uint256[] memory publicSignals
    ) external override whenNotPaused returns (bool success) {
        require(encryptedRecords[recordId].isActive, "Record not found or inactive");
        require(revokeFrom != address(0), "Invalid address to revoke from");
        require(recordAccess[recordId][revokeFrom], "User has no access to revoke");

        // Verify ZKP proof of ownership or admin rights
        uint256[] memory signals = new uint256[](4);
        signals[0] = uint256(uint160(publicSignals[0]));
        signals[1] = publicSignals[1];
        signals[2] = publicSignals[2];
        signals[3] = publicSignals[3];
        
        require(
            zkpManager.verifyProof(proof, signals, 1), // Using sharing circuit
            "Invalid ZK proof"
        );

        // Validate public signals
        address prover = address(uint160(publicSignals[0]));
        uint256 proofRecordId = publicSignals[1];
        
        require(prover == msg.sender, "Proof not for sender");
        require(proofRecordId == recordId, "Record ID mismatch");

        // Check if sender can revoke (record owner or admin)
        require(
            _isRecordOwner(recordId, msg.sender) || hasRole(ADMIN_ROLE, msg.sender),
            "Not authorized to revoke access"
        );

        // Revoke access
        delete userEncryptedKeys[recordId][revokeFrom];
        recordAccess[recordId][revokeFrom] = false;
        accessRevokeHistory[recordId].push(revokeFrom);

        emit AccessRevoked(recordId, revokeFrom, msg.sender, block.timestamp);
        return true;
    }

    /**
     * @dev Get encrypted record data
     */
    function getEncryptedRecord(uint256 recordId) external view override returns (EncryptedRecord memory encryptedRecord) {
        require(encryptedRecords[recordId].isActive, "Record not found or inactive");
        return encryptedRecords[recordId];
    }

    /**
     * @dev Get encryption key for a user's access to a record
     */
    function getEncryptedKey(
        uint256 recordId,
        address userAddress
    ) external view override returns (bytes memory encryptedKey) {
        require(encryptedRecords[recordId].isActive, "Record not found or inactive");
        require(recordAccess[recordId][userAddress], "User has no access to record");
        
        // Only allow user themselves or admin to get their encrypted key
        require(
            msg.sender == userAddress || hasRole(ADMIN_ROLE, msg.sender),
            "Not authorized to get encrypted key"
        );

        return userEncryptedKeys[recordId][userAddress];
    }

    /**
     * @dev Check if user has access to a record
     */
    function hasAccess(
        uint256 recordId,
        address userAddress
    ) external view override returns (bool userHasAccess) {
        return recordAccess[recordId][userAddress] && encryptedRecords[recordId].isActive;
    }

    /**
     * @dev Get access grant history for a record (admin only)
     */
    function getAccessGrantHistory(uint256 recordId) external view onlyRole(ADMIN_ROLE) returns (address[] memory) {
        return accessGrantHistory[recordId];
    }

    /**
     * @dev Get access revoke history for a record (admin only)
     */
    function getAccessRevokeHistory(uint256 recordId) external view onlyRole(ADMIN_ROLE) returns (address[] memory) {
        return accessRevokeHistory[recordId];
    }

    /**
     * @dev Batch grant access to multiple users
     */
    function batchGrantAccess(
        uint256 recordId,
        address[] memory grantToAddresses,
        bytes[] memory encryptedKeysForGrantees,
        IZKPManager.Proof memory proof,
        uint256[] memory publicSignals
    ) external whenNotPaused {
        require(
            grantToAddresses.length == encryptedKeysForGrantees.length,
            "Array length mismatch"
        );

        // Verify ZKP proof once for the batch
        uint256[] memory signals = new uint256[](4);
        signals[0] = uint256(uint160(publicSignals[0]));
        signals[1] = publicSignals[1];
        signals[2] = publicSignals[2];
        signals[3] = publicSignals[3];
        
        require(
            zkpManager.verifyProof(proof, signals, 1),
            "Invalid ZK proof"
        );

        address prover = address(uint160(publicSignals[0]));
        uint256 proofRecordId = publicSignals[1];
        
        require(prover == msg.sender, "Proof not for sender");
        require(proofRecordId == recordId, "Record ID mismatch");
        require(recordAccess[recordId][msg.sender], "Sender has no access to grant");

        // Grant access to each user
        for (uint256 i = 0; i < grantToAddresses.length; i++) {
            address grantTo = grantToAddresses[i];
            bytes memory encryptedKey = encryptedKeysForGrantees[i];

            if (grantTo != address(0) && 
                encryptedKey.length > 0 && 
                keyStorage.hasKeys(grantTo) &&
                !recordAccess[recordId][grantTo]) {
                
                userEncryptedKeys[recordId][grantTo] = encryptedKey;
                recordAccess[recordId][grantTo] = true;
                accessGrantHistory[recordId].push(grantTo);

                emit AccessGranted(recordId, grantTo, msg.sender, block.timestamp);
            }
        }
    }

    /**
     * @dev Get all users with access to a record (admin only)
     */
    function getRecordAccessList(uint256 recordId) external view onlyRole(ADMIN_ROLE) returns (address[] memory) {
        return accessGrantHistory[recordId];
    }

    /**
     * @dev Emergency revoke all access to a record (admin only)
     */
    function emergencyRevokeAllAccess(uint256 recordId) external onlyRole(ADMIN_ROLE) {
        encryptedRecords[recordId].isActive = false;
        
        // Note: Individual access mappings remain for audit purposes
        // but isActive = false prevents new access
    }

    /**
     * @dev Reactivate a record (admin only)
     */
    function reactivateRecord(uint256 recordId) external onlyRole(ADMIN_ROLE) {
        require(encryptedRecords[recordId].timestamp > 0, "Record never existed");
        encryptedRecords[recordId].isActive = true;
    }

    /**
     * @dev Update encrypted key for a user (admin only or self with proof)
     */
    function updateEncryptedKey(
        uint256 recordId,
        address userAddress,
        bytes memory newEncryptedKey,
        IZKPManager.Proof memory proof,
        uint256[] memory publicSignals
    ) external whenNotPaused {
        require(encryptedRecords[recordId].isActive, "Record not found or inactive");
        require(recordAccess[recordId][userAddress], "User has no access to record");
        require(newEncryptedKey.length > 0, "Invalid encrypted key");

        // If not admin, require ZKP proof
        if (!hasRole(ADMIN_ROLE, msg.sender)) {
            require(msg.sender == userAddress, "Not authorized");
            
            uint256[] memory signals = new uint256[](4);
            signals[0] = uint256(uint160(publicSignals[0]));
            signals[1] = publicSignals[1];
            signals[2] = publicSignals[2];
            signals[3] = publicSignals[3];
            
            require(
                zkpManager.verifyProof(proof, signals, 0), // Using access circuit
                "Invalid ZK proof"
            );
        }

        userEncryptedKeys[recordId][userAddress] = newEncryptedKey;
    }

    /**
     * @dev Internal function to check if user is record owner
     */
    function _isRecordOwner(uint256 recordId, address userAddress) internal view returns (bool) {
        // This would integrate with the AcademicRecords contract
        // For now, simplified implementation
        return true; // Would check actual ownership
    }

    /**
     * @dev Pause/unpause functionality
     */
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @dev Add university role
     */
    function addUniversity(address university) external onlyRole(ADMIN_ROLE) {
        _grantRole(UNIVERSITY_ROLE, university);
    }

    /**
     * @dev Remove university role
     */
    function removeUniversity(address university) external onlyRole(ADMIN_ROLE) {
        _revokeRole(UNIVERSITY_ROLE, university);
    }

    /**
     * @dev Get record access statistics (admin only)
     */
    function getRecordAccessStats(uint256 recordId) external view onlyRole(ADMIN_ROLE) returns (
        uint256 totalGranted,
        uint256 totalRevoked,
        bool isActive
    ) {
        return (
            accessGrantHistory[recordId].length,
            accessRevokeHistory[recordId].length,
            encryptedRecords[recordId].isActive
        );
    }
}