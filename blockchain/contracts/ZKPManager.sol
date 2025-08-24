// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/security/Pausable.sol";
import "./abstract/RoleManager.sol";
import "./interfaces/IAccessManager.sol";
import "./interfaces/IKeyStorage.sol";

// Interfaces for verifier contracts
interface IVerifier {
    function verifyProof(
        uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c,
        uint[2] memory input
    ) external returns (bool);
    
    function verifyProofView(
        uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c,
        uint[2] memory input
    ) external view returns (bool);
}

/**
 * @title ZKPManager
 * @dev Central coordinator for ZK proof generation, verification, and access coordination
 * @notice This contract manages ZK proof verification and integrates with AccessManager for permission validation
 */
contract ZKPManager is RoleManager, Pausable {

    // Events
    event ProofGenerated(bytes32 indexed proofHash, uint256 indexed recordId, address indexed accessor);
    event ProofVerified(bytes32 indexed proofHash, uint256 indexed recordId, address indexed accessor, bool result);
    event SharingTokenCreated(bytes32 indexed tokenHash, uint256 indexed recordId, address indexed sharedWith);
    event AccessCoordinated(uint256 indexed recordId, address indexed accessor, string action);
    event VerifierUpdated(string verifierType, address indexed oldVerifier, address indexed newVerifier);

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

    // Storage
    IAccessManager public accessManager;
    IKeyStorage public keyStorage;
    IVerifier public accessVerifier;
    IVerifier public sharingVerifier;
    
    mapping(bytes32 => ZKProof) private proofs;
    mapping(uint256 => bytes32[]) private recordProofs; // Track proofs per record
    mapping(address => bytes32[]) private userProofs; // Track proofs per user
    mapping(bytes32 => ProofMetadata) private proofMetadata;
    
    // Proof validation settings
    uint256 public proofValidityDuration = 1 hours;
    uint256 public maxProofsPerRecord = 1000;
    uint256 public maxProofsPerUser = 1000;
    
    // Statistics
    mapping(uint256 => uint256) private recordProofCount;
    mapping(address => uint256) private userProofCount;
    uint256 public totalProofsGenerated;
    uint256 public totalProofsVerified;

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

    constructor() RoleManager() {}

    /**
     * @dev Set the AccessManager contract address
     * @param _accessManager Address of the AccessManager contract
     */
    function setAccessManager(address _accessManager) external onlyAdminOrSuper {
        if (_accessManager == address(0)) {
            revert InvalidVerifier(_accessManager);
        }
        accessManager = IAccessManager(_accessManager);
    }

    /**
     * @dev Set the KeyStorage contract address
     * @param _keyStorage Address of the KeyStorage contract
     */
    function setKeyStorage(address _keyStorage) external onlyAdminOrSuper {
        if (_keyStorage == address(0)) {
            revert InvalidVerifier(_keyStorage);
        }
        keyStorage = IKeyStorage(_keyStorage);
    }

    /**
     * @dev Set the access verification contract
     * @param _accessVerifier Address of the access verifier contract
     */
    function setAccessVerifier(address _accessVerifier) external onlyAdminOrSuper {
        if (_accessVerifier == address(0)) {
            revert InvalidVerifier(_accessVerifier);
        }
        
        address oldVerifier = address(accessVerifier);
        accessVerifier = IVerifier(_accessVerifier);
        
        emit VerifierUpdated("ACCESS", oldVerifier, _accessVerifier);
    }

    /**
     * @dev Set the sharing verification contract
     * @param _sharingVerifier Address of the sharing verifier contract
     */
    function setSharingVerifier(address _sharingVerifier) external onlyAdminOrSuper {
        if (_sharingVerifier == address(0)) {
            revert InvalidVerifier(_sharingVerifier);
        }
        
        address oldVerifier = address(sharingVerifier);
        sharingVerifier = IVerifier(_sharingVerifier);
        
        emit VerifierUpdated("SHARING", oldVerifier, _sharingVerifier);
    }

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
    ) external whenNotPaused returns (bytes32) {
        if (address(accessManager) == address(0)) {
            revert AccessManagerNotSet();
        }

        // Check if caller is authorized to generate proof for this accessor
        if (msg.sender != accessor && 
            !hasRole(ADMIN_ROLE, msg.sender) && 
            msg.sender != SUPER_ADMIN) {
            revert UnauthorizedProofGeneration(recordId, msg.sender);
        }

        // Check proof limits
        if (recordProofCount[recordId] >= maxProofsPerRecord) {
            revert ProofLimitExceeded("RECORD", maxProofsPerRecord);
        }
        
        if (userProofCount[accessor] >= maxProofsPerUser) {
            revert ProofLimitExceeded("USER", maxProofsPerUser);
        }

        // Generate proof hash
        bytes32 proofHash = keccak256(
            abi.encodePacked(
                recordId,
                accessor,
                a[0], a[1],
                b[0][0], b[0][1], b[1][0], b[1][1],
                c[0], c[1],
                publicInputs[0], publicInputs[1],
                block.timestamp,
                block.prevrandao,
                msg.sender,
                "ACCESS"
            )
        );

        // Check if proof already exists
        if (proofs[proofHash].timestamp != 0) {
            revert ProofAlreadyExists(proofHash);
        }

        // Store proof
        ZKProof storage proof = proofs[proofHash];
        proof.a = a;
        proof.b = b;
        proof.c = c;
        proof.publicInputs = publicInputs;
        proof.proofHash = proofHash;
        proof.recordId = recordId;
        proof.prover = accessor;
        proof.timestamp = block.timestamp;
        proof.isVerified = false;
        proof.proofType = "ACCESS";

        // Store metadata
        proofMetadata[proofHash] = ProofMetadata({
            recordId: recordId,
            accessor: accessor,
            action: "ACCESS_REQUEST",
            timestamp: block.timestamp,
            isValid: true
        });

        // Update tracking
        recordProofs[recordId].push(proofHash);
        userProofs[accessor].push(proofHash);
        recordProofCount[recordId]++;
        userProofCount[accessor]++;
        totalProofsGenerated++;

        emit ProofGenerated(proofHash, recordId, accessor);
        
        return proofHash;
    }

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
    ) external whenNotPaused returns (bool) {
        if (address(accessVerifier) == address(0)) {
            revert VerifierNotSet("ACCESS");
        }

        ZKProof storage proof = proofs[proofHash];
        
        if (proof.timestamp == 0) {
            revert InvalidProof(proofHash);
        }

        if (proof.recordId != recordId || proof.prover != accessor) {
            revert InvalidProof(proofHash);
        }

        if (block.timestamp > proof.timestamp + proofValidityDuration) {
            revert ProofExpired(proofHash, proof.timestamp + proofValidityDuration);
        }

        // Verify the ZK proof
        bool isValid = accessVerifier.verifyProof(
            proof.a,
            proof.b,
            proof.c,
            proof.publicInputs
        );

        proof.isVerified = isValid;
        
        if (isValid) {
            totalProofsVerified++;
        }

        emit ProofVerified(proofHash, recordId, accessor, isValid);
        
        return isValid;
    }

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
    ) external view returns (bool) {
        if (address(accessVerifier) == address(0)) {
            return false;
        }

        ZKProof storage proof = proofs[proofHash];
        
        if (proof.timestamp == 0) {
            return false;
        }

        if (proof.recordId != recordId || proof.prover != accessor) {
            return false;
        }

        if (block.timestamp > proof.timestamp + proofValidityDuration) {
            return false;
        }

        // Verify the ZK proof (view function)
        return accessVerifier.verifyProofView(
            proof.a,
            proof.b,
            proof.c,
            proof.publicInputs
        );
    }

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
    ) external whenNotPaused returns (bytes32) {
        if (address(accessManager) == address(0)) {
            revert AccessManagerNotSet();
        }

        // Verify the sharing proof if provided
        if (proofHash != bytes32(0)) {
            ZKProof storage proof = proofs[proofHash];
            
            if (proof.timestamp == 0) {
                revert InvalidProof(proofHash);
            }

            if (proof.recordId != recordId || proof.prover != msg.sender) {
                revert InvalidProof(proofHash);
            }

            if (block.timestamp > proof.timestamp + proofValidityDuration) {
                revert ProofExpired(proofHash, proof.timestamp + proofValidityDuration);
            }

            if (keccak256(bytes(proof.proofType)) != keccak256(bytes("SHARING"))) {
                revert InvalidProofType(proof.proofType);
            }
        }

        // Create sharing token through AccessManager
        bytes32 tokenHash = accessManager.createSharingToken(
            recordId,
            sharedWith,
            duration,
            maxUsage
        );

        emit SharingTokenCreated(tokenHash, recordId, sharedWith);
        
        return tokenHash;
    }

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
    ) external whenNotPaused returns (bool) {
        if (address(accessManager) == address(0)) {
            revert AccessManagerNotSet();
        }

        bool hasAccess = false;

        // Check traditional access permissions first
        if (accessManager.hasAccess(recordId, accessor)) {
            hasAccess = true;
        }

        // If no traditional access, try ZK proof verification
        if (!hasAccess && proofHash != bytes32(0)) {
            hasAccess = this.verifyAccessProof(proofHash, recordId, accessor);
        }

        if (hasAccess) {
            emit AccessCoordinated(recordId, accessor, action);
        }

        return hasAccess;
    }

    /**
     * @dev Get proof details
     * @param proofHash The hash of the proof
     * @return The ZK proof struct
     */
    function getProof(bytes32 proofHash) external view returns (ZKProof memory) {
        ZKProof storage proof = proofs[proofHash];
        
        if (proof.timestamp == 0) {
            revert InvalidProof(proofHash);
        }

        return proof;
    }

    /**
     * @dev Get proof metadata
     * @param proofHash The hash of the proof
     * @return The proof metadata struct
     */
    function getProofMetadata(bytes32 proofHash) external view returns (ProofMetadata memory) {
        ProofMetadata storage metadata = proofMetadata[proofHash];
        
        if (metadata.timestamp == 0) {
            revert InvalidProof(proofHash);
        }

        return metadata;
    }

    /**
     * @dev Get proofs for a record
     * @param recordId The ID of the record
     * @return Array of proof hashes
     */
    function getRecordProofs(uint256 recordId) external view returns (bytes32[] memory) {
        return recordProofs[recordId];
    }

    /**
     * @dev Get proofs for a user
     * @param user The user address
     * @return Array of proof hashes
     */
    function getUserProofs(address user) external view returns (bytes32[] memory) {
        return userProofs[user];
    }

    /**
     * @dev Check if proof is valid and not expired
     * @param proofHash The hash of the proof
     * @return True if proof is valid
     */
    function isProofValid(bytes32 proofHash) external view returns (bool) {
        ZKProof storage proof = proofs[proofHash];
        
        if (proof.timestamp == 0) {
            return false;
        }

        if (block.timestamp > proof.timestamp + proofValidityDuration) {
            return false;
        }

        return true;
    }

    /**
     * @dev Get proof statistics for a record
     * @param recordId The ID of the record
     * @return proofCount Total number of proofs for the record
     * @return verifiedCount Number of verified proofs
     */
    function getRecordProofStats(
        uint256 recordId
    ) external view returns (uint256 proofCount, uint256 verifiedCount) {
        bytes32[] storage hashes = recordProofs[recordId];
        uint256 verified = 0;
        
        for (uint256 i = 0; i < hashes.length; i++) {
            if (proofs[hashes[i]].isVerified) {
                verified++;
            }
        }
        
        return (hashes.length, verified);
    }

    /**
     * @dev Get proof statistics for a user
     * @param user The user address
     * @return proofCount Total number of proofs for the user
     * @return verifiedCount Number of verified proofs
     */
    function getUserProofStats(
        address user
    ) external view returns (uint256 proofCount, uint256 verifiedCount) {
        bytes32[] storage hashes = userProofs[user];
        uint256 verified = 0;
        
        for (uint256 i = 0; i < hashes.length; i++) {
            if (proofs[hashes[i]].isVerified) {
                verified++;
            }
        }
        
        return (hashes.length, verified);
    }

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
    ) {
        uint256 rate = totalProofsGenerated > 0 
            ? (totalProofsVerified * 10000) / totalProofsGenerated 
            : 0;
            
        return (totalProofsGenerated, totalProofsVerified, rate);
    }

    // Admin functions

    /**
     * @dev Set proof validity duration (admin only)
     * @param duration New validity duration in seconds
     */
    function setProofValidityDuration(uint256 duration) external onlyAdminOrSuper {
        require(duration >= 1 seconds, "Duration too short");
        require(duration <= 24 hours, "Duration too long");
        proofValidityDuration = duration;
    }

    /**
     * @dev Set maximum proofs per record (admin only)
     * @param maxProofs New maximum number of proofs per record
     */
    function setMaxProofsPerRecord(uint256 maxProofs) external onlyAdminOrSuper {
        require(maxProofs > 0, "Max proofs must be positive");
        maxProofsPerRecord = maxProofs;
    }

    /**
     * @dev Set maximum proofs per user (admin only)
     * @param maxProofs New maximum number of proofs per user
     */
    function setMaxProofsPerUser(uint256 maxProofs) external onlyAdminOrSuper {
        require(maxProofs > 0, "Max proofs must be positive");
        maxProofsPerUser = maxProofs;
    }

    /**
     * @dev Invalidate a proof (admin only)
     * @param proofHash The hash of the proof to invalidate
     */
    function invalidateProof(bytes32 proofHash) external onlyAdminOrSuper {
        ProofMetadata storage metadata = proofMetadata[proofHash];
        
        if (metadata.timestamp == 0) {
            revert InvalidProof(proofHash);
        }

        metadata.isValid = false;
    }

    /**
     * @dev Clean up expired proofs (admin only)
     * @param proofHashes Array of proof hashes to clean up
     */
    function cleanupExpiredProofs(bytes32[] calldata proofHashes) external onlyAdminOrSuper {
        for (uint256 i = 0; i < proofHashes.length; i++) {
            ZKProof storage proof = proofs[proofHashes[i]];
            
            if (proof.timestamp != 0 && 
                block.timestamp > proof.timestamp + proofValidityDuration) {
                
                // Mark metadata as invalid
                proofMetadata[proofHashes[i]].isValid = false;
                
                // Note: We don't delete the proof data to maintain audit trail
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