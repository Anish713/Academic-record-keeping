// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

abstract contract Roles is AccessControl, Pausable {
    bytes32 public constant UNIVERSITY_ROLE = keccak256("UNIVERSITY_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    address private immutable _superAdmin;

    modifier onlySuperAdmin() {
        require(msg.sender == _superAdmin, "Only super admin allowed");
        _;
    }

    constructor() {
        _superAdmin = msg.sender;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    function addAdmin(address newAdmin) external onlySuperAdmin {
        _grantRole(ADMIN_ROLE, newAdmin);
    }

    function removeAdmin(address admin) external onlySuperAdmin {
        _revokeRole(ADMIN_ROLE, admin);
    }

    function getSuperAdmin() external view returns (address) {
        return _superAdmin;
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
}
