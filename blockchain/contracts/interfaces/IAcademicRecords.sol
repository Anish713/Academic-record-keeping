// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IAcademicRecords {
 enum RecordType {

    // === Academic Records ===
    TRANSCRIPT,
    DEGREE,
    MARKSHEET,
    DIPLOMA,
    CERTIFICATE,
    PROVISIONAL_CERTIFICATE,

    // === Identity & Personal Verification ===
    BIRTH_CERTIFICATE,
    CITIZENSHIP,
    NATIONAL_ID,
    PASSPORT_COPY,
    CHARACTER_CERTIFICATE,

    // === Admission & Examination Documents ===
    ENTRANCE_RESULTS,
    ADMIT_CARD,
    COUNSELING_LETTER,
    SEAT_ALLOTMENT_LETTER,
    MIGRATION_CERTIFICATE,
    TRANSFER_CERTIFICATE,

    // === Administrative & Financial Records ===
    BILLS,
    FEE_RECEIPT,
    SCHOLARSHIP_LETTER,
    LOAN_DOCUMENT,
    HOSTEL_CLEARANCE,

    // === Academic Schedules & Communications ===
    ROUTINE,
    NOTICE,
    CIRCULAR,
    NEWS,

    // === Miscellaneous & Supporting Documents ===
    RECOMMENDATION_LETTER,
    INTERNSHIP_CERTIFICATE,
    EXPERIENCE_LETTER,
    BONAFIDE_CERTIFICATE,
    NO_OBJECTION_CERTIFICATE,

    // === Fallback ===
    OTHER
}

    struct Record {
        uint256 id;
        string studentId;
        string studentName;
        address studentAddress;
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
    event ZKAccessControlSet(address indexed zkAccessControl);

    // ZK Access Control Functions
    function setZKAccessControl(address _zkAccessControl) external;
    
    function getRecordWithZKProof(
        uint256 recordId,
        uint[2] memory _pA,
        uint[2][2] memory _pB,
        uint[2] memory _pC,
        uint[3] memory publicSignals,
        string memory originalIPFSHash
    ) external view returns (Record memory record, string memory decryptedIPFSHash);
    
    function getRecordsWithZKAccess(address userAddress) external view returns (uint256[] memory);
}
