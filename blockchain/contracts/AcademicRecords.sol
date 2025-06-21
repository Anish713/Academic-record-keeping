// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title AcademicRecords
 * @dev Contract for storing and managing academic records on the blockchain
 */
contract AcademicRecords is AccessControl, Pausable {
    using Counters for Counters.Counter;

    bytes32 public constant UNIVERSITY_ROLE = keccak256("UNIVERSITY_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    Counters.Counter private _recordIdCounter;

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

    mapping(uint256 => Record) private _records;
    mapping(string => uint256[]) private _studentRecords;
    mapping(address => uint256[]) private _universityRecords;

    // University name registry
    mapping(address => string) private _universityNames;
    address[] private _universityList;

    // Events
    event RecordAdded(
        uint256 indexed recordId,
        string studentId,
        RecordType recordType,
        address issuer
    );
    event RecordVerified(uint256 indexed recordId, address verifier);
    event RecordAccessed(uint256 indexed recordId, address accessor);
    event UniversityNameUpdated(address indexed university, string name);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    // --- University Management ---

    function addUniversity(
        address universityAddress,
        string calldata name
    ) external onlyRole(ADMIN_ROLE) {
        require(
            !hasRole(UNIVERSITY_ROLE, universityAddress),
            "Already a university"
        );
        grantRole(UNIVERSITY_ROLE, universityAddress);
        _universityNames[universityAddress] = name;
        _universityList.push(universityAddress);

        emit UniversityNameUpdated(universityAddress, name);
    }

    function removeUniversity(
        address universityAddress
    ) external onlyRole(ADMIN_ROLE) {
        revokeRole(UNIVERSITY_ROLE, universityAddress);
        delete _universityNames[universityAddress];

        // Optional: Remove from _universityList (inefficient but safe)
        for (uint i = 0; i < _universityList.length; i++) {
            if (_universityList[i] == universityAddress) {
                _universityList[i] = _universityList[
                    _universityList.length - 1
                ];
                _universityList.pop();
                break;
            }
        }
    }

    function setUniversityName(
        address universityAddress,
        string calldata name
    ) external {
        require(
            hasRole(ADMIN_ROLE, msg.sender) || msg.sender == universityAddress,
            "Not authorized to set name"
        );
        require(
            hasRole(UNIVERSITY_ROLE, universityAddress),
            "Address is not a university"
        );

        _universityNames[universityAddress] = name;
        emit UniversityNameUpdated(universityAddress, name);
    }

    function getUniversityName(
        address universityAddress
    ) external view returns (string memory) {
        return _universityNames[universityAddress];
    }

    function getAllUniversities() external view returns (address[] memory) {
        return _universityList;
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
        _recordIdCounter.increment();
        uint256 recordId = _recordIdCounter.current();

        Record memory newRecord = Record({
            id: recordId,
            studentId: studentId,
            studentName: studentName,
            universityName: universityName,
            ipfsHash: ipfsHash,
            metadataHash: metadataHash,
            recordType: recordType,
            timestamp: block.timestamp,
            isVerified: true,  // Records added by universities are auto-verified
            issuer: msg.sender
        });

        _records[recordId] = newRecord;
        _studentRecords[studentId].push(recordId);
        _universityRecords[msg.sender].push(recordId);

        emit RecordAdded(recordId, studentId, recordType, msg.sender);

        return recordId;
    }

    function getRecord(uint256 recordId) external view returns (Record memory) {
        require(_records[recordId].id == recordId, "Record does not exist");
        return _records[recordId];
    }

    function getStudentRecords(
        string calldata studentId
    ) external view returns (uint256[] memory) {
        return _studentRecords[studentId];
    }

    function getUniversityRecords()
        external
        view
        onlyRole(UNIVERSITY_ROLE)
        returns (uint256[] memory)
    {
        return _universityRecords[msg.sender];
    }

    function verifyRecord(uint256 recordId) external view returns (bool) {
        require(_records[recordId].id == recordId, "Record does not exist");
        return _records[recordId].isVerified;
    }

    // --- Access Tracking ---

    function recordAccess(uint256 recordId) external {
        require(_records[recordId].id == recordId, "Record does not exist");
        emit RecordAccessed(recordId, msg.sender);
    }

    // --- Pause Controls ---

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
}
