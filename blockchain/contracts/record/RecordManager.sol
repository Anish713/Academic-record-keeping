// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/Counters.sol";
import "../utils/Types.sol";
import "../access/Roles.sol";
import "../utils/RecordAccessControl.sol";

abstract contract RecordManager is Roles, RecordAccessControl {
    using Counters for Counters.Counter;

    Counters.Counter internal _recordIdCounter;

    mapping(uint256 => Types.Record) internal _records;
    mapping(string => uint256[]) internal _studentRecords;
    mapping(address => uint256[]) internal _universityRecords;

    mapping(address => mapping(string => bool)) internal _customRecordTypes;

    event RecordAdded(uint256 indexed recordId, string studentId, Types.RecordType recordType, address issuer);
    event RecordDeleted(uint256 indexed recordId, string studentId);
    event CustomRecordTypeAdded(address university, string label);

    function addRecord(
        string calldata studentId,
        string calldata studentName,
        string calldata universityName,
        string calldata ipfsHash,
        string calldata metadataHash,
        Types.RecordType recordType
    ) external onlyRole(UNIVERSITY_ROLE) returns (uint256) {
        _recordIdCounter.increment();
        uint256 recordId = _recordIdCounter.current();

        Types.Record memory newRecord = Types.Record({
            id: recordId,
            studentId: studentId,
            studentName: studentName,
            universityName: universityName,
            ipfsHash: ipfsHash,
            metadataHash: metadataHash,
            recordType: recordType,
            timestamp: block.timestamp,
            isVerified: true,
            issuer: msg.sender
        });

        _records[recordId] = newRecord;
        _studentRecords[studentId].push(recordId);
        _universityRecords[msg.sender].push(recordId);
        _addStudentRecord(msg.sender, recordId);

        emit RecordAdded(recordId, studentId, recordType, msg.sender);
        return recordId;
    }

    function deleteStudentRecords(string calldata studentId) external onlyRole(UNIVERSITY_ROLE) {
        uint256[] memory records = _studentRecords[studentId];
        for (uint i = 0; i < records.length; i++) {
            delete _records[records[i]];
            emit RecordDeleted(records[i], studentId);
        }
        delete _studentRecords[studentId];
    }

    function addCustomRecordType(string calldata label) external onlyRole(UNIVERSITY_ROLE) {
        _customRecordTypes[msg.sender][label] = true;
        emit CustomRecordTypeAdded(msg.sender, label);
    }

    function isCustomRecordType(address university, string calldata label) external view returns (bool) {
        return _customRecordTypes[university][label];
    }

    function getRecord(uint256 recordId) external view returns (Types.Record memory) {
        require(_records[recordId].id == recordId, "Record not found");
        return _records[recordId];
    }

    function verifyRecord(uint256 recordId) external view returns (bool) {
        return _records[recordId].isVerified;
    }

    function getStudentRecords(string calldata studentId) external view returns (uint256[] memory) {
        return _studentRecords[studentId];
    }

    function getUniversityRecords() external view onlyRole(UNIVERSITY_ROLE) returns (uint256[] memory) {
        return _universityRecords[msg.sender];
    }

    function _isStudentOwner(address student, uint256 recordId) internal view override returns (bool) {
        return _records[recordId].issuer == student;
    }
}
