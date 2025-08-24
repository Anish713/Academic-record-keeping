// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title IZKPManager
 * @dev Interface for ZK proof verification and access coordination
 */
interface IZKPManager {
    
    // Structs
    struct ZKProof {
        uint[2] a;
        uint[2][2] b;
        uint[2] c;
        uint[2] publicInputs;
        bytes32 proofHash;
        uint256 recordId;
        address prover;
        uint256 timestamp;
        bool isVerified;
        string proofType; // "ACCESS" or "SHARING"
    }

    struct ProofMetadata {
        uint256 recordId;
        address accessor;
        string action;
        uint256 timestamp;
        bool isValid;
    }

    // Events
    event ProofGenerated(bytes32 indexed proofHash, uint256 indexed recordId, address indexed accessor);
    event ProofVerified(bytes32 indexed proofHash, uint256 indexed recordId, address indexed accessor, bool result);
    event SharingTokenCreated(bytes32 indexed tokenHash, uint256 indexed recordId, address indexed sharedWith);
    event AccessCoordinated(uint256 indexed recordId, address indexed accessor, string action);
    event VerifierUpdated(string verifierType, address indexed oldVerifier, address indexed newVerifier);

    // Custom errors
    error InvalidProof(bytes32 proofHash);
    error ProofExpired(bytes32 proofHash, uint256 expiredAt);
    error ProofAlreadyExists(bytes32 proofHash);
    error UnauthorizedProofGeneration(uint256 recordId, address prover);
    error VerifierNotSet(string verifierType);
    error InvalidVerifier(address verifier);
    error ProofLimitExceeded(string limitType, uint256 limit);
    error InvalidProofType(string proofType);
    error AccessManagerNotSet();
    error KeyStorageNotSet();

    /**
     * @dev Set the AccessManager contract address
     * @param _accessManager Address of the AccessManager contract
     */
    function setAccessManager(address _accessManager) external;

    /**
     * @dev Set the KeyStorage contract address
     * @param _keyStorage Address of the KeyStorage contract
     */
    function setKeyStorage(address _keyStorage) external;

    /**
     * @dev Set the access verification contract
     * @param _accessVerifier Address of the access verifier contract
     */
    function setAccessVerifier(address _accessVerifier) external;

    /**
     * @dev Set the sharing verification contract
     * @param _sharingVerifier Address of the sharing verifier contract
     */
    function setSharingVerifier(address _sharingVerifier) external;

    /**
     * @dev Generate access proof for a record
     * @param recordId The ID of the record
     * @param accessor The address requesting access
     * @param a Proof component a
     * @param b Proof component b
     * @param c Proof component c
     * @param publicInputs Public inputs for the proof
     * @return proofHash The hash of the generated proof
     */
    function generateAccessProof(
        uint256 recordId,
        address accessor,
        uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c,
        uint[2] memory publicInputs
    ) external returns (bytes32);

    /**
     * @dev Verify access proof
     * @param proofHash The hash of the proof to verify
     * @param recordId The ID of the record
     * @param accessor The address requesting access
     * @return True if proof is valid
     */
    function verifyAccessProof(
        bytes32 proofHash,
        uint256 recordId,
        address accessor
    ) external returns (bool);

    /**
     * @dev View function to verify access proof without state changes
     * @param proofHash The hash of the proof to verify
     * @param recordId The ID of the record
     * @param accessor The address requesting access
     * @return True if proof is valid
     */
    function verifyAccessProofView(
        bytes32 proofHash,
        uint256 recordId,
        address accessor
    ) external view returns (bool);

    /**
     * @dev Create sharing token with ZK proof verification
     * @param recordId The ID of the record
     * @param sharedWith The address to share with
     * @param duration Duration of the sharing token
     * @param maxUsage Maximum number of times the token can be used
     * @param proofHash The hash of the proof authorizing sharing
     * @return tokenHash The hash of the created sharing token
     */
    function createSharingToken(
        uint256 recordId,
        address sharedWith,
        uint256 duration,
        uint256 maxUsage,
        bytes32 proofHash
    ) external returns (bytes32);

    /**
     * @dev Coordinate access with integrated permission validation
     * @param recordId The ID of the record
     * @param accessor The address requesting access
     * @param action The action being performed
     * @param proofHash Optional proof hash for ZK verification
     * @return True if access is granted
     */
    function coordinateAccess(
        uint256 recordId,
        address accessor,
        string calldata action,
        bytes32 proofHash
    ) external returns (bool);

    /**
     * @dev Get proof details
     * @param proofHash The hash of the proof
     * @return The ZK proof struct
     */
    function getProof(bytes32 proofHash) external view returns (ZKProof memory);

    /**
     * @dev Get proof metadata
     * @param proofHash The hash of the proof
     * @return The proof metadata struct
     */
    function getProofMetadata(bytes32 proofHash) external view returns (ProofMetadata memory);

    /**
     * @dev Get proofs for a record
     * @param recordId The ID of the record
     * @return Array of proof hashes
     */
    function getRecordProofs(uint256 recordId) external view returns (bytes32[] memory);

    /**
     * @dev Get proofs for a user
     * @param user The user address
     * @return Array of proof hashes
     */
    function getUserProofs(address user) external view returns (bytes32[] memory);

    /**
     * @dev Check if proof is valid and not expired
     * @param proofHash The hash of the proof
     * @return True if proof is valid
     */
    function isProofValid(bytes32 proofHash) external view returns (bool);

    /**
     * @dev Get proof statistics for a record
     * @param recordId The ID of the record
     * @return proofCount Total number of proofs for the record
     * @return verifiedCount Number of verified proofs
     */
    function getRecordProofStats(
        uint256 recordId
    ) external view returns (uint256 proofCount, uint256 verifiedCount);

    /**
     * @dev Get proof statistics for a user
     * @param user The user address
     * @return proofCount Total number of proofs for the user
     * @return verifiedCount Number of verified proofs
     */
    function getUserProofStats(
        address user
    ) external view returns (uint256 proofCount, uint256 verifiedCount);

    /**
     * @dev Get global proof statistics
     * @return totalGenerated Total proofs generated
     * @return totalVerified Total proofs verified
     * @return verificationRate Verification success rate (percentage * 100)
     */
    function getGlobalProofStats() external view returns (
        uint256 totalGenerated,
        uint256 totalVerified,
        uint256 verificationRate
    );

    /**
     * @dev Set proof validity duration (admin only)
     * @param duration New validity duration in seconds
     */
    function setProofValidityDuration(uint256 duration) external;

    /**
     * @dev Set maximum proofs per record (admin only)
     * @param maxProofs New maximum number of proofs per record
     */
    function setMaxProofsPerRecord(uint256 maxProofs) external;

    /**
     * @dev Set maximum proofs per user (admin only)
     * @param maxProofs New maximum number of proofs per user
     */
    function setMaxProofsPerUser(uint256 maxProofs) external;

    /**
     * @dev Invalidate a proof (admin only)
     * @param proofHash The hash of the proof to invalidate
     */
    function invalidateProof(bytes32 proofHash) external;

    /**
     * @dev Clean up expired proofs (admin only)
     * @param proofHashes Array of proof hashes to clean up
     */
    function cleanupExpiredProofs(bytes32[] calldata proofHashes) external;
}