// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../interfaces/IAcademicRecords.sol";

library RecordStorage {
    struct RecordData {
        mapping(uint256 => IAcademicRecords.Record) records;
        mapping(string => uint256[]) studentRecords;
        mapping(address => uint256[]) universityRecords;
        mapping(uint256 => mapping(address => bool)) recordSharedWith;
        mapping(string => mapping(address => uint256[])) studentSharedRecords;
        uint256 recordCounter;
    }

    struct CustomTypeData {
        mapping(uint256 => IAcademicRecords.CustomRecordType) customTypes;
        mapping(address => uint256[]) universityCustomTypes;
        uint256 customTypeCounter;
    }

    function addRecord(
        RecordData storage self,
        string calldata studentId,
        string calldata studentName,
        address studentAddress,
        string calldata universityName,
        string calldata ipfsHash,
        string calldata metadataHash,
        IAcademicRecords.RecordType recordType,
        address issuer
    ) external returns (uint256) {
        self.recordCounter++;
        uint256 recordId = self.recordCounter;

        IAcademicRecords.Record memory newRecord = IAcademicRecords.Record({
            id: recordId,
            studentId: studentId,
            studentName: studentName,
            studentAddress: studentAddress,
            universityName: universityName,
            ipfsHash: ipfsHash,
            metadataHash: metadataHash,
            recordType: recordType,
            timestamp: block.timestamp,
            isVerified: true,
            issuer: issuer
        });

        self.records[recordId] = newRecord;
        self.studentRecords[studentId].push(recordId);
        self.universityRecords[issuer].push(recordId);

        return recordId;
    }

    function deleteStudentRecords(
        RecordData storage self,
        string calldata studentId,
        address university
    ) external returns (uint256[] memory deletedRecords) {
        uint256[] storage records = self.studentRecords[studentId];
        uint256[] memory toDelete = new uint256[](records.length);
        uint256 deleteCount = 0;

        // Find records issued by this university
        for (uint256 i = 0; i < records.length; i++) {
            if (self.records[records[i]].issuer == university) {
                toDelete[deleteCount] = records[i];
                deleteCount++;
            }
        }

        deletedRecords = new uint256[](deleteCount);

        // Delete records and update mappings
        for (uint256 i = 0; i < deleteCount; i++) {
            uint256 recordId = toDelete[i];
            deletedRecords[i] = recordId;

            // Remove from student records
            _removeFromArray(self.studentRecords[studentId], recordId);

            // Remove from university records
            _removeFromArray(self.universityRecords[university], recordId);

            // Delete the record
            delete self.records[recordId];
        }

        return deletedRecords;
    }

    function _removeFromArray(uint256[] storage array, uint256 value) private {
        for (uint256 i = 0; i < array.length; i++) {
            if (array[i] == value) {
                array[i] = array[array.length - 1];
                array.pop();
                break;
            }
        }
    }

    function shareRecord(
        RecordData storage self,
        uint256 recordId,
        address sharedWith,
        string calldata studentId
    ) external {
        self.recordSharedWith[recordId][sharedWith] = true;
        self.studentSharedRecords[studentId][sharedWith].push(recordId);
    }

    function unshareRecord(
        RecordData storage self,
        uint256 recordId,
        address sharedWith,
        string calldata studentId
    ) external {
        self.recordSharedWith[recordId][sharedWith] = false;
        _removeFromArray(
            self.studentSharedRecords[studentId][sharedWith],
            recordId
        );
    }

    function addCustomType(
        CustomTypeData storage self,
        string calldata name,
        string calldata description,
        address creator
    ) external returns (uint256) {
        self.customTypeCounter++;
        uint256 typeId = self.customTypeCounter;

        IAcademicRecords.CustomRecordType memory newType = IAcademicRecords
            .CustomRecordType({
                id: typeId,
                name: name,
                description: description,
                creator: creator,
                timestamp: block.timestamp,
                isActive: true
            });

        self.customTypes[typeId] = newType;
        self.universityCustomTypes[creator].push(typeId);

        return typeId;
    }

    function getRecordsByStudentAddress(
        RecordData storage self,
        address studentAddress
    ) external view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 1; i <= self.recordCounter; i++) {
            if (self.records[i].studentAddress == studentAddress) {
                count++;
            }
        }

        uint256[] memory result = new uint256[](count);
        uint256 index = 0;

        for (uint256 i = 1; i <= self.recordCounter; i++) {
            if (self.records[i].studentAddress == studentAddress) {
                result[index] = i;
                index++;
            }
        }

        return result;
    }
}
