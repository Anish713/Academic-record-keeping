// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./interfaces/IZKPInterfaces.sol";

/**
 * @title ZKPManager
 * @dev Manages Zero-Knowledge Proof verification for academic records access
 */
contract ZKPManager is IZKPManager, AccessControl, Pausable {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant UNIVERSITY_ROLE = keccak256("UNIVERSITY_ROLE");

    // Verification keys for different circuit types
    mapping(uint8 => bytes) private verificationKeys;
    
    // Track verified access for records
    mapping(uint256 => mapping(address => bool)) private verifiedAccess;
    
    // Record sharing with ZKP verification
    mapping(uint256 => mapping(address => bool)) private zkpSharedRecords;
    
    // Access history for audit
    mapping(uint256 => address[]) private recordAccessHistory;
    
    // Circuit type constants
    uint8 public constant ACCESS_VERIFICATION_CIRCUIT = 0;
    uint8 public constant RECORD_SHARING_CIRCUIT = 1;

    // Reference to other contracts
    address public academicRecordsContract;
    address public keyStorageContract;
    address public accessManagerContract;

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
        address _academicRecords,
        address _keyStorage,
        address _accessManager
    ) external onlyRole(ADMIN_ROLE) {
        academicRecordsContract = _academicRecords;
        keyStorageContract = _keyStorage;
        accessManagerContract = _accessManager;
    }

    /**
     * @dev Set verification key for a circuit type
     * @param circuitType The circuit type (0: access, 1: sharing)
     * @param verificationKey The verification key data
     */
    function setVerificationKey(
        uint8 circuitType,
        bytes memory verificationKey
    ) external onlyRole(ADMIN_ROLE) {
        verificationKeys[circuitType] = verificationKey;
    }

    /**
     * @dev Verify a ZK proof (simplified implementation)
     * @param proof The ZK proof
     * @param publicSignals Public signals
     * @param circuitType Circuit type to verify against
     * @return isValid True if proof is valid
     */
    function verifyProof(
        Proof memory proof,
        uint256[] memory publicSignals,
        uint8 circuitType
    ) public view returns (bool isValid) {
        // Simplified verification - in production, use actual ZK verification
        // This would integrate with a library like circomlib or similar
        
        require(verificationKeys[circuitType].length > 0, "Verification key not set");
        
        // Basic validation checks
        require(proof.a.length == 2, "Invalid proof format");
        require(proof.b.length == 2, "Invalid proof format");
        require(proof.b[0].length == 2, "Invalid proof format");
        require(proof.b[1].length == 2, "Invalid proof format");
        require(proof.c.length == 2, "Invalid proof format");
        require(publicSignals.length >= 4, "Insufficient public signals");
        
        // For demo purposes, we'll do basic validation
        // In production, this would call the actual verifier contract
        return _basicProofValidation(proof, publicSignals);
    }

    /**
     * @dev Verify access to a record using ZK proof
     */
    function verifyAccess(
        uint256 recordId,
        AccessType accessType,
        Proof memory proof,
        uint256[] memory publicSignals
    ) external override whenNotPaused returns (bool success) {
        // Verify the ZK proof
        require(
            verifyProof(proof, publicSignals, ACCESS_VERIFICATION_CIRCUIT),
            "Invalid ZK proof"
        );

        // Extract and validate public signals
        address userAddress = address(uint160(publicSignals[0]));
        uint256 proofRecordId = publicSignals[1];
        uint256 proofAccessType = publicSignals[2];
        uint256 timestamp = publicSignals[3];

        require(userAddress == msg.sender, "Proof not for sender");
        require(proofRecordId == recordId, "Record ID mismatch");
        require(proofAccessType == uint256(accessType), "Access type mismatch");
        require(block.timestamp <= timestamp + 300, "Proof expired"); // 5 minute window

        // Verify access permissions based on type
        require(_verifyAccessPermissions(recordId, userAddress, accessType), "Access not permitted");

        // Grant verified access
        verifiedAccess[recordId][userAddress] = true;
        recordAccessHistory[recordId].push(userAddress);

        emit AccessVerified(userAddress, recordId, accessType, block.timestamp);
        return true;
    }

    /**
     * @dev Share a record with another address using ZK proof
     */
    function shareRecordWithZKP(
        uint256 recordId,
        address sharedWith,
        Proof memory proof,
        uint256[] memory publicSignals
    ) external override whenNotPaused returns (bool success) {
        // Verify the ZK proof
        require(
            verifyProof(proof, publicSignals, RECORD_SHARING_CIRCUIT),
            "Invalid ZK proof"
        );

        // Extract and validate public signals
        address userAddress = address(uint160(publicSignals[0]));
        uint256 proofRecordId = publicSignals[1];
        uint256 timestamp = publicSignals[3];

        require(userAddress == msg.sender, "Proof not for sender");
        require(proofRecordId == recordId, "Record ID mismatch");
        require(block.timestamp <= timestamp + 300, "Proof expired");

        // Verify user can share this record (owns it or has sharing permissions)
        require(_canUserShareRecord(recordId, userAddress), "Cannot share record");

        // Grant sharing access
        zkpSharedRecords[recordId][sharedWith] = true;

        emit RecordShared(recordId, userAddress, sharedWith, block.timestamp);
        return true;
    }

    /**
     * @dev Batch verify multiple access requests
     */
    function batchVerifyAccess(
        uint256[] memory recordIds,
        AccessType[] memory accessTypes,
        Proof[] memory proofs,
        uint256[][] memory publicSignalsArray
    ) external override whenNotPaused returns (bool[] memory results) {
        require(
            recordIds.length == accessTypes.length &&
            accessTypes.length == proofs.length &&
            proofs.length == publicSignalsArray.length,
            "Array length mismatch"
        );

        results = new bool[](recordIds.length);

        for (uint256 i = 0; i < recordIds.length; i++) {
            try this.verifyAccess(recordIds[i], accessTypes[i], proofs[i], publicSignalsArray[i]) {
                results[i] = true;
            } catch {
                results[i] = false;
            }
        }

        return results;
    }

    /**
     * @dev Check if an address has ZKP-verified access to a record
     */
    function hasVerifiedAccess(
        uint256 recordId,
        address userAddress
    ) external view override returns (bool hasAccess) {
        return verifiedAccess[recordId][userAddress] || zkpSharedRecords[recordId][userAddress];
    }

    /**
     * @dev Get verification key for a specific circuit
     */
    function getVerificationKey(uint8 circuitType) external view override returns (bytes memory verificationKey) {
        return verificationKeys[circuitType];
    }

    /**
     * @dev Get access history for a record
     */
    function getRecordAccessHistory(uint256 recordId) external view returns (address[] memory) {
        return recordAccessHistory[recordId];
    }

    /**
     * @dev Revoke verified access (admin only)
     */
    function revokeVerifiedAccess(
        uint256 recordId,
        address userAddress
    ) external onlyRole(ADMIN_ROLE) {
        verifiedAccess[recordId][userAddress] = false;
        zkpSharedRecords[recordId][userAddress] = false;
    }

    /**
     * @dev Internal function to verify access permissions
     */
    function _verifyAccessPermissions(
        uint256 recordId,
        address userAddress,
        AccessType accessType
    ) internal view returns (bool) {
        // This would integrate with the AcademicRecords contract
        // For now, we'll implement basic checks
        
        if (accessType == AccessType.STUDENT_ACCESS) {
            // Student accessing their own record - would check with AcademicRecords contract
            return true; // Simplified for demo
        } else if (accessType == AccessType.SHARED_ACCESS) {
            // Someone accessing a shared record
            return true; // Would check sharing permissions
        } else if (accessType == AccessType.UNIVERSITY_ACCESS) {
            // University accessing their issued record
            return hasRole(UNIVERSITY_ROLE, userAddress);
        } else if (accessType == AccessType.VERIFIER_ACCESS) {
            // Third party verification
            return true; // Would check verifier permissions
        }
        
        return false;
    }

    /**
     * @dev Internal function to check if user can share a record
     */
    function _canUserShareRecord(uint256 recordId, address userAddress) internal view returns (bool) {
        // This would check with AcademicRecords contract to see if user owns the record
        // or has sharing permissions
        return true; // Simplified for demo
    }

    /**
     * @dev Basic proof validation (placeholder for actual ZK verification)
     */
    function _basicProofValidation(
        Proof memory proof,
        uint256[] memory publicSignals
    ) internal pure returns (bool) {
        // This is a simplified validation for demo purposes
        // In production, this would use actual cryptographic verification
        
        // Check that proof elements are not zero
        if (proof.a[0] == 0 && proof.a[1] == 0) return false;
        if (proof.c[0] == 0 && proof.c[1] == 0) return false;
        
        // Check that public signals are reasonable
        if (publicSignals[0] == 0) return false; // userAddress
        if (publicSignals[3] == 0) return false; // timestamp
        
        return true;
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
}