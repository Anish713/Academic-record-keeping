// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IZKAccessControl {
    struct EncryptedRecord {
        bytes32 encryptedIPFSHash;
        bytes32 encryptedMetadataHash;
        bytes32 merkleRoot;
        uint256 timestamp;
        address owner;
        bool exists;
    }

    struct AccessCredentials {
        address userAddress;
        bytes32 accessKey;
        uint256 validUntil;
        bool isActive;
    }

    // Events
    event EncryptedRecordStored(
        uint256 indexed recordId,
        address indexed owner,
        bytes32 merkleRoot
    );
    
    event AccessGranted(
        uint256 indexed recordId,
        address indexed user,
        address indexed grantedBy
    );
    
    event AccessRevoked(
        uint256 indexed recordId,
        address indexed user,
        address indexed revokedBy
    );
    
    event ProofVerified(
        uint256 indexed recordId,
        address indexed user,
        bool success
    );

    // Core ZK functions
    function verifyAccess(
        uint256 recordId,
        uint[2] memory _pA,
        uint[2][2] memory _pB,
        uint[2] memory _pC,
        uint[3] memory publicSignals
    ) external view returns (bool);

    function getEncryptedHash(
        uint256 recordId,
        uint[2] memory _pA,
        uint[2][2] memory _pB,
        uint[2] memory _pC,
        uint[3] memory publicSignals
    ) external returns (bytes32);

    // Record management
    function storeEncryptedRecord(
        uint256 recordId,
        bytes32 encryptedIPFSHash,
        bytes32 encryptedMetadataHash,
        bytes32 merkleRoot,
        address owner
    ) external;

    function updateMerkleRoot(
        uint256 recordId,
        bytes32 newMerkleRoot
    ) external;

    // Access management
    function grantAccess(
        uint256 recordId,
        address user,
        bytes32 accessKey,
        uint256 validUntil
    ) external;

    function revokeAccess(
        uint256 recordId,
        address user
    ) external;

    function hasAccess(
        uint256 recordId,
        address user
    ) external view returns (bool);

    // View functions
    function getEncryptedRecord(
        uint256 recordId
    ) external view returns (EncryptedRecord memory);

    function getUserAccessKey(
        uint256 recordId,
        address user
    ) external view returns (bytes32);

    function isRecordOwner(
        uint256 recordId,
        address user
    ) external view returns (bool);
}