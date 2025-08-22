// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./verifier.sol";
import "./interfaces/IZKAccessControl.sol";
import "./abstract/RoleManager.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract ZKAccessControl is IZKAccessControl, RoleManager, Pausable {
    Groth16Verifier public immutable verifier;
    
    // Storage mappings
    mapping(uint256 => EncryptedRecord) private encryptedRecords;
    mapping(uint256 => mapping(address => AccessCredentials)) private userAccess;
    mapping(uint256 => address[]) private recordAccessList;
    mapping(address => uint256[]) private userRecords;
    
    // Constants for proof validation
    uint256 private constant PROOF_VALIDITY_PERIOD = 1 hours;
    
    modifier onlyRecordOwner(uint256 recordId) {
        require(
            encryptedRecords[recordId].owner == msg.sender ||
            hasRole(ADMIN_ROLE, msg.sender) ||
            msg.sender == SUPER_ADMIN,
            "Not record owner or admin"
        );
        _;
    }
    
    modifier recordExists(uint256 recordId) {
        require(encryptedRecords[recordId].exists, "Record does not exist");
        _;
    }

    constructor(address _verifier) {
        require(_verifier != address(0), "Invalid verifier address");
        verifier = Groth16Verifier(_verifier);
    }

    /**
     * @dev Verify ZK proof for record access
     * @param recordId The ID of the record to access
     * @param _pA Proof component A
     * @param _pB Proof component B  
     * @param _pC Proof component C
     * @param publicSignals Public signals for the proof
     * @return bool True if proof is valid
     */
    function verifyAccess(
        uint256 recordId,
        uint[2] memory _pA,
        uint[2][2] memory _pB,
        uint[2] memory _pC,
        uint[3] memory publicSignals
    ) public view override recordExists(recordId) returns (bool) {
        // Verify the proof using the verifier contract
        bool isValidProof = verifier.verifyProof(_pA, _pB, _pC, publicSignals);
        
        if (!isValidProof) {
            return false;
        }
        
        // Additional validation: check if the public signals match expected values
        // publicSignals[0] should be the record ID
        // publicSignals[1] should be the user address (as field element)
        // publicSignals[2] should be the merkle root
        
        if (publicSignals[0] != recordId) {
            return false;
        }
        
        if (publicSignals[2] != uint256(encryptedRecords[recordId].merkleRoot)) {
            return false;
        }
        
        return true;
    }

    /**
     * @dev Get encrypted IPFS hash after proof verification
     * @param recordId The ID of the record
     * @param _pA Proof component A
     * @param _pB Proof component B
     * @param _pC Proof component C  
     * @param publicSignals Public signals for the proof
     * @return bytes32 The encrypted IPFS hash
     */
    function getEncryptedHash(
        uint256 recordId,
        uint[2] memory _pA,
        uint[2][2] memory _pB,
        uint[2] memory _pC,
        uint[3] memory publicSignals
    ) external override returns (bytes32) {
        require(
            verifyAccess(recordId, _pA, _pB, _pC, publicSignals),
            "Invalid proof or access denied"
        );
        
        emit ProofVerified(recordId, msg.sender, true);
        return encryptedRecords[recordId].encryptedIPFSHash;
    }

    /**
     * @dev Store encrypted record data
     * @param recordId The ID of the record
     * @param encryptedIPFSHash Encrypted IPFS hash
     * @param encryptedMetadataHash Encrypted metadata hash
     * @param merkleRoot Merkle root for access control
     * @param owner Owner of the record
     */
    function storeEncryptedRecord(
        uint256 recordId,
        bytes32 encryptedIPFSHash,
        bytes32 encryptedMetadataHash,
        bytes32 merkleRoot,
        address owner
    ) external override whenNotPaused {
        require(
            hasRole(UNIVERSITY_ROLE, msg.sender) ||
            hasRole(ADMIN_ROLE, msg.sender) ||
            msg.sender == SUPER_ADMIN,
            "Not authorized to store records"
        );
        require(owner != address(0), "Invalid owner address");
        require(encryptedIPFSHash != bytes32(0), "Invalid IPFS hash");
        require(merkleRoot != bytes32(0), "Invalid merkle root");
        require(!encryptedRecords[recordId].exists, "Record already exists");

        encryptedRecords[recordId] = EncryptedRecord({
            encryptedIPFSHash: encryptedIPFSHash,
            encryptedMetadataHash: encryptedMetadataHash,
            merkleRoot: merkleRoot,
            timestamp: block.timestamp,
            owner: owner,
            exists: true
        });

        // Grant automatic access to the owner
        userAccess[recordId][owner] = AccessCredentials({
            userAddress: owner,
            accessKey: keccak256(abi.encodePacked(owner, recordId, block.timestamp)),
            validUntil: type(uint256).max, // Permanent access for owner
            isActive: true
        });

        recordAccessList[recordId].push(owner);
        userRecords[owner].push(recordId);

        emit EncryptedRecordStored(recordId, owner, merkleRoot);
        emit AccessGranted(recordId, owner, msg.sender);
    }

    /**
     * @dev Update merkle root for a record (when sharing/unsharing)
     * @param recordId The ID of the record
     * @param newMerkleRoot New merkle root
     */
    function updateMerkleRoot(
        uint256 recordId,
        bytes32 newMerkleRoot
    ) external override onlyRecordOwner(recordId) recordExists(recordId) whenNotPaused {
        require(newMerkleRoot != bytes32(0), "Invalid merkle root");
        
        encryptedRecords[recordId].merkleRoot = newMerkleRoot;
    }

    /**
     * @dev Grant access to a user for a specific record
     * @param recordId The ID of the record
     * @param user Address to grant access to
     * @param accessKey Access key for the user
     * @param validUntil Timestamp until which access is valid
     */
    function grantAccess(
        uint256 recordId,
        address user,
        bytes32 accessKey,
        uint256 validUntil
    ) external override onlyRecordOwner(recordId) recordExists(recordId) whenNotPaused {
        require(user != address(0), "Invalid user address");
        require(accessKey != bytes32(0), "Invalid access key");
        require(validUntil > block.timestamp, "Invalid validity period");

        // If user doesn't have access yet, add to access list
        if (!userAccess[recordId][user].isActive) {
            recordAccessList[recordId].push(user);
            userRecords[user].push(recordId);
        }

        userAccess[recordId][user] = AccessCredentials({
            userAddress: user,
            accessKey: accessKey,
            validUntil: validUntil,
            isActive: true
        });

        emit AccessGranted(recordId, user, msg.sender);
    }

    /**
     * @dev Revoke access for a user
     * @param recordId The ID of the record
     * @param user Address to revoke access from
     */
    function revokeAccess(
        uint256 recordId,
        address user
    ) external override onlyRecordOwner(recordId) recordExists(recordId) whenNotPaused {
        require(user != encryptedRecords[recordId].owner, "Cannot revoke owner access");
        require(userAccess[recordId][user].isActive, "User does not have access");

        userAccess[recordId][user].isActive = false;
        userAccess[recordId][user].validUntil = block.timestamp;

        // Remove from access list
        address[] storage accessList = recordAccessList[recordId];
        for (uint i = 0; i < accessList.length; i++) {
            if (accessList[i] == user) {
                accessList[i] = accessList[accessList.length - 1];
                accessList.pop();
                break;
            }
        }

        // Remove from user records
        uint256[] storage records = userRecords[user];
        for (uint i = 0; i < records.length; i++) {
            if (records[i] == recordId) {
                records[i] = records[records.length - 1];
                records.pop();
                break;
            }
        }

        emit AccessRevoked(recordId, user, msg.sender);
    }

    /**
     * @dev Check if user has active access to a record
     * @param recordId The ID of the record
     * @param user Address to check
     * @return bool True if user has access
     */
    function hasAccess(
        uint256 recordId,
        address user
    ) external view override recordExists(recordId) returns (bool) {
        AccessCredentials memory credentials = userAccess[recordId][user];
        return credentials.isActive && 
               credentials.validUntil > block.timestamp;
    }

    /**
     * @dev Get encrypted record data
     * @param recordId The ID of the record
     * @return EncryptedRecord The encrypted record data
     */
    function getEncryptedRecord(
        uint256 recordId
    ) external view override recordExists(recordId) returns (EncryptedRecord memory) {
        return encryptedRecords[recordId];
    }

    /**
     * @dev Get user's access key for a record
     * @param recordId The ID of the record
     * @param user Address of the user
     * @return bytes32 The access key
     */
    function getUserAccessKey(
        uint256 recordId,
        address user
    ) external view override recordExists(recordId) returns (bytes32) {
        require(
            msg.sender == user || 
            msg.sender == encryptedRecords[recordId].owner ||
            hasRole(ADMIN_ROLE, msg.sender) ||
            msg.sender == SUPER_ADMIN,
            "Not authorized to view access key"
        );
        
        AccessCredentials memory credentials = userAccess[recordId][user];
        require(credentials.isActive && credentials.validUntil > block.timestamp, "No active access");
        
        return credentials.accessKey;
    }

    /**
     * @dev Check if user is the owner of a record
     * @param recordId The ID of the record
     * @param user Address to check
     * @return bool True if user is the owner
     */
    function isRecordOwner(
        uint256 recordId,
        address user
    ) external view override recordExists(recordId) returns (bool) {
        return encryptedRecords[recordId].owner == user;
    }

    /**
     * @dev Get all records accessible by a user
     * @param user Address of the user
     * @return uint256[] Array of record IDs
     */
    function getUserAccessibleRecords(address user) external view returns (uint256[] memory) {
        return userRecords[user];
    }

    /**
     * @dev Get all users with access to a record
     * @param recordId The ID of the record
     * @return address[] Array of user addresses
     */
    function getRecordAccessList(uint256 recordId) external view recordExists(recordId) returns (address[] memory) {
        require(
            msg.sender == encryptedRecords[recordId].owner ||
            hasRole(ADMIN_ROLE, msg.sender) ||
            msg.sender == SUPER_ADMIN,
            "Not authorized to view access list"
        );
        
        return recordAccessList[recordId];
    }

    /**
     * @dev Emergency pause function
     */
    function pause() external {
        require(
            hasRole(ADMIN_ROLE, msg.sender) || msg.sender == SUPER_ADMIN,
            "Not authorized to pause"
        );
        _pause();
    }

    /**
     * @dev Emergency unpause function
     */
    function unpause() external {
        require(
            hasRole(ADMIN_ROLE, msg.sender) || msg.sender == SUPER_ADMIN,
            "Not authorized to unpause"
        );
        _unpause();
    }
}