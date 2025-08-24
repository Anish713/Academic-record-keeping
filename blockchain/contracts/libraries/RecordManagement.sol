// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../interfaces/IAcademicRecords.sol";
import "../interfaces/IZKPManager.sol";
import "../interfaces/IAccessManager.sol";
import "../interfaces/IKeyStorage.sol";
import "./RecordStorage.sol";
import "../modules/StudentManagement.sol";

/**
 * @title RecordManagement
 * @dev Library for record management operations to reduce main contract size
 */
library RecordManagement {
    using RecordStorage for RecordStorage.RecordData;

    event RecordAdded(uint256 indexed recordId, string indexed studentId, IAcademicRecords.RecordType recordType, address indexed issuer);
    event SecureRecordAdded(uint256 indexed recordId, string indexed studentId, IAcademicRecords.RecordType recordType, address indexed issuer, bytes32 zkProofHash);

    /**
     * @dev Add regular record
     */
    function addRecord(
        RecordStorage.RecordData storage recordData,
        string calldata studentId,
        string calldata studentName,
        address studentAddress,
        string calldata universityName,
        string calldata ipfsHash,
        string calldata metadataHash,
        IAcademicRecords.RecordType recordType,
        address issuer,
        StudentManagement studentManagement
    ) external returns (uint256) {
        require(studentAddress != address(0), "Invalid student");

        _registerStudentIfNeeded(studentId, studentAddress, studentManagement);

        uint256 recordId = recordData.addRecord(
            studentId,
            studentName,
            studentAddress,
            universityName,
            ipfsHash,
            metadataHash,
            recordType,
            issuer
        );

        emit RecordAdded(recordId, studentId, recordType, issuer);
        return recordId;
    }

    /**
     * @dev Add secure record
     */
    function addSecureRecord(
        RecordStorage.RecordData storage recordData,
        string calldata studentId,
        string calldata studentName,
        address studentAddress,
        string calldata universityName,
        bytes calldata encryptedIPFSHash,
        bytes calldata encryptedMetadataHash,
        bytes calldata encryptedKey,
        IAcademicRecords.RecordType recordType,
        address issuer,
        address superAdmin,
        StudentManagement studentManagement,
        IZKPManager zkpManager
    ) external returns (uint256) {
        require(studentAddress != address(0) && encryptedIPFSHash.length > 0, "Invalid input");
        require(address(zkpManager) != address(0), "ZKP not set");

        _registerStudentIfNeeded(studentId, studentAddress, studentManagement);

        // Generate ZK proof and access control hashes
        bytes32 zkProofHash = _generateZKProof(recordData.recordCounter + 1, issuer, zkpManager);
        bytes32 accessControlHash = keccak256(abi.encodePacked(recordData.recordCounter + 1, studentAddress, issuer, block.timestamp));

        // Set up authorized users
        address[] memory authorizedUsers = new address[](3);
        authorizedUsers[0] = issuer;
        authorizedUsers[1] = studentAddress;
        authorizedUsers[2] = superAdmin;

        uint256 recordId = recordData.addSecureRecord(
            studentId,
            studentName,
            studentAddress,
            universityName,
            encryptedIPFSHash,
            encryptedMetadataHash,
            recordType,
            issuer,
            zkProofHash,
            accessControlHash,
            encryptedKey,
            authorizedUsers
        );

        emit SecureRecordAdded(recordId, studentId, recordType, issuer, zkProofHash);
        return recordId;
    }

    /**
     * @dev Register student if needed
     */
    function _registerStudentIfNeeded(
        string memory studentId, 
        address studentAddress, 
        StudentManagement studentManagement
    ) internal {
        string memory existingStudentId = studentManagement.addressToStudentId(studentAddress);
        if (bytes(existingStudentId).length == 0) {
            studentManagement.registerStudent(studentId, studentAddress);
        }
    }

    /**
     * @dev Generate ZK proof
     */
    function _generateZKProof(
        uint256 recordId, 
        address issuer, 
        IZKPManager zkpManager
    ) internal returns (bytes32) {
        uint[2] memory a = [uint(0), uint(0)];
        uint[2][2] memory b = [[uint(0), uint(0)], [uint(0), uint(0)]];
        uint[2] memory c = [uint(0), uint(0)];
        uint[2] memory publicInputs = [uint(recordId), uint(uint160(issuer))];
        
        return zkpManager.generateAccessProof(recordId, issuer, a, b, c, publicInputs);
    }
}