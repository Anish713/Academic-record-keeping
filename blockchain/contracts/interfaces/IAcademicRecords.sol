// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IAcademicRecords {
    enum RecordType {
        TRANSCRIPT,
        CERTIFICATE,
        DEGREE,
        OTHER
    }

    struct Record {
        uint256 id;
        string studentId;
        string studentName;
        string universityName;
        string ipfsHash;
        string metadataHash;
        RecordType recordType;
        uint256 timestamp;
        bool isVerified;
        address issuer;
    }

    struct CustomRecordType {
        uint256 id;
        string name;
        string description;
        address creator;
        uint256 timestamp;
        bool isActive;
    }

    // Events
    event RecordAdded(
        uint256 indexed recordId,
        string studentId,
        RecordType recordType,
        address issuer
    );
    event RecordVerified(uint256 indexed recordId, address verifier);
    event RecordAccessed(uint256 indexed recordId, address accessor);
    event StudentDeleted(string indexed studentId, address indexed university);
    event RecordShared(
        uint256 indexed recordId,
        string indexed studentId,
        address indexed sharedWith
    );
    event RecordUnshared(
        uint256 indexed recordId,
        string indexed studentId,
        address indexed unsharedWith
    );
    event CustomRecordTypeCreated(
        uint256 indexed typeId,
        string name,
        address indexed creator
    );
    event CustomRecordTypeUpdated(uint256 indexed typeId, bool isActive);
}
