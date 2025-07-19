// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../interfaces/IAcademicRecords.sol";
import "../libraries/RecordStorage.sol";

contract StudentManagement {
    using RecordStorage for RecordStorage.RecordData;

    mapping(string => bool) public studentExists;
    mapping(string => address) public studentAddresses;
    mapping(address => string) public addressToStudentId;

    event StudentRegistered(
        string indexed studentId,
        address indexed studentAddress
    );
    event StudentAddressUpdated(
        string indexed studentId,
        address indexed oldAddress,
        address indexed newAddress
    );

    function registerStudent(
        string calldata studentId,
        address studentAddress
    ) external {
        require(bytes(studentId).length > 0, "Invalid student ID");
        require(studentAddress != address(0), "Invalid address");

        // If student already exists, update address
        if (studentExists[studentId]) {
            address oldAddress = studentAddresses[studentId];
            if (oldAddress != address(0)) {
                delete addressToStudentId[oldAddress];
            }
            studentAddresses[studentId] = studentAddress;
            addressToStudentId[studentAddress] = studentId;
            emit StudentAddressUpdated(studentId, oldAddress, studentAddress);
        } else {
            studentExists[studentId] = true;
            studentAddresses[studentId] = studentAddress;
            addressToStudentId[studentAddress] = studentId;
            emit StudentRegistered(studentId, studentAddress);
        }
    }

    function getStudentAddress(
        string calldata studentId
    ) external view returns (address) {
        return studentAddresses[studentId];
    }

    function getStudentId(
        address studentAddress
    ) external view returns (string memory) {
        return addressToStudentId[studentAddress];
    }

    function isStudentRegistered(
        string calldata studentId
    ) external view returns (bool) {
        return studentExists[studentId];
    }
}
