// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/security/Pausable.sol";
import "./interfaces/IAcademicRecords.sol";
import "./interfaces/IZKPManager.sol";
import "./interfaces/IAccessManager.sol";
import "./interfaces/IKeyStorage.sol";
import "./abstract/RoleManager.sol";
import "./libraries/RecordStorage.sol";
import "./modules/StudentManagement.sol";

contract AcademicRecords is IAcademicRecords, RoleManager, Pausable {
    using RecordStorage for RecordStorage.RecordData;
    using RecordStorage for RecordStorage.CustomTypeData;

    RecordStorage.RecordData private recordData;
    RecordStorage.CustomTypeData private customTypeData;
    StudentManagement public studentManagement;

    // ZKP Infrastructure contracts
    IZKPManager public zkpManager;
    IAccessManager public accessManager;
    IKeyStorage public keyStorage;



    // Events for ZKP operations
    event ZKPContractsUpdated(
        address zkpManager,
        address accessManager,
        address keyStorage
    );

    constructor() RoleManager() {
        studentManagement = new StudentManagement();
    }

    // --- ZKP Contract Management ---

    function setZKPContracts(
        address _zkpManager,
        address _accessManager,
        address _keyStorage
    ) external onlyAdminOrSuper {
        require(_zkpManager != address(0), "Invalid ZKP Manager address");
        require(_accessManager != address(0), "Invalid Access Manager address");
        require(_keyStorage != address(0), "Invalid Key Storage address");

        zkpManager = IZKPManager(_zkpManager);
        accessManager = IAccessManager(_accessManager);
        keyStorage = IKeyStorage(_keyStorage);

        // Initialize RecordStorage library with the new contracts
        recordData.initialize(_keyStorage, _accessManager);

        emit ZKPContractsUpdated(_zkpManager, _accessManager, _keyStorage);
    }

    // --- Academic Record Management ---

    function addRecord(
        string calldata studentId,
        string calldata studentName,
        address studentAddress,
        string calldata universityName,
        string calldata ipfsHash,
        string calldata metadataHash,
        RecordType recordType
    ) external onlyRole(UNIVERSITY_ROLE) whenNotPaused returns (uint256) {
        require(studentAddress != address(0), "Invalid student address");

        string memory existingStudentId = studentManagement.addressToStudentId(
            studentAddress
        );
        if (bytes(existingStudentId).length == 0) {
            studentManagement.registerStudent(studentId, studentAddress);
        }

        uint256 recordId = recordData.addRecord(
            studentId,
            studentName,
            studentAddress,
            universityName,
            ipfsHash,
            metadataHash,
            recordType,
            msg.sender
        );

        emit RecordAdded(recordId, studentId, recordType, msg.sender);
        return recordId;
    }

    // --- Secure Record Management with ZKP ---

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
        require(studentAddress != address(0), "Invalid student address");
        require(encryptedIPFSHash.length > 0, "Invalid encrypted IPFS hash");
        require(address(zkpManager) != address(0), "ZKP Manager not set");
        require(address(accessManager) != address(0), "Access Manager not set");
        require(address(keyStorage) != address(0), "Key Storage not set");

        string memory existingStudentId = studentManagement.addressToStudentId(
            studentAddress
        );
        if (bytes(existingStudentId).length == 0) {
            studentManagement.registerStudent(studentId, studentAddress);
        }

        // Generate ZK proof hash for record authenticity (placeholder values for now)
        uint[2] memory a = [uint(0), uint(0)];
        uint[2][2] memory b = [[uint(0), uint(0)], [uint(0), uint(0)]];
        uint[2] memory c = [uint(0), uint(0)];
        uint[2] memory publicInputs = [uint(recordData.recordCounter + 1), uint(uint160(msg.sender))];
        
        bytes32 zkProofHash = zkpManager.generateAccessProof(recordData.recordCounter + 1, msg.sender, a, b, c, publicInputs);

        // Generate access control hash
        bytes32 accessControlHash = keccak256(
            abi.encodePacked(recordData.recordCounter + 1, studentAddress, msg.sender, block.timestamp)
        );

        // Set up authorized users
        address[] memory authorizedUsers = new address[](3);
        authorizedUsers[0] = msg.sender; // Issuing university
        authorizedUsers[1] = studentAddress; // Student
        authorizedUsers[2] = SUPER_ADMIN; // Super admin

        // Use RecordStorage library to add secure record
        uint256 recordId = recordData.addSecureRecord(
            studentId,
            studentName,
            studentAddress,
            universityName,
            encryptedIPFSHash,
            encryptedMetadataHash,
            recordType,
            msg.sender,
            zkProofHash,
            accessControlHash,
            encryptedKey,
            authorizedUsers
        );

        emit SecureRecordAdded(recordId, studentId, recordType, msg.sender, zkProofHash);
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

    // --- Secure Record Retrieval with ZKP ---

    function getSecureRecord(uint256 recordId) external view returns (SecureRecord memory) {
        require(recordData.isRecordSecure(recordId), "Secure record does not exist");
        // Note: This is a view function, so we can't use the library's access-controlled version
        // This should only be used for basic metadata access
        (uint256 id, string memory studentId, string memory studentName, address studentAddress, 
         string memory universityName, RecordType recordType, uint256 timestamp, 
         bool isVerified, address issuer, bool isSecure) = recordData.getRecordMetadata(recordId);
        
        require(isSecure, "Record is not secure");
        
        // Return a SecureRecord with empty encrypted data for security
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
        require(recordData.isRecordSecure(recordId), "Secure record does not exist");
        require(address(zkpManager) != address(0), "ZKP Manager not set");
        require(address(accessManager) != address(0), "Access Manager not set");

        // Verify ZK proof for access
        bool hasZKAccess = zkpManager.verifyAccessProof(proofHash, recordId, msg.sender);
        
        // Check traditional access permissions as fallback
        bool hasTraditionalAccess = accessManager.hasAccess(recordId, msg.sender);

        require(hasZKAccess || hasTraditionalAccess, "Access denied");

        // Get secure record from RecordStorage library (this will log access)
        SecureRecord memory record = recordData.getSecureRecord(recordId, msg.sender);

        // If caller doesn't have owner or admin access, return limited data
        if (!_hasFullAccess(recordId, msg.sender)) {
            record.encryptedIPFSHash = "";
            record.encryptedMetadataHash = "";
        }

        emit AccessLogged(recordId, msg.sender, "VIEW", proofHash, block.timestamp);
        return record;
    }

    function getDecryptedRecord(
        uint256 recordId,
        bytes32 proofHash
    ) external returns (bytes memory encryptedIPFSHash, bytes memory encryptedMetadataHash) {
        require(recordData.isRecordSecure(recordId), "Secure record does not exist");
        require(address(zkpManager) != address(0), "ZKP Manager not set");
        require(address(accessManager) != address(0), "Access Manager not set");
        require(address(keyStorage) != address(0), "Key Storage not set");

        // Verify access permissions
        bool hasZKAccess = zkpManager.verifyAccessProof(proofHash, recordId, msg.sender);
        bool hasTraditionalAccess = accessManager.hasAccess(recordId, msg.sender);

        require(hasZKAccess || hasTraditionalAccess, "Access denied");
        require(_hasFullAccess(recordId, msg.sender), "Insufficient permissions for decryption");

        // Get encrypted data from RecordStorage library (this will log access)
        bytes memory encryptedIPFS = recordData.getEncryptedIPFSHash(recordId, msg.sender);
        bytes memory encryptedMetadata = recordData.getEncryptedMetadataHash(recordId, msg.sender);
        
        emit AccessLogged(recordId, msg.sender, "DOWNLOAD", proofHash, block.timestamp);
        return (encryptedIPFS, encryptedMetadata);
    }

    function getStudentRecords(
        string calldata studentId
    ) external view returns (uint256[] memory) {
        return recordData.studentRecords[studentId];
    }

    function getStudentRecordsByAddress(
        address studentAddress
    ) external view returns (uint256[] memory) {
        string memory studentId = studentManagement.getStudentId(
            studentAddress
        );

        uint256[] memory addressRecords = recordData.getRecordsByStudentAddress(
            studentAddress
        );

        if (bytes(studentId).length == 0) {
            return addressRecords;
        }

        uint256[] memory idRecords = recordData.studentRecords[studentId];

        // Combine array with unique records
        uint256[] memory combinedRecords = new uint256[](
            addressRecords.length + idRecords.length
        );
        uint256 uniqueCount = 0;

        for (uint256 i = 0; i < addressRecords.length; i++) {
            combinedRecords[uniqueCount] = addressRecords[i];
            uniqueCount++;
        }

        for (uint256 i = 0; i < idRecords.length; i++) {
            bool isDuplicate = false;

            for (uint256 j = 0; j < uniqueCount; j++) {
                if (idRecords[i] == combinedRecords[j]) {
                    isDuplicate = true;
                    break;
                }
            }

            if (!isDuplicate) {
                combinedRecords[uniqueCount] = idRecords[i];
                uniqueCount++;
            }
        }

        uint256[] memory result = new uint256[](uniqueCount);
        for (uint256 i = 0; i < uniqueCount; i++) {
            result[i] = combinedRecords[i];
        }

        return result;
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

    // --- Secure Record Sharing with ZKP ---

    function shareSecureRecord(
        uint256 recordId,
        address sharedWith,
        uint256 duration,
        uint256 maxUsage
    ) external returns (bytes32) {
        require(recordData.isRecordSecure(recordId), "Secure record does not exist");
        require(sharedWith != address(0), "Invalid address to share with");
        require(address(zkpManager) != address(0), "ZKP Manager not set");
        require(address(accessManager) != address(0), "Access Manager not set");

        // Get record metadata to check ownership
        (,,,address studentAddress,,,,,,) = recordData.getRecordMetadata(recordId);

        // Only student can share their records
        require(studentAddress == msg.sender, "Not your record");

        // Create sharing token using RecordStorage library
        bytes32 sharingToken = recordData.createSharingToken(
            recordId,
            sharedWith,
            duration,
            maxUsage,
            msg.sender
        );

        uint256 expiryTime = duration > 0 ? block.timestamp + duration : 0;
        emit SharingTokenCreated(recordId, msg.sender, sharedWith, sharingToken, expiryTime);
        return sharingToken;
    }

    function revokeSecureRecordAccess(uint256 recordId, address user) external {
        require(recordData.isRecordSecure(recordId), "Secure record does not exist");
        require(address(accessManager) != address(0), "Access Manager not set");

        // Get record metadata to check ownership
        (,,,address studentAddress,,,,,address issuer,) = recordData.getRecordMetadata(recordId);

        // Only student or issuer can revoke access
        require(
            studentAddress == msg.sender || issuer == msg.sender,
            "Not authorized to revoke access"
        );

        // Use RecordStorage library to revoke access (handles both AccessManager and KeyStorage)
        recordData.revokeSecureAccess(recordId, user, msg.sender);

        emit AccessPermissionRevoked(recordId, user, AccessType.SHARED);
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

    // --- Access Control Helpers ---

    function _hasFullAccess(uint256 recordId, address accessor) internal view returns (bool) {
        if (!recordData.isRecordSecure(recordId)) return false;

        // Get record metadata
        (,,,address studentAddress,,,,,address issuer,) = recordData.getRecordMetadata(recordId);

        // Owner (student) has full access
        if (studentAddress == accessor) return true;

        // Issuer (university) has full access
        if (issuer == accessor) return true;

        // Super admin has full access
        if (accessor == SUPER_ADMIN) return true;

        // Admin role has full access
        if (hasRole(ADMIN_ROLE, accessor)) return true;

        return false;
    }

    function hasSecureRecordAccess(uint256 recordId, address accessor) external view returns (bool) {
        if (address(accessManager) == address(0)) return false;
        return accessManager.hasAccess(recordId, accessor);
    }

    function getSecureRecordAccessHistory(uint256 recordId) external view returns (IAccessManager.AccessLog[] memory) {
        require(recordData.isRecordSecure(recordId), "Secure record does not exist");
        require(address(accessManager) != address(0), "Access Manager not set");
        require(_hasFullAccess(recordId, msg.sender), "Not authorized to view access history");

        return accessManager.getAccessHistory(recordId);
    }

    function validateSharingToken(
        uint256 recordId,
        bytes32 token,
        address accessor
    ) external returns (bool) {
        if (address(accessManager) == address(0)) return false;
        return accessManager.validateSharingToken(token, recordId, accessor);
    }

    // --- Emergency Access ---

    function emergencyAccess(
        uint256 recordId,
        string calldata reason
    ) external onlyRole(SUPER_ADMIN_ROLE) returns (SecureRecord memory) {
        require(recordData.isRecordSecure(recordId), "Secure record does not exist");
        require(bytes(reason).length > 0, "Emergency reason required");

        if (address(accessManager) != address(0)) {
            accessManager.logAccess(recordId, msg.sender, "EMERGENCY_ACCESS", bytes32(0));
        }

        emit EmergencyAccess(recordId, msg.sender, reason, block.timestamp);
        
        // Get secure record from RecordStorage library
        SecureRecord memory record = recordData.getSecureRecord(recordId, msg.sender);
        return record;
    }

    // --- Key Management ---

    function rotateRecordKey(
        uint256 recordId,
        bytes calldata newEncryptedKey
    ) external {
        require(recordData.isRecordSecure(recordId), "Secure record does not exist");
        require(address(keyStorage) != address(0), "Key Storage not set");

        // Get record metadata to check ownership
        (,,,,,,,,address issuer,) = recordData.getRecordMetadata(recordId);

        // Only issuer or super admin can rotate keys
        require(
            issuer == msg.sender || msg.sender == SUPER_ADMIN,
            "Not authorized to rotate key"
        );

        keyStorage.rotateKey(recordId, newEncryptedKey);
        emit EncryptionKeyRotated(recordId, msg.sender, block.timestamp);
    }

    // --- Utility Functions ---

    function getTotalRecords() external view returns (uint256) {
        return recordData.recordCounter;
    }

    function getTotalSecureRecords() external view returns (uint256) {
        // Count secure records from the total record counter
        uint256 secureCount = 0;
        for (uint256 i = 1; i <= recordData.recordCounter; i++) {
            if (recordData.isRecordSecure(i)) {
                secureCount++;
            }
        }
        return secureCount;
    }

    function getTotalCustomTypes() external view returns (uint256) {
        return customTypeData.customTypeCounter;
    }

    function getZKPContracts() external view returns (address, address, address) {
        return (address(zkpManager), address(accessManager), address(keyStorage));
    }
}
