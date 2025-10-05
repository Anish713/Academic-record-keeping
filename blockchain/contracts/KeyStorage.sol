// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./interfaces/IZKPInterfaces.sol";

/**
 * @title KeyStorage
 * @dev Manages user encryption keys for ZKP-based record access
 */
contract KeyStorage is IKeyStorage, AccessControl, Pausable {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    /**
     * @dev User key data structure
     */
    struct UserKeys {
        string publicKey;
        bytes32 zkpIdentity;
        uint256 timestamp;
        bool isActive;
    }

    // Mapping from user address to their keys
    mapping(address => UserKeys) private userKeys;
    
    // Mapping from ZKP identity to user address
    mapping(bytes32 => address) private zkpIdentityToAddress;
    
    // Track all registered users
    address[] private registeredUsers;
    mapping(address => bool) private isRegistered;

    /**
     * @dev Constructor
     * @param _admin Admin address
     */
    constructor(address _admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);
    }

    /**
     * @dev Generate and store encryption keys for a user
     */
    function generateKeys(
        string memory publicKey,
        bytes32 zkpIdentity
    ) external override whenNotPaused returns (bool success) {
        require(bytes(publicKey).length > 0, "Public key cannot be empty");
        require(zkpIdentity != bytes32(0), "ZKP identity cannot be zero");
        require(zkpIdentityToAddress[zkpIdentity] == address(0), "ZKP identity already used");

        // If user already has keys, this is an update
        if (userKeys[msg.sender].isActive) {
            return updateKeys(publicKey, zkpIdentity);
        }

        // Store new keys
        userKeys[msg.sender] = UserKeys({
            publicKey: publicKey,
            zkpIdentity: zkpIdentity,
            timestamp: block.timestamp,
            isActive: true
        });

        zkpIdentityToAddress[zkpIdentity] = msg.sender;

        // Add to registered users if not already added
        if (!isRegistered[msg.sender]) {
            registeredUsers.push(msg.sender);
            isRegistered[msg.sender] = true;
        }

        emit KeyGenerated(msg.sender, publicKey, block.timestamp);
        return true;
    }

    /**
     * @dev Get user's public encryption key
     */
    function getPublicKey(address userAddress) external view override returns (string memory publicKey) {
        require(userKeys[userAddress].isActive, "User has no active keys");
        return userKeys[userAddress].publicKey;
    }

    /**
     * @dev Get user's ZKP identity
     */
    function getZKPIdentity(address userAddress) external view override returns (bytes32 zkpIdentity) {
        require(userKeys[userAddress].isActive, "User has no active keys");
        return userKeys[userAddress].zkpIdentity;
    }

    /**
     * @dev Check if user has registered keys
     */
    function hasKeys(address userAddress) external view override returns (bool userHasKeys) {
        return userKeys[userAddress].isActive;
    }

    /**
     * @dev Update user's public key
     */
    function updateKeys(
        string memory newPublicKey,
        bytes32 newZkpIdentity
    ) public override whenNotPaused returns (bool success) {
        require(userKeys[msg.sender].isActive, "User has no existing keys");
        require(bytes(newPublicKey).length > 0, "Public key cannot be empty");
        require(newZkpIdentity != bytes32(0), "ZKP identity cannot be zero");
        require(
            zkpIdentityToAddress[newZkpIdentity] == address(0) || 
            zkpIdentityToAddress[newZkpIdentity] == msg.sender,
            "ZKP identity already used by another user"
        );

        // Remove old ZKP identity mapping
        bytes32 oldZkpIdentity = userKeys[msg.sender].zkpIdentity;
        delete zkpIdentityToAddress[oldZkpIdentity];

        // Update keys
        userKeys[msg.sender].publicKey = newPublicKey;
        userKeys[msg.sender].zkpIdentity = newZkpIdentity;
        userKeys[msg.sender].timestamp = block.timestamp;

        // Add new ZKP identity mapping
        zkpIdentityToAddress[newZkpIdentity] = msg.sender;

        emit KeyUpdated(msg.sender, newPublicKey, block.timestamp);
        return true;
    }

    /**
     * @dev Get user address by ZKP identity
     */
    function getUserByZKPIdentity(bytes32 zkpIdentity) external view returns (address userAddress) {
        return zkpIdentityToAddress[zkpIdentity];
    }

    /**
     * @dev Get user key details (admin only)
     */
    function getUserKeyDetails(address userAddress) external view onlyRole(ADMIN_ROLE) returns (UserKeys memory) {
        return userKeys[userAddress];
    }

    /**
     * @dev Get all registered users (admin only)
     */
    function getAllRegisteredUsers() external view onlyRole(ADMIN_ROLE) returns (address[] memory) {
        return registeredUsers;
    }

    /**
     * @dev Get total number of registered users
     */
    function getTotalRegisteredUsers() external view returns (uint256) {
        return registeredUsers.length;
    }

    /**
     * @dev Deactivate user keys (admin only or self)
     */
    function deactivateKeys(address userAddress) external {
        require(
            msg.sender == userAddress || hasRole(ADMIN_ROLE, msg.sender),
            "Not authorized to deactivate keys"
        );
        require(userKeys[userAddress].isActive, "Keys already inactive");

        // Deactivate keys
        userKeys[userAddress].isActive = false;
        
        // Remove ZKP identity mapping
        bytes32 zkpIdentity = userKeys[userAddress].zkpIdentity;
        delete zkpIdentityToAddress[zkpIdentity];
    }

    /**
     * @dev Reactivate user keys (admin only)
     */
    function reactivateKeys(address userAddress) external onlyRole(ADMIN_ROLE) {
        require(!userKeys[userAddress].isActive, "Keys already active");
        require(userKeys[userAddress].timestamp > 0, "User never had keys");

        bytes32 zkpIdentity = userKeys[userAddress].zkpIdentity;
        require(zkpIdentityToAddress[zkpIdentity] == address(0), "ZKP identity already in use");

        // Reactivate keys
        userKeys[userAddress].isActive = true;
        zkpIdentityToAddress[zkpIdentity] = userAddress;
    }

    /**
     * @dev Batch register users with keys (admin only)
     */
    function batchRegisterKeys(
        address[] memory users,
        string[] memory publicKeys,
        bytes32[] memory zkpIdentities
    ) external onlyRole(ADMIN_ROLE) {
        require(
            users.length == publicKeys.length && 
            publicKeys.length == zkpIdentities.length,
            "Array length mismatch"
        );

        for (uint256 i = 0; i < users.length; i++) {
            address user = users[i];
            
            // Skip if user already has active keys
            if (userKeys[user].isActive) continue;
            
            // Skip if ZKP identity is already used
            if (zkpIdentityToAddress[zkpIdentities[i]] != address(0)) continue;

            // Register keys
            userKeys[user] = UserKeys({
                publicKey: publicKeys[i],
                zkpIdentity: zkpIdentities[i],
                timestamp: block.timestamp,
                isActive: true
            });

            zkpIdentityToAddress[zkpIdentities[i]] = user;

            if (!isRegistered[user]) {
                registeredUsers.push(user);
                isRegistered[user] = true;
            }

            emit KeyGenerated(user, publicKeys[i], block.timestamp);
        }
    }

    /**
     * @dev Get keys by batch (admin only)
     */
    function getBatchUserKeys(address[] memory users) external view onlyRole(ADMIN_ROLE) returns (UserKeys[] memory) {
        UserKeys[] memory keys = new UserKeys[](users.length);
        for (uint256 i = 0; i < users.length; i++) {
            keys[i] = userKeys[users[i]];
        }
        return keys;
    }

    /**
     * @dev Emergency key reset (admin only)
     */
    function emergencyResetKeys(address userAddress) external onlyRole(ADMIN_ROLE) {
        if (userKeys[userAddress].isActive) {
            bytes32 zkpIdentity = userKeys[userAddress].zkpIdentity;
            delete zkpIdentityToAddress[zkpIdentity];
        }
        
        delete userKeys[userAddress];
    }

    /**
     * @dev Pause/unpause functionality
     */
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @dev Check if ZKP identity is available
     */
    function isZKPIdentityAvailable(bytes32 zkpIdentity) external view returns (bool) {
        return zkpIdentityToAddress[zkpIdentity] == address(0);
    }

    /**
     * @dev Validate public key format (basic validation)
     */
    function validatePublicKey(string memory publicKey) external pure returns (bool) {
        bytes memory keyBytes = bytes(publicKey);
        
        // Basic validation - key should be between 64 and 512 characters
        if (keyBytes.length < 64 || keyBytes.length > 512) {
            return false;
        }
        
        // Check for valid hex characters (simplified)
        for (uint256 i = 0; i < keyBytes.length; i++) {
            bytes1 char = keyBytes[i];
            if (!(
                (char >= 0x30 && char <= 0x39) || // 0-9
                (char >= 0x41 && char <= 0x46) || // A-F
                (char >= 0x61 && char <= 0x66)    // a-f
            )) {
                return false;
            }
        }
        
        return true;
    }
}