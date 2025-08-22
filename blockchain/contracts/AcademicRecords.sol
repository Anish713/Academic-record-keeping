// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/security/Pausable.sol";
import "./interfaces/IAcademicRecords.sol";
import "./interfaces/IZKAccessControl.sol";
import "./abstract/RoleManager.sol";
import "./libraries/RecordStorage.sol";
import "./modules/StudentManagement.sol";

contract AcademicRecords is IAcademicRecords, RoleManager, Pausable {
    using RecordStorage for RecordStorage.RecordData;
    using RecordStorage for RecordStorage.CustomTypeData;

    RecordStorage.RecordData private recordData;
    RecordStorage.CustomTypeData private customTypeData;
    StudentManagement public studentManagement;
    IZKAccessControl public zkAccessControl;

    constructor() RoleManager() {
        studentManagement = new StudentManagement();
    }

    /**
     * @dev Set the ZK Access Control contract address
     * @param _zkAccessControl Address of the ZK Access Control contract
     */
    function setZKAccessControl(address _zkAccessControl) external onlyAdminOrSuper {
        require(_zkAccessControl != address(0), "Invalid ZK Access Control address");
        zkAccessControl = IZKAccessControl(_zkAccessControl);
        emit ZKAccessControlSet(_zkAccessControl);
    }

    // --- Encryption/Decryption Helper Functions ---

    /**
     * @dev Encrypt IPFS hash using student address and record ID
     * @param ipfsHash The IPFS hash to encrypt
     * @param studentAddress The student's address
     * @param recordId The record ID
     * @return bytes32 Encrypted IPFS hash
     */
    function _encryptIPFSHash(
        string memory ipfsHash,
        address studentAddress,
        uint256 recordId
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(ipfsHash, studentAddress, recordId, "IPFS"));
    }

    /**
     * @dev Encrypt metadata hash using student address and record ID
     * @param metadataHash The metadata hash to encrypt
     * @param studentAddress The student's address
     * @param recordId The record ID
     * @return bytes32 Encrypted metadata hash
     */
    function _encryptMetadataHash(
        string memory metadataHash,
        address studentAddress,
        uint256 recordId
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(metadataHash, studentAddress, recordId, "METADATA"));
    }

    /**
     * @dev Generate merkle root for access control
     * @param studentAddress The student's address
     * @param recordId The record ID
     * @return bytes32 Merkle root
     */
    function _generateMerkleRoot(
        address studentAddress,
        uint256 recordId
    ) internal view returns (bytes32) {
        // Simple merkle root generation - in production, this would be more sophisticated
        return keccak256(abi.encodePacked(studentAddress, recordId, msg.sender, block.timestamp));
    }

    /**
     * @dev Decrypt IPFS hash (placeholder - actual decryption would happen off-chain)
     * @param encryptedHash The encrypted hash
     * @param originalHash The original IPFS hash for verification
     * @param studentAddress The student's address
     * @param recordId The record ID
     * @return string The decrypted IPFS hash
     */
    function _decryptIPFSHash(
        bytes32 encryptedHash,
        string memory originalHash,
        address studentAddress,
        uint256 recordId
    ) internal pure returns (string memory) {
        // Verify the encrypted hash matches what we expect
        bytes32 expectedHash = _encryptIPFSHash(originalHash, studentAddress, recordId);
        require(encryptedHash == expectedHash, "Invalid encrypted hash");
        return originalHash;
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
        require(bytes(ipfsHash).length > 0, "Invalid IPFS hash");

        string memory existingStudentId = studentManagement.addressToStudentId(
            studentAddress
        );
        if (bytes(existingStudentId).length == 0) {
            studentManagement.registerStudent(studentId, studentAddress);
        }

        // Store record with empty hashes in main contract
        uint256 recordId = recordData.addRecord(
            studentId,
            studentName,
            studentAddress,
            universityName,
            "", // Empty IPFS hash - stored encrypted in ZK contract
            "", // Empty metadata hash - stored encrypted in ZK contract
            recordType,
            msg.sender
        );

        // Store encrypted hashes in ZK Access Control contract if available
        if (address(zkAccessControl) != address(0)) {
            bytes32 encryptedIPFSHash = _encryptIPFSHash(ipfsHash, studentAddress, recordId);
            bytes32 encryptedMetadataHash = _encryptMetadataHash(metadataHash, studentAddress, recordId);
            bytes32 merkleRoot = _generateMerkleRoot(studentAddress, recordId);

            zkAccessControl.storeEncryptedRecord(
                recordId,
                encryptedIPFSHash,
                encryptedMetadataHash,
                merkleRoot,
                studentAddress
            );

            // Grant access to the issuing university
            bytes32 universityAccessKey = keccak256(abi.encodePacked(msg.sender, recordId, "UNIVERSITY"));
            zkAccessControl.grantAccess(
                recordId,
                msg.sender,
                universityAccessKey,
                type(uint256).max // Permanent access for university
            );
        } else {
            // Fallback: store hashes directly in main contract for backward compatibility
            recordData.records[recordId].ipfsHash = ipfsHash;
            recordData.records[recordId].metadataHash = metadataHash;
        }

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

    /**
     * @dev Get record with ZK proof verification
     * @param recordId The ID of the record
     * @param _pA Proof component A
     * @param _pB Proof component B
     * @param _pC Proof component C
     * @param publicSignals Public signals for the proof
     * @param originalIPFSHash Original IPFS hash for decryption verification
     * @return record The record data
     * @return decryptedIPFSHash The decrypted IPFS hash if access is granted
     */
    function getRecordWithZKProof(
        uint256 recordId,
        uint[2] memory _pA,
        uint[2][2] memory _pB,
        uint[2] memory _pC,
        uint[3] memory publicSignals,
        string memory originalIPFSHash
    ) external view returns (Record memory record, string memory decryptedIPFSHash) {
        require(
            recordData.records[recordId].id == recordId,
            "Record does not exist"
        );
        require(address(zkAccessControl) != address(0), "ZK Access Control not configured");

        record = recordData.records[recordId];

        // Verify ZK proof for access
        if (zkAccessControl.verifyAccess(recordId, _pA, _pB, _pC, publicSignals)) {
            // Get encrypted hash from ZK contract
            IZKAccessControl.EncryptedRecord memory encryptedRecord = zkAccessControl.getEncryptedRecord(recordId);
            
            // Decrypt the IPFS hash
            decryptedIPFSHash = _decryptIPFSHash(
                encryptedRecord.encryptedIPFSHash,
                originalIPFSHash,
                record.studentAddress,
                recordId
            );
        } else {
            // No access granted
            decryptedIPFSHash = "";
        }

        return (record, decryptedIPFSHash);
    }

    /**
     * @dev Get records accessible by user through ZK access control
     * @param userAddress Address of the user
     * @return uint256[] Array of accessible record IDs
     */
    function getRecordsWithZKAccess(address userAddress) external view returns (uint256[] memory) {
        require(address(zkAccessControl) != address(0), "ZK Access Control not configured");
        return zkAccessControl.getUserAccessibleRecords(userAddress);
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
        require(sharedWith != address(0), "Invalid address to share with");

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

        // Share in traditional storage
        recordData.shareRecord(recordId, sharedWith, studentId);

        // Grant ZK access if ZK Access Control is configured
        if (address(zkAccessControl) != address(0)) {
            // Generate access key for the shared user
            bytes32 accessKey = keccak256(abi.encodePacked(sharedWith, recordId, block.timestamp, "SHARED"));
            
            // Grant access with 1 year validity (can be customized)
            uint256 validUntil = block.timestamp + 365 days;
            
            zkAccessControl.grantAccess(recordId, sharedWith, accessKey, validUntil);
            
            // Update merkle root to include new user
            bytes32 newMerkleRoot = keccak256(abi.encodePacked(
                recordData.records[recordId].studentAddress,
                recordId,
                sharedWith,
                block.timestamp
            ));
            zkAccessControl.updateMerkleRoot(recordId, newMerkleRoot);
        }

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

        // Unshare in traditional storage
        recordData.unshareRecord(recordId, sharedWith, studentId);

        // Revoke ZK access if ZK Access Control is configured
        if (address(zkAccessControl) != address(0)) {
            zkAccessControl.revokeAccess(recordId, sharedWith);
            
            // Update merkle root to remove user
            bytes32 newMerkleRoot = keccak256(abi.encodePacked(
                recordData.records[recordId].studentAddress,
                recordId,
                block.timestamp,
                "UNSHARED"
            ));
            zkAccessControl.updateMerkleRoot(recordId, newMerkleRoot);
        }

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
