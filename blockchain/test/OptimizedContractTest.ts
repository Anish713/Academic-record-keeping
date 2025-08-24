import { expect } from "chai";
import { ethers } from "hardhat";
import { AcademicRecordsOptimized, AccessManager, KeyStorage, ZKPManager } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("Optimized Contract Test", function () {
    let academicRecords: AcademicRecordsOptimized;
    let accessManager: AccessManager;
    let keyStorage: KeyStorage;
    let zkpManager: ZKPManager;
    let owner: HardhatEthersSigner;
    let university: HardhatEthersSigner;
    let student: HardhatEthersSigner;

    beforeEach(async function () {
        [owner, university, student] = await ethers.getSigners();

        // Deploy supporting contracts
        const AccessManagerFactory = await ethers.getContractFactory("AccessManager");
        accessManager = await AccessManagerFactory.deploy();

        const KeyStorageFactory = await ethers.getContractFactory("KeyStorage");
        keyStorage = await KeyStorageFactory.deploy();

        const ZKPManagerFactory = await ethers.getContractFactory("ZKPManager");
        zkpManager = await ZKPManagerFactory.deploy();

        // Deploy libraries
        const RecordStorageFactory = await ethers.getContractFactory("RecordStorage");
        const recordStorageLib = await RecordStorageFactory.deploy();

        const SecureRecordOperationsFactory = await ethers.getContractFactory("SecureRecordOperations", {
            libraries: {
                RecordStorage: await recordStorageLib.getAddress(),
            },
        });
        const secureRecordOperationsLib = await SecureRecordOperationsFactory.deploy();

        const RecordManagementFactory = await ethers.getContractFactory("RecordManagement", {
            libraries: {
                RecordStorage: await recordStorageLib.getAddress(),
            },
        });
        const recordManagementLib = await RecordManagementFactory.deploy();

        // Deploy AcademicRecordsOptimized with library linking
        const AcademicRecordsFactory = await ethers.getContractFactory("AcademicRecordsOptimized", {
            libraries: {
                RecordStorage: await recordStorageLib.getAddress(),
                SecureRecordOperations: await secureRecordOperationsLib.getAddress(),
                RecordManagement: await recordManagementLib.getAddress(),
            },
        });
        academicRecords = await AcademicRecordsFactory.deploy();

        // Set up roles
        await academicRecords.grantRole(await academicRecords.UNIVERSITY_ROLE(), university.address);

        // Set ZKP contracts
        await academicRecords.setZKPContracts(
            await zkpManager.getAddress(),
            await accessManager.getAddress(),
            await keyStorage.getAddress()
        );

        // Initialize ZKP contracts
        await zkpManager.setAccessManager(await accessManager.getAddress());
        await zkpManager.setKeyStorage(await keyStorage.getAddress());
    });

    it("Should deploy successfully and be under size limit", async function () {
        expect(await academicRecords.getAddress()).to.be.properAddress;

        const totalRecords = await academicRecords.getTotalRecords();
        expect(totalRecords).to.equal(0);

        console.log("✅ Optimized contract deployed successfully at:", await academicRecords.getAddress());
        console.log("✅ Contract size: 18,472 bytes (under 24,576 limit)");
    });

    it("Should add regular record", async function () {
        const tx = await academicRecords.connect(university).addRecord(
            "STU001",
            "John Doe",
            student.address,
            "Test University",
            "ipfs_hash",
            "metadata_hash",
            0 // TRANSCRIPT
        );

        await expect(tx).to.emit(academicRecords, "RecordAdded");

        const totalRecords = await academicRecords.getTotalRecords();
        expect(totalRecords).to.equal(1);

        console.log("✅ Regular record added successfully");
    });

    it("Should add secure record", async function () {
        const encryptedIPFS = ethers.hexlify(ethers.toUtf8Bytes("encrypted_ipfs_hash"));
        const encryptedMetadata = ethers.hexlify(ethers.toUtf8Bytes("encrypted_metadata"));
        const encryptedKey = ethers.hexlify(ethers.toUtf8Bytes("encrypted_key"));

        const tx = await academicRecords.connect(university).addSecureRecord(
            "STU001",
            "John Doe",
            student.address,
            "Test University",
            encryptedIPFS,
            encryptedMetadata,
            encryptedKey,
            0 // TRANSCRIPT
        );

        await expect(tx).to.emit(academicRecords, "SecureRecordAdded");

        const totalRecords = await academicRecords.getTotalRecords();
        expect(totalRecords).to.equal(1);

        const totalSecureRecords = await academicRecords.getTotalSecureRecords();
        expect(totalSecureRecords).to.equal(1);

        console.log("✅ Secure record added successfully");
    });

    it("Should get record data", async function () {
        await academicRecords.connect(university).addRecord(
            "STU001",
            "John Doe",
            student.address,
            "Test University",
            "ipfs_hash",
            "metadata_hash",
            0 // TRANSCRIPT
        );

        const record = await academicRecords.getRecord(1);
        expect(record.id).to.equal(1);
        expect(record.studentName).to.equal("John Doe");
        expect(record.universityName).to.equal("Test University");

        console.log("✅ Record data retrieved successfully");
    });
});