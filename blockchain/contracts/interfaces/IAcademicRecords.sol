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

    enum AccessType {
        OWNER,      // Student owns the record
        SHARED,     // Record shared with user
        ADMIN,      // University admin access
        EMERGENCY   // Super admin emergency access
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

    // Enhanced record structure for ZKP access control
    struct SecureRecord {
        uint256 id;
        string studentId;
        string studentName;
        address studentAddress;
        string universityName;
        bytes encryptedIPFSHash;        // Encrypted IPFS hash
        bytes encryptedMetadataHash;    // Encrypted metadata hash
        bytes32 zkProofHash;            // ZK proof for record authenticity
        RecordType recordType;
        uint256 timestamp;
        bool isVerified;
        address issuer;
        bytes32 accessControlHash;      // Hash for access control verification
    }

    // Access permission structure
    struct AccessPermission {
        address accessor;
        uint256 recordId;
        uint256 grantedAt;
        uint256 expiresAt;
        bool isActive;
        AccessType accessType;
    }

    // Sharing token structure
    struct SharingToken {
        bytes32 tokenHash;
        uint256 recordId;
        address sharedBy;
        address sharedWith;
        uint256 createdAt;
        uint256 expiresAt;
        bool isRevoked;
    }

    // Access log structure for audit trail
    struct AccessLog {
        uint256 recordId;
        address accessor;
        string action;  // "VIEW", "DOWNLOAD", "VERIFY", "SHARE"
        uint256 timestamp;
        bytes32 proofHash;
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

    // ZKP-related events
    event SecureRecordAdded(
        uint256 indexed recordId,
        string studentId,
        RecordType recordType,
        address issuer,
        bytes32 zkProofHash
    );
    event ZKProofGenerated(
        uint256 indexed recordId,
        address indexed accessor,
        bytes32 proofHash,
        uint256 timestamp
    );
    event ZKProofVerified(
        uint256 indexed recordId,
        address indexed accessor,
        bytes32 proofHash,
        bool isValid
    );
    event AccessPermissionGranted(
        uint256 indexed recordId,
        address indexed accessor,
        AccessType accessType,
        uint256 expiresAt
    );
    event AccessPermissionRevoked(
        uint256 indexed recordId,
        address indexed accessor,
        AccessType accessType
    );
    event SharingTokenCreated(
        uint256 indexed recordId,
        address indexed sharedBy,
        address indexed sharedWith,
        bytes32 tokenHash,
        uint256 expiresAt
    );
    event SharingTokenUsed(
        uint256 indexed recordId,
        address indexed accessor,
        bytes32 tokenHash,
        uint256 timestamp
    );
    event SharingTokenRevoked(
        uint256 indexed recordId,
        bytes32 tokenHash,
        address indexed revokedBy
    );
    event AccessLogged(
        uint256 indexed recordId,
        address indexed accessor,
        string action,
        bytes32 proofHash,
        uint256 timestamp
    );
    event EncryptionKeyRotated(
        uint256 indexed recordId,
        address indexed rotatedBy,
        uint256 timestamp
    );
    event EmergencyAccess(
        uint256 indexed recordId,
        address indexed admin,
        string reason,
        uint256 timestamp
    );
}
