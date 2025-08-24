// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../interfaces/IAcademicRecords.sol";
import "../interfaces/IKeyStorage.sol";
import "../interfaces/IAccessManager.sol";

library RecordStorage {
    struct RecordData {
        mapping(uint256 => IAcademicRecords.Record) records;
        mapping(uint256 => IAcademicRecords.SecureRecord) secureRecords;
        mapping(string => uint256[]) studentRecords;
        mapping(address => uint256[]) universityRecords;
        mapping(uint256 => mapping(address => bool)) recordSharedWith;
        mapping(string => mapping(address => uint256[])) studentSharedRecords;
        mapping(uint256 => bool) isSecureRecord; // Track which records use encryption
        uint256 recordCounter;
        IKeyStorage keyStorage;
        IAccessManager accessManager;
    }

    struct CustomTypeData {
        mapping(uint256 => IAcademicRecords.CustomRecordType) customTypes;
        mapping(address => uint256[]) universityCustomTypes;
        uint256 customTypeCounter;
    }

    // Custom errors
    error UnauthorizedAccess(uint256 recordId, address accessor);
    error RecordNotFound(uint256 recordId);
    error EncryptionFailed(uint256 recordId);
    error DecryptionFailed(uint256 recordId);
    error InvalidEncryptedData();
    error KeyStorageNotSet();
    error AccessManagerNotSet();

    // Events
    event SecureRecordStored(uint256 indexed recordId, address indexed issuer, bytes32 zkProofHash);
    event EncryptedDataAccessed(uint256 indexed recordId, address indexed accessor, string action);
    event MetadataDecrypted(uint256 indexed recordId, address indexed accessor);

    /**
     * @dev Initialize the RecordData with KeyStorage and AccessManager contracts
     * @param self The RecordData storage
     * @param _keyStorage Address of the KeyStorage contract
     * @param _accessManager Address of the AccessManager contract
     */
    function initialize(
        RecordData storage self,
        address _keyStorage,
        address _accessManager
    ) external {
        if (_keyStorage == address(0) || _accessManager == address(0)) {
            revert InvalidEncryptedData();
        }
        self.keyStorage = IKeyStorage(_keyStorage);
        self.accessManager = IAccessManager(_accessManager);
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
        self.isSecureRecord[recordId] = false;

        return recordId;
    }

    /**
     * @dev Add a secure record with encrypted IPFS hash and metadata
     * @param self The RecordData storage
     * @param studentId Student identifier
     * @param studentName Student name
     * @param studentAddress Student wallet address
     * @param universityName University name
     * @param encryptedIPFSHash Encrypted IPFS hash
     * @param encryptedMetadataHash Encrypted metadata hash
     * @param recordType Type of record
     * @param issuer Address of the issuer
     * @param zkProofHash ZK proof hash for authenticity
     * @param accessControlHash Hash for access control verification
     * @param encryptionKey Encrypted key for this record
     * @param authorizedUsers Array of addresses authorized to access this record
     * @return recordId The ID of the created record
     */
    function addSecureRecord(
        RecordData storage self,
        string calldata studentId,
        string calldata studentName,
        address studentAddress,
        string calldata universityName,
        bytes calldata encryptedIPFSHash,
        bytes calldata encryptedMetadataHash,
        IAcademicRecords.RecordType recordType,
        address issuer,
        bytes32 zkProofHash,
        bytes32 accessControlHash,
        bytes calldata encryptionKey,
        address[] calldata authorizedUsers
    ) external returns (uint256) {
        if (address(self.keyStorage) == address(0)) {
            revert KeyStorageNotSet();
        }
        if (address(self.accessManager) == address(0)) {
            revert AccessManagerNotSet();
        }
        if (encryptedIPFSHash.length == 0 || encryptedMetadataHash.length == 0) {
            revert InvalidEncryptedData();
        }

        self.recordCounter++;
        uint256 recordId = self.recordCounter;

        // Create secure record
        IAcademicRecords.SecureRecord memory newSecureRecord = IAcademicRecords.SecureRecord({
            id: recordId,
            studentId: studentId,
            studentName: studentName,
            studentAddress: studentAddress,
            universityName: universityName,
            encryptedIPFSHash: encryptedIPFSHash,
            encryptedMetadataHash: encryptedMetadataHash,
            zkProofHash: zkProofHash,
            recordType: recordType,
            timestamp: block.timestamp,
            isVerified: true,
            issuer: issuer,
            accessControlHash: accessControlHash
        });

        // Store the secure record
        self.secureRecords[recordId] = newSecureRecord;
        self.studentRecords[studentId].push(recordId);
        self.universityRecords[issuer].push(recordId);
        self.isSecureRecord[recordId] = true;

        // Store encryption key with authorized users
        self.keyStorage.storeEncryptedKey(recordId, encryptionKey, authorizedUsers);

        // Grant access permissions to authorized users
        for (uint256 i = 0; i < authorizedUsers.length; i++) {
            if (authorizedUsers[i] == studentAddress) {
                self.accessManager.grantAccessWithDefaultDuration(
                    recordId,
                    authorizedUsers[i],
                    IAccessManager.AccessType.OWNER
                );
            } else if (authorizedUsers[i] == issuer) {
                self.accessManager.grantAccessWithDefaultDuration(
                    recordId,
                    authorizedUsers[i],
                    IAccessManager.AccessType.ADMIN
                );
            } else {
                self.accessManager.grantAccessWithDefaultDuration(
                    recordId,
                    authorizedUsers[i],
                    IAccessManager.AccessType.SHARED
                );
            }
        }

        emit SecureRecordStored(recordId, issuer, zkProofHash);
        return recordId;
    }

    /**
     * @dev Get encrypted IPFS hash for authorized accessor
     * @param self The RecordData storage
     * @param recordId The ID of the record
     * @param accessor The address requesting access
     * @return The encrypted IPFS hash
     */
    function getEncryptedIPFSHash(
        RecordData storage self,
        uint256 recordId,
        address accessor
    ) external returns (bytes memory) {
        if (!self.isSecureRecord[recordId]) {
            revert RecordNotFound(recordId);
        }
        if (address(self.accessManager) == address(0)) {
            revert AccessManagerNotSet();
        }

        // Check access permission
        if (!self.accessManager.hasAccess(recordId, accessor)) {
            revert UnauthorizedAccess(recordId, accessor);
        }

        // Log access
        self.accessManager.logAccess(recordId, accessor, "IPFS_HASH_ACCESS", bytes32(0));
        emit EncryptedDataAccessed(recordId, accessor, "IPFS_HASH_ACCESS");

        return self.secureRecords[recordId].encryptedIPFSHash;
    }

    /**
     * @dev Get encrypted metadata hash for authorized accessor
     * @param self The RecordData storage
     * @param recordId The ID of the record
     * @param accessor The address requesting access
     * @return The encrypted metadata hash
     */
    function getEncryptedMetadataHash(
        RecordData storage self,
        uint256 recordId,
        address accessor
    ) external returns (bytes memory) {
        if (!self.isSecureRecord[recordId]) {
            revert RecordNotFound(recordId);
        }
        if (address(self.accessManager) == address(0)) {
            revert AccessManagerNotSet();
        }

        // Check access permission
        if (!self.accessManager.hasAccess(recordId, accessor)) {
            revert UnauthorizedAccess(recordId, accessor);
        }

        // Log access
        self.accessManager.logAccess(recordId, accessor, "METADATA_ACCESS", bytes32(0));
        emit EncryptedDataAccessed(recordId, accessor, "METADATA_ACCESS");

        return self.secureRecords[recordId].encryptedMetadataHash;
    }

    /**
     * @dev Get secure record for authorized accessor
     * @param self The RecordData storage
     * @param recordId The ID of the record
     * @param accessor The address requesting access
     * @return The secure record
     */
    function getSecureRecord(
        RecordData storage self,
        uint256 recordId,
        address accessor
    ) external returns (IAcademicRecords.SecureRecord memory) {
        if (!self.isSecureRecord[recordId]) {
            revert RecordNotFound(recordId);
        }
        if (address(self.accessManager) == address(0)) {
            revert AccessManagerNotSet();
        }

        // Check access permission
        if (!self.accessManager.hasAccess(recordId, accessor)) {
            revert UnauthorizedAccess(recordId, accessor);
        }

        // Log access
        self.accessManager.logAccess(recordId, accessor, "RECORD_ACCESS", bytes32(0));
        emit EncryptedDataAccessed(recordId, accessor, "RECORD_ACCESS");

        return self.secureRecords[recordId];
    }

    /**
     * @dev Get encryption key for authorized accessor
     * @param self The RecordData storage
     * @param recordId The ID of the record
     * @param accessor The address requesting access
     * @return The encrypted key data
     */
    function getEncryptionKey(
        RecordData storage self,
        uint256 recordId,
        address accessor
    ) external returns (bytes memory) {
        if (!self.isSecureRecord[recordId]) {
            revert RecordNotFound(recordId);
        }
        if (address(self.keyStorage) == address(0)) {
            revert KeyStorageNotSet();
        }
        if (address(self.accessManager) == address(0)) {
            revert AccessManagerNotSet();
        }

        // Check access permission
        if (!self.accessManager.hasAccess(recordId, accessor)) {
            revert UnauthorizedAccess(recordId, accessor);
        }

        // Get key from KeyStorage (this will also log access)
        bytes memory encryptionKey = self.keyStorage.getEncryptedKeyWithLogging(recordId);
        
        // Log access in AccessManager
        self.accessManager.logAccess(recordId, accessor, "KEY_ACCESS", bytes32(0));
        emit EncryptedDataAccessed(recordId, accessor, "KEY_ACCESS");

        return encryptionKey;
    }

    /**
     * @dev Update encrypted IPFS hash (for key rotation scenarios)
     * @param self The RecordData storage
     * @param recordId The ID of the record
     * @param newEncryptedIPFSHash New encrypted IPFS hash
     * @param accessor The address performing the update
     */
    function updateEncryptedIPFSHash(
        RecordData storage self,
        uint256 recordId,
        bytes calldata newEncryptedIPFSHash,
        address accessor
    ) external {
        if (!self.isSecureRecord[recordId]) {
            revert RecordNotFound(recordId);
        }
        if (address(self.accessManager) == address(0)) {
            revert AccessManagerNotSet();
        }

        // Only issuer or admin can update encrypted data
        IAcademicRecords.SecureRecord storage record = self.secureRecords[recordId];
        if (accessor != record.issuer && !self.accessManager.hasAccess(recordId, accessor)) {
            revert UnauthorizedAccess(recordId, accessor);
        }

        if (newEncryptedIPFSHash.length == 0) {
            revert InvalidEncryptedData();
        }

        record.encryptedIPFSHash = newEncryptedIPFSHash;
        
        // Log the update
        self.accessManager.logAccess(recordId, accessor, "IPFS_HASH_UPDATE", bytes32(0));
        emit EncryptedDataAccessed(recordId, accessor, "IPFS_HASH_UPDATE");
    }

    /**
     * @dev Update encrypted metadata hash (for key rotation scenarios)
     * @param self The RecordData storage
     * @param recordId The ID of the record
     * @param newEncryptedMetadataHash New encrypted metadata hash
     * @param accessor The address performing the update
     */
    function updateEncryptedMetadataHash(
        RecordData storage self,
        uint256 recordId,
        bytes calldata newEncryptedMetadataHash,
        address accessor
    ) external {
        if (!self.isSecureRecord[recordId]) {
            revert RecordNotFound(recordId);
        }
        if (address(self.accessManager) == address(0)) {
            revert AccessManagerNotSet();
        }

        // Only issuer or admin can update encrypted data
        IAcademicRecords.SecureRecord storage record = self.secureRecords[recordId];
        if (accessor != record.issuer && !self.accessManager.hasAccess(recordId, accessor)) {
            revert UnauthorizedAccess(recordId, accessor);
        }

        if (newEncryptedMetadataHash.length == 0) {
            revert InvalidEncryptedData();
        }

        record.encryptedMetadataHash = newEncryptedMetadataHash;
        
        // Log the update
        self.accessManager.logAccess(recordId, accessor, "METADATA_UPDATE", bytes32(0));
        emit EncryptedDataAccessed(recordId, accessor, "METADATA_UPDATE");
    }

    /**
     * @dev Check if a record is secure (uses encryption)
     * @param self The RecordData storage
     * @param recordId The ID of the record
     * @return True if record uses encryption
     */
    function isRecordSecure(
        RecordData storage self,
        uint256 recordId
    ) external view returns (bool) {
        return self.isSecureRecord[recordId];
    }

    /**
     * @dev Grant access to encrypted record data
     * @param self The RecordData storage
     * @param recordId The ID of the record
     * @param accessor The address to grant access to
     * @param duration Duration of access in seconds
     * @param accessType Type of access being granted
     * @param grantor The address granting access
     */
    function grantSecureAccess(
        RecordData storage self,
        uint256 recordId,
        address accessor,
        uint256 duration,
        IAccessManager.AccessType accessType,
        address grantor
    ) external {
        if (!self.isSecureRecord[recordId]) {
            revert RecordNotFound(recordId);
        }
        if (address(self.accessManager) == address(0)) {
            revert AccessManagerNotSet();
        }
        if (address(self.keyStorage) == address(0)) {
            revert KeyStorageNotSet();
        }

        // Verify grantor has permission to grant access
        IAcademicRecords.SecureRecord storage record = self.secureRecords[recordId];
        if (grantor != record.issuer && grantor != record.studentAddress && 
            !self.accessManager.hasAccess(recordId, grantor)) {
            revert UnauthorizedAccess(recordId, grantor);
        }

        // Grant access in AccessManager
        self.accessManager.grantAccess(recordId, accessor, duration, accessType);

        // Update key access in KeyStorage
        address[] memory currentAuthorized = self.keyStorage.getAuthorizedUsers(recordId);
        address[] memory newAuthorized = new address[](currentAuthorized.length + 1);
        
        for (uint256 i = 0; i < currentAuthorized.length; i++) {
            newAuthorized[i] = currentAuthorized[i];
        }
        newAuthorized[currentAuthorized.length] = accessor;
        
        self.keyStorage.updateKeyAccess(recordId, newAuthorized);

        // Log the access grant
        self.accessManager.logAccess(recordId, grantor, "ACCESS_GRANTED", bytes32(0));
    }

    /**
     * @dev Revoke access to encrypted record data
     * @param self The RecordData storage
     * @param recordId The ID of the record
     * @param accessor The address to revoke access from
     * @param revoker The address revoking access
     */
    function revokeSecureAccess(
        RecordData storage self,
        uint256 recordId,
        address accessor,
        address revoker
    ) external {
        if (!self.isSecureRecord[recordId]) {
            revert RecordNotFound(recordId);
        }
        if (address(self.accessManager) == address(0)) {
            revert AccessManagerNotSet();
        }
        if (address(self.keyStorage) == address(0)) {
            revert KeyStorageNotSet();
        }

        // Verify revoker has permission to revoke access
        IAcademicRecords.SecureRecord storage record = self.secureRecords[recordId];
        if (revoker != record.issuer && revoker != record.studentAddress && 
            !self.accessManager.hasAccess(recordId, revoker)) {
            revert UnauthorizedAccess(recordId, revoker);
        }

        // Revoke access in AccessManager
        self.accessManager.revokeAccess(recordId, accessor);

        // Update key access in KeyStorage
        address[] memory currentAuthorized = self.keyStorage.getAuthorizedUsers(recordId);
        address[] memory newAuthorized = new address[](currentAuthorized.length - 1);
        uint256 newIndex = 0;
        
        for (uint256 i = 0; i < currentAuthorized.length; i++) {
            if (currentAuthorized[i] != accessor) {
                newAuthorized[newIndex] = currentAuthorized[i];
                newIndex++;
            }
        }
        
        self.keyStorage.updateKeyAccess(recordId, newAuthorized);

        // Log the access revocation
        self.accessManager.logAccess(recordId, revoker, "ACCESS_REVOKED", bytes32(0));
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
            uint256 recordId = records[i];
            address recordIssuer;
            
            if (self.isSecureRecord[recordId]) {
                recordIssuer = self.secureRecords[recordId].issuer;
            } else {
                recordIssuer = self.records[recordId].issuer;
            }
            
            if (recordIssuer == university) {
                toDelete[deleteCount] = recordId;
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

            // Delete the appropriate record type
            if (self.isSecureRecord[recordId]) {
                delete self.secureRecords[recordId];
                self.isSecureRecord[recordId] = false;
            } else {
                delete self.records[recordId];
            }
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
        
        // If it's a secure record, also grant access through AccessManager
        if (self.isSecureRecord[recordId] && address(self.accessManager) != address(0)) {
            self.accessManager.grantAccessWithDefaultDuration(
                recordId,
                sharedWith,
                IAccessManager.AccessType.SHARED
            );
        }
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
        
        // If it's a secure record, also revoke access through AccessManager
        if (self.isSecureRecord[recordId] && address(self.accessManager) != address(0)) {
            self.accessManager.revokeAccess(recordId, sharedWith);
        }
    }

    /**
     * @dev Create a sharing token for secure record access
     * @param self The RecordData storage
     * @param recordId The ID of the record
     * @param sharedWith The address to share with
     * @param duration Duration of the sharing token
     * @param maxUsage Maximum number of times the token can be used
     * @param sharer The address creating the sharing token
     * @return tokenHash The hash of the created sharing token
     */
    function createSharingToken(
        RecordData storage self,
        uint256 recordId,
        address sharedWith,
        uint256 duration,
        uint256 maxUsage,
        address sharer
    ) external returns (bytes32) {
        if (!self.isSecureRecord[recordId]) {
            revert RecordNotFound(recordId);
        }
        if (address(self.accessManager) == address(0)) {
            revert AccessManagerNotSet();
        }

        // Verify sharer has permission to create sharing tokens
        IAcademicRecords.SecureRecord storage record = self.secureRecords[recordId];
        if (sharer != record.issuer && sharer != record.studentAddress && 
            !self.accessManager.hasAccess(recordId, sharer)) {
            revert UnauthorizedAccess(recordId, sharer);
        }

        // Create sharing token through AccessManager
        bytes32 tokenHash = self.accessManager.createSharingToken(recordId, sharedWith, duration, maxUsage);
        
        // Log the token creation
        self.accessManager.logAccess(recordId, sharer, "SHARING_TOKEN_CREATED", tokenHash);
        
        return tokenHash;
    }

    /**
     * @dev Validate and use a sharing token for secure record access
     * @param self The RecordData storage
     * @param tokenHash The hash of the sharing token
     * @param recordId The ID of the record
     * @param accessor The address trying to access
     * @return True if token is valid and can be used
     */
    function validateSharingToken(
        RecordData storage self,
        bytes32 tokenHash,
        uint256 recordId,
        address accessor
    ) external returns (bool) {
        if (!self.isSecureRecord[recordId]) {
            revert RecordNotFound(recordId);
        }
        if (address(self.accessManager) == address(0)) {
            revert AccessManagerNotSet();
        }

        // Validate token through AccessManager
        bool isValid = self.accessManager.validateSharingToken(tokenHash, recordId, accessor);
        
        if (isValid) {
            // Log the token usage
            self.accessManager.logAccess(recordId, accessor, "SHARING_TOKEN_USED", tokenHash);
        }
        
        return isValid;
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
            address recordStudentAddress;
            
            if (self.isSecureRecord[i]) {
                recordStudentAddress = self.secureRecords[i].studentAddress;
            } else {
                recordStudentAddress = self.records[i].studentAddress;
            }
            
            if (recordStudentAddress == studentAddress) {
                count++;
            }
        }

        uint256[] memory result = new uint256[](count);
        uint256 index = 0;

        for (uint256 i = 1; i <= self.recordCounter; i++) {
            address recordStudentAddress;
            
            if (self.isSecureRecord[i]) {
                recordStudentAddress = self.secureRecords[i].studentAddress;
            } else {
                recordStudentAddress = self.records[i].studentAddress;
            }
            
            if (recordStudentAddress == studentAddress) {
                result[index] = i;
                index++;
            }
        }

        return result;
    }

    /**
     * @dev Get accessible records for a user (including shared records)
     * @param self The RecordData storage
     * @param user The user address
     * @return Array of record IDs the user can access
     */
    function getAccessibleRecords(
        RecordData storage self,
        address user
    ) external view returns (uint256[] memory) {
        if (address(self.accessManager) == address(0)) {
            // Fallback to basic student records if AccessManager not set
            uint256 count = 0;
            for (uint256 i = 1; i <= self.recordCounter; i++) {
                address recordStudentAddress;
                
                if (self.isSecureRecord[i]) {
                    recordStudentAddress = self.secureRecords[i].studentAddress;
                } else {
                    recordStudentAddress = self.records[i].studentAddress;
                }
                
                if (recordStudentAddress == user) {
                    count++;
                }
            }

            uint256[] memory result = new uint256[](count);
            uint256 index = 0;

            for (uint256 i = 1; i <= self.recordCounter; i++) {
                address recordStudentAddress;
                
                if (self.isSecureRecord[i]) {
                    recordStudentAddress = self.secureRecords[i].studentAddress;
                } else {
                    recordStudentAddress = self.records[i].studentAddress;
                }
                
                if (recordStudentAddress == user) {
                    result[index] = i;
                    index++;
                }
            }

            return result;
        }

        // Get records from AccessManager for secure records
        return self.accessManager.getUserAccessibleRecords(user);
    }

    /**
     * @dev Get record metadata without sensitive data
     * @param self The RecordData storage
     * @param recordId The ID of the record
     * @return id Record ID
     * @return studentId Student identifier
     * @return studentName Student name
     * @return studentAddress Student wallet address
     * @return universityName University name
     * @return recordType Type of record
     * @return timestamp Creation timestamp
     * @return isVerified Verification status
     * @return issuer Issuer address
     * @return isSecure Whether record uses encryption
     */
    function getRecordMetadata(
        RecordData storage self,
        uint256 recordId
    ) external view returns (
        uint256 id,
        string memory studentId,
        string memory studentName,
        address studentAddress,
        string memory universityName,
        IAcademicRecords.RecordType recordType,
        uint256 timestamp,
        bool isVerified,
        address issuer,
        bool isSecure
    ) {
        if (self.isSecureRecord[recordId]) {
            IAcademicRecords.SecureRecord storage secureRecord = self.secureRecords[recordId];
            return (
                secureRecord.id,
                secureRecord.studentId,
                secureRecord.studentName,
                secureRecord.studentAddress,
                secureRecord.universityName,
                secureRecord.recordType,
                secureRecord.timestamp,
                secureRecord.isVerified,
                secureRecord.issuer,
                true
            );
        } else {
            IAcademicRecords.Record storage record = self.records[recordId];
            return (
                record.id,
                record.studentId,
                record.studentName,
                record.studentAddress,
                record.universityName,
                record.recordType,
                record.timestamp,
                record.isVerified,
                record.issuer,
                false
            );
        }
    }

    /**
     * @dev Get ZK proof hash for secure record
     * @param self The RecordData storage
     * @param recordId The ID of the record
     * @return The ZK proof hash
     */
    function getZKProofHash(
        RecordData storage self,
        uint256 recordId
    ) external view returns (bytes32) {
        if (!self.isSecureRecord[recordId]) {
            revert RecordNotFound(recordId);
        }
        return self.secureRecords[recordId].zkProofHash;
    }

    /**
     * @dev Get access control hash for secure record
     * @param self The RecordData storage
     * @param recordId The ID of the record
     * @return The access control hash
     */
    function getAccessControlHash(
        RecordData storage self,
        uint256 recordId
    ) external view returns (bytes32) {
        if (!self.isSecureRecord[recordId]) {
            revert RecordNotFound(recordId);
        }
        return self.secureRecords[recordId].accessControlHash;
    }
}
