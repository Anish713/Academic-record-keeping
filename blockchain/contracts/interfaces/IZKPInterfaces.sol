// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IZKPManager
 * @dev Interface for Zero-Knowledge Proof management in academic records system
 */
interface IZKPManager {
    /**
     * @dev Struct representing a ZK proof
     */
    struct Proof {
        uint256[2] a;
        uint256[2][2] b;
        uint256[2] c;
    }

    /**
     * @dev Access types for record verification
     */
    enum AccessType {
        STUDENT_ACCESS,    // Student accessing their own record
        SHARED_ACCESS,     // Someone accessing a shared record
        UNIVERSITY_ACCESS, // University accessing their issued record
        VERIFIER_ACCESS    // Third party verifying a record
    }

    /**
     * @dev Events
     */
    event AccessVerified(
        address indexed userAddress,
        uint256 indexed recordId,
        AccessType accessType,
        uint256 timestamp
    );

    event RecordShared(
        uint256 indexed recordId,
        address indexed sharedBy,
        address indexed sharedWith,
        uint256 timestamp
    );

    event ProofVerified(
        address indexed verifier,
        uint256 indexed recordId,
        bool isValid,
        uint256 timestamp
    );

    /**
     * @dev Verify a ZK proof with public signals
     * @param proof The ZK proof
     * @param publicSignals Public signals for verification
     * @param circuitType Circuit type to verify against
     * @return isValid True if proof is valid
     */
    function verifyProof(
        Proof memory proof,
        uint256[] memory publicSignals,
        uint8 circuitType
    ) external view returns (bool isValid);

    /**
     * @dev Verify access to a record using ZK proof
     * @param recordId The ID of the record to access
     * @param accessType Type of access being requested
     * @param proof The ZK proof
     * @param publicSignals Public signals for verification
     * @return success True if access is granted
     */
    function verifyAccess(
        uint256 recordId,
        AccessType accessType,
        Proof memory proof,
        uint256[] memory publicSignals
    ) external returns (bool success);

    /**
     * @dev Share a record with another address using ZK proof
     * @param recordId The ID of the record to share
     * @param sharedWith Address to share the record with
     * @param proof The ZK proof proving ownership
     * @param publicSignals Public signals for verification
     * @return success True if sharing is successful
     */
    function shareRecordWithZKP(
        uint256 recordId,
        address sharedWith,
        Proof memory proof,
        uint256[] memory publicSignals
    ) external returns (bool success);

    /**
     * @dev Batch verify multiple access requests
     * @param recordIds Array of record IDs
     * @param accessTypes Array of access types
     * @param proofs Array of ZK proofs
     * @param publicSignalsArray Array of public signals
     * @return results Array of verification results
     */
    function batchVerifyAccess(
        uint256[] memory recordIds,
        AccessType[] memory accessTypes,
        Proof[] memory proofs,
        uint256[][] memory publicSignalsArray
    ) external returns (bool[] memory results);

    /**
     * @dev Check if an address has ZKP-verified access to a record
     * @param recordId The record ID
     * @param userAddress The user address
     * @return hasAccess True if user has verified access
     */
    function hasVerifiedAccess(
        uint256 recordId,
        address userAddress
    ) external view returns (bool hasAccess);

    /**
     * @dev Get verification key for a specific circuit
     * @param circuitType The type of circuit (0: access, 1: sharing)
     * @return verificationKey The verification key
     */
    function getVerificationKey(uint8 circuitType) external view returns (bytes memory verificationKey);
}

/**
 * @title IKeyStorage
 * @dev Interface for managing user encryption keys
 */
interface IKeyStorage {
    /**
     * @dev Events
     */
    event KeyGenerated(
        address indexed userAddress,
        string publicKey,
        uint256 timestamp
    );

    event KeyUpdated(
        address indexed userAddress,
        string newPublicKey,
        uint256 timestamp
    );

    /**
     * @dev Generate and store encryption keys for a user
     * @param publicKey The user's public encryption key
     * @param zkpIdentity The user's ZKP identity commitment
     * @return success True if key generation is successful
     */
    function generateKeys(
        string memory publicKey,
        bytes32 zkpIdentity
    ) external returns (bool success);

