// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";

abstract contract RoleManager is AccessControl {
    bytes32 public constant UNIVERSITY_ROLE = keccak256("UNIVERSITY_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant SUPER_ADMIN_ROLE = keccak256("SUPER_ADMIN_ROLE");

    address public immutable SUPER_ADMIN;

    // University name registry
    mapping(address => string) private _universityNames;
    address[] private _universityList;

    event UniversityNameUpdated(address indexed university, string name);
    event AdminAdded(address indexed admin, address indexed addedBy);
    event AdminRemoved(address indexed admin, address indexed removedBy);

    modifier onlySuperAdmin() {
        require(msg.sender == SUPER_ADMIN, "Not super admin");
        _;
    }

    modifier onlyAdminOrSuper() {
        require(
            hasRole(ADMIN_ROLE, msg.sender) || msg.sender == SUPER_ADMIN,
            "Not admin or super admin"
        );
        _;
    }

    constructor() {
        SUPER_ADMIN = msg.sender;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(SUPER_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    // Super admin functions
    function addAdmin(address adminAddress) external onlySuperAdmin {
        require(!hasRole(ADMIN_ROLE, adminAddress), "Already an admin");
        _grantRole(ADMIN_ROLE, adminAddress);
        emit AdminAdded(adminAddress, msg.sender);
    }

    function removeAdmin(address adminAddress) external onlySuperAdmin {
        require(adminAddress != SUPER_ADMIN, "Cannot remove super admin");
        require(hasRole(ADMIN_ROLE, adminAddress), "Not an admin");
        _revokeRole(ADMIN_ROLE, adminAddress);
        emit AdminRemoved(adminAddress, msg.sender);
    }

    // University management
    function addUniversity(
        address universityAddress,
        string calldata name
    ) external onlyAdminOrSuper {
        require(
            !hasRole(UNIVERSITY_ROLE, universityAddress),
            "Already a university"
        );
        _grantRole(UNIVERSITY_ROLE, universityAddress);
        _universityNames[universityAddress] = name;
        _universityList.push(universityAddress);

        emit UniversityNameUpdated(universityAddress, name);
    }

    function removeUniversity(
        address universityAddress
    ) external onlyAdminOrSuper {
        _revokeRole(UNIVERSITY_ROLE, universityAddress);
        delete _universityNames[universityAddress];

        // Remove from university list
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
            hasRole(ADMIN_ROLE, msg.sender) ||
                msg.sender == SUPER_ADMIN ||
                msg.sender == universityAddress,
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

    function getAllAdmins() external view returns (address[] memory) {
        // This would need to be implemented with a separate tracking mechanism
        // For now, just return empty array - you'd need to track admins separately
        address[] memory admins = new address[](0);
        return admins;
    }
}
