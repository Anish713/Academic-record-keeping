// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./record/RecordManager.sol";
import "./university/UniversityManager.sol";

contract AcademicRecords is RecordManager, UniversityManager {
    constructor() Roles() {}
}
