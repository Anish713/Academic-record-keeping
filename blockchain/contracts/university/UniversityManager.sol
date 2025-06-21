// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../access/Roles.sol";

abstract contract UniversityManager is Roles {
    mapping(address => string) internal _universityNames;
    address[] internal _universityList;

    event UniversityNameUpdated(address indexed university, string name);

    function addUniversity(address universityAddress, string calldata name) external onlyRole(ADMIN_ROLE) {
        require(!hasRole(UNIVERSITY_ROLE, universityAddress), "Already a university");
        grantRole(UNIVERSITY_ROLE, universityAddress);
        _universityNames[universityAddress] = name;
        _universityList.push(universityAddress);
        emit UniversityNameUpdated(universityAddress, name);
    }

    function removeUniversity(address universityAddress) external onlyRole(ADMIN_ROLE) {
        revokeRole(UNIVERSITY_ROLE, universityAddress);
        delete _universityNames[universityAddress];

        for (uint i = 0; i < _universityList.length; i++) {
            if (_universityList[i] == universityAddress) {
                _universityList[i] = _universityList[_universityList.length - 1];
                _universityList.pop();
                break;
            }
        }
    }

    function setUniversityName(address universityAddress, string calldata name) external {
        require(
            hasRole(ADMIN_ROLE, msg.sender) || msg.sender == universityAddress,
            "Not authorized to set name"
        );
        require(hasRole(UNIVERSITY_ROLE, universityAddress), "Address is not a university");

        _universityNames[universityAddress] = name;
        emit UniversityNameUpdated(universityAddress, name);
    }

    function getUniversityName(address universityAddress) external view returns (string memory) {
        return _universityNames[universityAddress];
    }

    function getAllUniversities() external view returns (address[] memory) {
        return _universityList;
    }
}
