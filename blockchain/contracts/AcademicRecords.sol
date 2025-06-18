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
    
    // Record types
    enum RecordType { TRANSCRIPT, CERTIFICATE, DEGREE, OTHER }
    
    // Academic record structure
    struct Record {
        uint256 id;
        string studentId;
        string studentName;
        string universityName;
        string ipfsHash;       // Hash of the document stored on IPFS
        string metadataHash;   // Hash of additional metadata
        RecordType recordType;
        uint256 timestamp;
        bool isVerified;
        address issuer;
    }
    
    // Mapping from record ID to Record
    mapping(uint256 => Record) private _records;
    
    // Mapping from student ID to their record IDs
    mapping(string => uint256[]) private _studentRecords;
    
    // Mapping from university to their issued record IDs
    mapping(address => uint256[]) private _universityRecords;
    
    // Events
    event RecordAdded(uint256 indexed recordId, string studentId, RecordType recordType, address issuer);
    event RecordVerified(uint256 indexed recordId, address verifier);
    event RecordAccessed(uint256 indexed recordId, address accessor);
    
    /**
     * @dev Constructor sets up admin role for the deployer
     */
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }
    
    /**
     * @dev Adds a university to the system
     * @param universityAddress Address of the university
     */
    function addUniversity(address universityAddress) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        grantRole(UNIVERSITY_ROLE, universityAddress);
    }
    
    /**
     * @dev Removes a university from the system
     * @param universityAddress Address of the university
     */
    function removeUniversity(address universityAddress) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        revokeRole(UNIVERSITY_ROLE, universityAddress);
    }
    
    /**
     * @dev Adds an academic record to the blockchain
     * @param studentId ID of the student
     * @param studentName Name of the student
     * @param universityName Name of the university
     * @param ipfsHash IPFS hash of the document
     * @param metadataHash Hash of additional metadata
     * @param recordType Type of the record
     * @return recordId The ID of the newly created record
     */
    function addRecord(
        string calldata studentId,
        string calldata studentName,
        string calldata universityName,
        string calldata ipfsHash,
        string calldata metadataHash,
        RecordType recordType
    ) 
        external 
        onlyRole(UNIVERSITY_ROLE) 
        whenNotPaused 
        returns (uint256) 
    {
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
    
    /**
     * @dev Gets a record by ID
     * @param recordId ID of the record
     * @return Record The academic record
     */
    function getRecord(uint256 recordId) 
        external 
        view 
        returns (Record memory) 
    {
        require(_records[recordId].id == recordId, "Record does not exist");
        return _records[recordId];
    }
    
    /**
     * @dev Gets all records for a student
     * @param studentId ID of the student
     * @return uint256[] Array of record IDs
     */
    function getStudentRecords(string calldata studentId) 
        external 
        view 
        returns (uint256[] memory) 
    {
        return _studentRecords[studentId];
    }
    
    /**
     * @dev Gets all records issued by a university
     * @return uint256[] Array of record IDs
     */
    function getUniversityRecords() 
        external 
        view 
        onlyRole(UNIVERSITY_ROLE) 
        returns (uint256[] memory) 
    {
        return _universityRecords[msg.sender];
    }
    
    /**
     * @dev Verifies the authenticity of a record
     * @param recordId ID of the record to verify
     * @return bool True if the record is verified
     */
    function verifyRecord(uint256 recordId) 
        external 
        view 
        returns (bool) 
    {
        require(_records[recordId].id == recordId, "Record does not exist");
        return _records[recordId].isVerified;
    }
    
    /**
     * @dev Pauses all record additions
     */
    function pause() 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        _pause();
    }
    
    /**
     * @dev Unpauses record additions
     */
    function unpause() 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        _unpause();
    }
    
    /**
     * @dev Records an access to a document
     * @param recordId ID of the accessed record
     */
    function recordAccess(uint256 recordId) 
        external 
    {
        require(_records[recordId].id == recordId, "Record does not exist");
        emit RecordAccessed(recordId, msg.sender);
    }
}