    /**
     * @dev Get user's public encryption key
     * @param userAddress The user's address
     * @return publicKey The user's public encryption key
     */
    function getPublicKey(address userAddress) external view returns (string memory publicKey);

    /**
     * @dev Get user's ZKP identity
     * @param userAddress The user's address
     * @return zkpIdentity The user's ZKP identity commitment
     */
    function getZKPIdentity(address userAddress) external view returns (bytes32 zkpIdentity);

    /**
     * @dev Check if user has registered keys
     * @param userAddress The user's address
     * @return hasKeys True if user has registered keys
     */
    function hasKeys(address userAddress) external view returns (bool hasKeys);

    /**
     * @dev Update user's public key
     * @param newPublicKey The new public encryption key
     * @param newZkpIdentity The new ZKP identity commitment
     * @return success True if update is successful
     */
    function updateKeys(
        string memory newPublicKey,
        bytes32 newZkpIdentity
    ) external returns (bool success);
}

/**
 * @title IAccessManager
 * @dev Interface for managing encrypted record access
 */
interface IAccessManager {
    /**
     * @dev Struct for encrypted record data
     */
    struct EncryptedRecord {
        bytes32 encryptedHashHash; // Hash of the encrypted IPFS hash
        bytes encryptedKey;        // Encryption key encrypted with user's public key
        uint256 timestamp;
        bool isActive;
    }

    /**
     * @dev Events
     */
    event RecordEncrypted(
        uint256 indexed recordId,
        address indexed owner,
        bytes32 encryptedHashHash,
        uint256 timestamp
    );

    event AccessGranted(
        uint256 indexed recordId,
        address indexed grantedTo,
        address indexed grantedBy,
        uint256 timestamp
    );

    event AccessRevoked(
        uint256 indexed recordId,
        address indexed revokedFrom,
        address indexed revokedBy,
        uint256 timestamp
    );

    /**
     * @dev Store encrypted record data
     * @param recordId The record ID
     * @param encryptedHashHash Hash of the encrypted IPFS hash
     * @param encryptedKey Encryption key encrypted with owner's public key
     * @return success True if storage is successful
     */
    function storeEncryptedRecord(
        uint256 recordId,
        bytes32 encryptedHashHash,
        bytes memory encryptedKey
    ) external returns (bool success);

    /**
     * @dev Grant access to a record using ZKP
     * @param recordId The record ID
     * @param grantTo Address to grant access to
     * @param encryptedKeyForGrantee Encryption key encrypted with grantee's public key
     * @param proof ZK proof of ownership
     * @param publicSignals Public signals for verification
     * @return success True if access grant is successful
     */
    function grantAccess(
        uint256 recordId,
        address grantTo,
        bytes memory encryptedKeyForGrantee,
        IZKPManager.Proof memory proof,
        uint256[] memory publicSignals
    ) external returns (bool success);

    /**
     * @dev Revoke access to a record
     * @param recordId The record ID
     * @param revokeFrom Address to revoke access from
     * @param proof ZK proof of ownership
     * @param publicSignals Public signals for verification
     * @return success True if access revocation is successful
     */
    function revokeAccess(
        uint256 recordId,
        address revokeFrom,
        IZKPManager.Proof memory proof,
        uint256[] memory publicSignals
    ) external returns (bool success);

    /**
     * @dev Get encrypted record data
     * @param recordId The record ID
     * @return encryptedRecord The encrypted record data
     */
    function getEncryptedRecord(uint256 recordId) external view returns (EncryptedRecord memory encryptedRecord);

    /**
     * @dev Get encryption key for a user's access to a record
     * @param recordId The record ID
     * @param userAddress The user's address
     * @return encryptedKey The encryption key encrypted with user's public key
     */
    function getEncryptedKey(
        uint256 recordId,
        address userAddress
    ) external view returns (bytes memory encryptedKey);

    /**
     * @dev Check if user has access to a record
     * @param recordId The record ID
     * @param userAddress The user's address
     * @return hasAccess True if user has access
     */
    function hasAccess(
        uint256 recordId,
        address userAddress
    ) external view returns (bool hasAccess);
}