// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/security/Pausable.sol";
import "./interfaces/IAcademicRecords.sol";
import "./interfaces/IZKPManager.sol";
import "./interfaces/IAccessManager.sol";
import "./interfaces/IKeyStorage.sol";
import "./abstract/RoleManager.sol";
import "./libraries/RecordStorage.sol";
import "./libraries/SecureRecordOperations.sol";
import "./libraries/RecordManagement.sol";
import "./modules/StudentManagement.sol";

/**
 * @title AcademicRecords - Optimized for Mainnet Deployment
 * @dev Streamlined contract with essential functionality only
 */
contract AcademicRecordsOptimized is IAcademicRecords, RoleManager, Pausable {
    using RecordStorage for RecordStorage.RecordData;
    using RecordStorage for RecordStorage.CustomTypeData;
    using SecureRecordOperations for RecordStorage.RecordData;
    using RecordManagement for RecordStorage.RecordData;

    RecordStorage.RecordData private recordData;
    RecordStorage.CustomTypeData private customTypeData;
    StudentManagement public studentManagement;

    // ZKP Infrastructure contracts
    IZKPManager public zkpManager;
    IAccessManager public accessManager;
    IKeyStorage public keyStorage;

    event ZKPContractsUpdated(address zkpManager, address accessManager, address keyStorage);

    constructor() RoleManager() {
        studentManagement = new StudentManagement();
    }

    // --- Core Contract Management ---

    function setZKPContracts(
        address _zkpManager,
        address _accessManager,
        address _keyStorage
    ) external onlyAdminOrSuper {
        require(_zkpManager != address(0) && _accessManager != address(0) && _keyStorage != address(0), "Invalid addresses");

        zkpManager = IZKPManager(_zkpManager);
        accessManager = IAccessManager(_accessManager);
        keyStorage = IKeyStorage(_keyStorage);

        // Initialize RecordStorage library with the new contracts
        recordData.initialize(_keyStorage, _accessManager);

        emit ZKPContractsUpdated(_zkpManager, _accessManager, _keyStorage);
    }

    // --- Record Management ---

    function addRecord(
        string calldata studentId,
        string calldata studentName,
        address studentAddress,
        string calldata universityName,
        string calldata ipfsHash,
        string calldata metadataHash,
        RecordType recordType
    ) external onlyRole(UNIVERSITY_ROLE) whenNotPaused returns (uint256) {
        return recordData.addRecord(
            studentId, studentName, studentAddress, universityName,
            ipfsHash, metadataHash, recordType, msg.sender, studentManagement
        );
    }

    function addSecureRecord(
        string calldata studentId,
        string calldata studentName,
        address studentAddress,
        string calldata universityName,
        bytes calldata encryptedIPFSHash,
        bytes calldata encryptedMetadataHash,
        bytes calldata encryptedKey,
        RecordType recordType
    ) external onlyRole(UNIVERSITY_ROLE) whenNotPaused returns (uint256) {
        return recordData.addSecureRecord(
            studentId, studentName, studentAddress, universityName,
            encryptedIPFSHash, encryptedMetadataHash, encryptedKey, recordType,
            msg.sender, SUPER_ADMIN, studentManagement, zkpManager
        );
    }

    // --- Record Access (Consolidated) ---

    function getRecord(uint256 recordId) external view returns (Record memory) {
        require(recordData.records[recordId].id == recordId, "Record does not exist");
        return recordData.records[recordId];
    }

    function getSecureRecord(uint256 recordId) external view returns (SecureRecord memory) {
        require(recordData.isRecordSecure(recordId), "Secure record does not exist");
        
        (uint256 id, string memory studentId, string memory studentName, address studentAddress, 
         string memory universityName, RecordType recordType, uint256 timestamp, 
         bool isVerified, address issuer,) = recordData.getRecordMetadata(recordId);
        
        return SecureRecord({
            id: id,
            studentId: studentId,
            studentName: studentName,
            studentAddress: studentAddress,
            universityName: universityName,
            encryptedIPFSHash: "",
            encryptedMetadataHash: "",
            zkProofHash: recordData.getZKProofHash(recordId),
            recordType: recordType,
            timestamp: timestamp,
            isVerified: isVerified,
            issuer: issuer,
            accessControlHash: recordData.getAccessControlHash(recordId)
        });
    }

    function getSecureRecordWithAccess(
        uint256 recordId,
        bytes32 proofHash
    ) external returns (SecureRecord memory) {
        return recordData.getSecureRecordWithAccess(
            recordId, proofHash, msg.sender, zkpManager, accessManager, SUPER_ADMIN
        );
    }

    function getDecryptedRecord(
        uint256 recordId,
        bytes32 proofHash
    ) external returns (bytes memory encryptedIPFSHash, bytes memory encryptedMetadataHash) {
        return recordData.getDecryptedRecord(
            recordId, proofHash, msg.sender, zkpManager, accessManager, SUPER_ADMIN
        );
    }

    // --- Record Sharing (Consolidated) ---

    function shareRecord(uint256 recordId, address sharedWith) external {
        require(recordData.records[recordId].id == recordId, "Record does not exist");

        string memory studentId = studentManagement.addressToStudentId(msg.sender);
        require(bytes(studentId).length > 0 && 
                keccak256(bytes(studentId)) == keccak256(bytes(recordData.records[recordId].studentId)), 
                "Not authorized");

        recordData.shareRecord(recordId, sharedWith, studentId);
        emit RecordShared(recordId, studentId, sharedWith);
    }

    function shareSecureRecord(
        uint256 recordId,
        address sharedWith,
        uint256 duration,
        uint256 maxUsage
    ) external returns (bytes32) {
        return recordData.shareSecureRecord(recordId, sharedWith, duration, maxUsage, msg.sender);
    }

    function revokeSecureRecordAccess(uint256 recordId, address user) external {
        recordData.revokeSecureRecordAccess(recordId, user, msg.sender, accessManager);
    }

    // --- Student Management ---

    function deleteStudent(string calldata studentId) external onlyRole(UNIVERSITY_ROLE) whenNotPaused {
        require(bytes(studentId).length > 0, "Invalid student ID");

        recordData.deleteStudentRecords(studentId, msg.sender);
        emit StudentDeleted(studentId, msg.sender);
    }

    // --- Custom Record Types ---

    function addCustomRecordType(
        string calldata name,
        string calldata description
    ) external onlyRole(UNIVERSITY_ROLE) returns (uint256) {
        uint256 typeId = customTypeData.addCustomType(name, description, msg.sender);
        emit CustomRecordTypeCreated(typeId, name, msg.sender);
        return typeId;
    }

    // --- Utility Functions ---

    function getTotalRecords() external view returns (uint256) {
        return recordData.recordCounter;
    }

    function getTotalSecureRecords() external view returns (uint256) {
        uint256 secureCount = 0;
        for (uint256 i = 1; i <= recordData.recordCounter; i++) {
            if (recordData.isRecordSecure(i)) {
                secureCount++;
            }
        }
        return secureCount;
    }

    function getStudentRecords(string calldata studentId) external view returns (uint256[] memory) {
        return recordData.studentRecords[studentId];
    }

    function hasSecureRecordAccess(uint256 recordId, address accessor) external view returns (bool) {
        return address(accessManager) != address(0) && accessManager.hasAccess(recordId, accessor);
    }

    // --- Emergency Functions ---

    function emergencyAccess(
        uint256 recordId,
        string calldata reason
    ) external onlyRole(SUPER_ADMIN_ROLE) returns (SecureRecord memory) {
        return recordData.emergencyAccess(recordId, reason, msg.sender, accessManager);
    }

    function rotateRecordKey(uint256 recordId, bytes calldata newEncryptedKey) external {
        recordData.rotateRecordKey(recordId, newEncryptedKey, msg.sender, SUPER_ADMIN, keyStorage);
    }

    // --- Internal Helper Functions ---
    // Moved to libraries for size optimization

    // --- Pause Functions ---

    function pause() external onlyAdminOrSuper {
        _pause();
    }

    function unpause() external onlyAdminOrSuper {
        _unpause();
    }
}