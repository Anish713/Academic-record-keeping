// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/security/Pausable.sol";
import "./interfaces/IAcademicRecords.sol";
import "./abstract/RoleManager.sol";
import "./libraries/RecordStorage.sol";
import "./modules/StudentManagement.sol";

contract AcademicRecords is IAcademicRecords, RoleManager, Pausable {
    using RecordStorage for RecordStorage.RecordData;
    using RecordStorage for RecordStorage.CustomTypeData;

    RecordStorage.RecordData private recordData;
    RecordStorage.CustomTypeData private customTypeData;
    StudentManagement public studentManagement;

    constructor() RoleManager() {
        studentManagement = new StudentManagement();
    }

    // --- Academic Record Management ---

    function addRecord(
        string calldata studentId,
        string calldata studentName,
        string calldata universityName,
        string calldata ipfsHash,
        string calldata metadataHash,
        RecordType recordType
    ) external onlyRole(UNIVERSITY_ROLE) whenNotPaused returns (uint256) {
        uint256 recordId = recordData.addRecord(
            studentId,
            studentName,
            universityName,
            ipfsHash,
            metadataHash,
            recordType,
            msg.sender
        );

        emit RecordAdded(recordId, studentId, recordType, msg.sender);
        return recordId;
    }

    function deleteStudent(
        string calldata studentId
    ) external onlyRole(UNIVERSITY_ROLE) whenNotPaused {
        require(bytes(studentId).length > 0, "Invalid student ID");

        uint256[] memory deletedRecords = recordData.deleteStudentRecords(
            studentId,
            msg.sender
        );

        emit StudentDeleted(studentId, msg.sender);

        // Emit events for deleted records
        for (uint256 i = 0; i < deletedRecords.length; i++) {
            // Records are already deleted, so we can't emit detailed info
            // You might want to store this info before deletion if needed
        }
    }

    function getRecord(uint256 recordId) external view returns (Record memory) {
        require(
            recordData.records[recordId].id == recordId,
            "Record does not exist"
        );
        return recordData.records[recordId];
    }

    function getRecordWithPermission(
        uint256 recordId
    ) external view returns (Record memory) {
        require(
            recordData.records[recordId].id == recordId,
            "Record does not exist"
        );

        Record memory record = recordData.records[recordId];

        // Check if caller has permission to view this record
        bool hasPermission = false;

        // University that issued the record can always view
        if (record.issuer == msg.sender) {
            hasPermission = true;
        }

        // Check if record is shared with caller
        if (recordData.recordSharedWith[recordId][msg.sender]) {
            hasPermission = true;
        }

        // Admin and super admin can view all
        if (hasRole(ADMIN_ROLE, msg.sender) || msg.sender == SUPER_ADMIN) {
            hasPermission = true;
        }

        // Student can view their own records
        string memory studentId = studentManagement.addressToStudentId(
            msg.sender
        );
        if (
            bytes(studentId).length > 0 &&
            keccak256(bytes(studentId)) == keccak256(bytes(record.studentId))
        ) {
            hasPermission = true;
        }

        require(hasPermission, "No permission to view this record");

        // If caller doesn't have full access, hide sensitive data
        if (
            !recordData.recordSharedWith[recordId][msg.sender] &&
            record.issuer != msg.sender &&
            !hasRole(ADMIN_ROLE, msg.sender) &&
            msg.sender != SUPER_ADMIN
        ) {
            record.ipfsHash = "";
            record.metadataHash = "";
        }

        return record;
    }

    function getStudentRecords(
        string calldata studentId
    ) external view returns (uint256[] memory) {
        return recordData.studentRecords[studentId];
    }

    function getUniversityRecords()
        external
        view
        onlyRole(UNIVERSITY_ROLE)
        returns (uint256[] memory)
    {
        return recordData.universityRecords[msg.sender];
    }

    function verifyRecord(uint256 recordId) external view returns (bool) {
        require(
            recordData.records[recordId].id == recordId,
            "Record does not exist"
        );
        return recordData.records[recordId].isVerified;
    }

    // --- Record Sharing Functions ---

    function shareRecord(uint256 recordId, address sharedWith) external {
        require(
            recordData.records[recordId].id == recordId,
            "Record does not exist"
        );

        // Only student can share their records
        string memory studentId = studentManagement.addressToStudentId(
            msg.sender
        );
        require(bytes(studentId).length > 0, "Not a registered student");
        require(
            keccak256(bytes(studentId)) ==
                keccak256(bytes(recordData.records[recordId].studentId)),
            "Not your record"
        );

        recordData.shareRecord(recordId, sharedWith, studentId);
        emit RecordShared(recordId, studentId, sharedWith);
    }

    function unshareRecord(uint256 recordId, address sharedWith) external {
        require(
            recordData.records[recordId].id == recordId,
            "Record does not exist"
        );

        string memory studentId = studentManagement.addressToStudentId(
            msg.sender
        );
        require(bytes(studentId).length > 0, "Not a registered student");
        require(
            keccak256(bytes(studentId)) ==
                keccak256(bytes(recordData.records[recordId].studentId)),
            "Not your record"
        );

        recordData.unshareRecord(recordId, sharedWith, studentId);
        emit RecordUnshared(recordId, studentId, sharedWith);
    }

    function getSharedRecords(
        address sharedWith
    ) external view returns (uint256[] memory) {
        string memory studentId = studentManagement.addressToStudentId(
            msg.sender
        );
        require(bytes(studentId).length > 0, "Not a registered student");

        return recordData.studentSharedRecords[studentId][sharedWith];
    }

    function isRecordSharedWith(
        uint256 recordId,
        address user
    ) external view returns (bool) {
        return recordData.recordSharedWith[recordId][user];
    }

    // --- Custom Record Types ---

    function addCustomRecordType(
        string calldata name,
        string calldata description
    ) external onlyRole(UNIVERSITY_ROLE) returns (uint256) {
        require(bytes(name).length > 0, "Invalid name");

        uint256 typeId = customTypeData.addCustomType(
            name,
            description,
            msg.sender
        );
        emit CustomRecordTypeCreated(typeId, name, msg.sender);

        return typeId;
    }

    function updateCustomRecordType(
        uint256 typeId,
        bool isActive
    ) external onlyRole(UNIVERSITY_ROLE) {
        require(
            customTypeData.customTypes[typeId].creator == msg.sender,
            "Not the creator"
        );

        customTypeData.customTypes[typeId].isActive = isActive;
        emit CustomRecordTypeUpdated(typeId, isActive);
    }

    function getCustomRecordType(
        uint256 typeId
    ) external view returns (CustomRecordType memory) {
        require(
            customTypeData.customTypes[typeId].id == typeId,
            "Custom type does not exist"
        );
        return customTypeData.customTypes[typeId];
    }

    function getUniversityCustomTypes()
        external
        view
        onlyRole(UNIVERSITY_ROLE)
        returns (uint256[] memory)
    {
        return customTypeData.universityCustomTypes[msg.sender];
    }

    // --- Access Tracking ---

    function recordAccess(uint256 recordId) external {
        require(
            recordData.records[recordId].id == recordId,
            "Record does not exist"
        );
        emit RecordAccessed(recordId, msg.sender);
    }

    // --- Student Registration ---

    function registerStudent(string calldata studentId) external {
        studentManagement.registerStudent(studentId, msg.sender);
    }

    // --- Pause Controls ---

    function pause() external onlyAdminOrSuper {
        _pause();
    }

    function unpause() external onlyAdminOrSuper {
        _unpause();
    }

    // --- Utility Functions ---

    function getTotalRecords() external view returns (uint256) {
        return recordData.recordCounter;
    }

    function getTotalCustomTypes() external view returns (uint256) {
        return customTypeData.customTypeCounter;
    }
}
