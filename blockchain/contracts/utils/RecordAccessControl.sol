// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

abstract contract RecordAccessControl {
    mapping(address => mapping(uint256 => bool)) private _recordViewPermissions;
    mapping(address => uint256[]) private _ownedRecordIds;

    event AccessGranted(address indexed student, address indexed viewer, uint256 recordId);
    event AccessRevoked(address indexed student, address indexed viewer, uint256 recordId);

    function grantAccess(address viewer, uint256 recordId) external {
        require(_isStudentOwner(msg.sender, recordId), "Not record owner");
        _recordViewPermissions[viewer][recordId] = true;
        emit AccessGranted(msg.sender, viewer, recordId);
    }

    function revokeAccess(address viewer, uint256 recordId) external {
        require(_isStudentOwner(msg.sender, recordId), "Not record owner");
        _recordViewPermissions[viewer][recordId] = false;
        emit AccessRevoked(msg.sender, viewer, recordId);
    }

    function canView(address viewer, uint256 recordId) public view returns (bool) {
        return _recordViewPermissions[viewer][recordId];
    }

    function _isStudentOwner(address student, uint256 recordId) internal view virtual returns (bool);

    function _addStudentRecord(address student, uint256 recordId) internal {
        _ownedRecordIds[student].push(recordId);
    }

    function getStudentOwnedRecords(address student) external view returns (uint256[] memory) {
        return _ownedRecordIds[student];
    }
}
