// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

library Types {
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
}
