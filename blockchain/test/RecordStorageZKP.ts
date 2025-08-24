import { expect } from "chai";
import { ethers } from "hardhat";
import { AcademicRecords, AccessManager, KeyStorage, ZKPManager } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("RecordStorage ZKP Integration", function () {
    let academicRecords: AcademicRecords;
    let accessManager: AccessManager;
    let keyStorage: KeyStorage;
    let zkpManager: ZKPManager;
    let owner: HardhatEthersSigner;
    let university: HardhatEthersSigner;
    let student: HardhatEthersSigner;
    let admin: HardhatEthersSigner;

    beforeEach(async function () {
        [owner, university, student, admin] = await ethers.getSigners();

        // Deploy AccessManager
        const AccessManagerFactory = await ethers.getContractFactory("AccessManager");
        accessManager = await AccessManagerFactory.deploy();

        // Deploy KeyStorage
        const KeyStorageFactory = await ethers.getContractFactory("KeyStorage");
        keyStorage = await KeyStorageFactory.deploy();

        // Deploy ZKPManager
        const ZKPManagerFactory = await ethers.getContractFactory("ZKPManager");
        zkpManager = await ZKPManagerFactory.deploy();

        // Deploy AcademicRecords with library linking
        const RecordStorageFactory = await ethers.getContractFactory("RecordStorage");
        const recordStorageLib = await RecordStorageFactory.deploy();

        const AcademicRecordsFactory = await ethers.getContractFactory("AcademicRecords", {
            libraries: {
                RecordStorage: await recordStorageLib.getAddress(),
            },
        });
        academicRecords = await AcademicRecordsFactory.deploy();

        // Set up roles
        await academicRecords.grantRole(await academicRecords.UNIVERSITY_ROLE(), university.address);
        await academicRecords.grantRole(await academicRecords.ADMIN_ROLE(), admin.address);

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

    describe("Secure Record Management", function () {
        it("Should add secure record successfully", async function () {
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
        });

        it("Should check if record is secure", async function () {
            const encryptedIPFS = ethers.hexlify(ethers.toUtf8Bytes("encrypted_ipfs_hash"));
            const encryptedMetadata = ethers.hexlify(ethers.toUtf8Bytes("encrypted_metadata"));
            const encryptedKey = ethers.hexlify(ethers.toUtf8Bytes("encrypted_key"));

            await academicRecords.connect(university).addSecureRecord(
                "STU001",
                "John Doe",
                student.address,
                "Test University",
                encryptedIPFS,
                encryptedMetadata,
                encryptedKey,
                0 // TRANSCRIPT
            );

            // Check if the record is secure (this would be called internally)
            // We can verify by checking if we can get secure record metadata
            const secureRecord = await academicRecords.getSecureRecord(1);
            expect(secureRecord.id).to.equal(1);
            expect(secureRecord.studentName).to.equal("John Doe");
            expect(secureRecord.encryptedIPFSHash).to.equal(""); // Should be empty for security
        });

        it("Should grant and revoke secure access", async function () {
            const encryptedIPFS = ethers.hexlify(ethers.toUtf8Bytes("encrypted_ipfs_hash"));
            const encryptedMetadata = ethers.hexlify(ethers.toUtf8Bytes("encrypted_metadata"));
            const encryptedKey = ethers.hexlify(ethers.toUtf8Bytes("encrypted_key"));

            await academicRecords.connect(university).addSecureRecord(
                "STU001",
                "John Doe",
                student.address,
                "Test University",
                encryptedIPFS,
                encryptedMetadata,
                encryptedKey,
                0 // TRANSCRIPT
            );

            // Check initial access
            const hasAccess = await academicRecords.hasSecureRecordAccess(1, student.address);
            expect(hasAccess).to.be.true;

            // Revoke access
            await academicRecords.connect(student).revokeSecureRecordAccess(1, student.address);

            // Check access after revocation
            const hasAccessAfter = await academicRecords.hasSecureRecordAccess(1, student.address);
            expect(hasAccessAfter).to.be.false;
        });
    });

    describe("Error Handling", function () {
        it("Should reject adding secure record without ZKP contracts", async function () {
            // Deploy a new AcademicRecords without ZKP contracts
            const RecordStorageFactory = await ethers.getContractFactory("RecordStorage");
            const recordStorageLib = await RecordStorageFactory.deploy();

            const AcademicRecordsFactory = await ethers.getContractFactory("AcademicRecords", {
                libraries: {
                    RecordStorage: await recordStorageLib.getAddress(),
                },
            });
            const newAcademicRecords = await AcademicRecordsFactory.deploy();
            await newAcademicRecords.grantRole(await newAcademicRecords.UNIVERSITY_ROLE(), university.address);

            const encryptedIPFS = ethers.hexlify(ethers.toUtf8Bytes("encrypted_ipfs_hash"));
            const encryptedMetadata = ethers.hexlify(ethers.toUtf8Bytes("encrypted_metadata"));
            const encryptedKey = ethers.hexlify(ethers.toUtf8Bytes("encrypted_key"));

            await expect(
                newAcademicRecords.connect(university).addSecureRecord(
                    "STU001",
                    "John Doe",
                    student.address,
                    "Test University",
                    encryptedIPFS,
                    encryptedMetadata,
                    encryptedKey,
                    0 // TRANSCRIPT
                )
            ).to.be.revertedWith("ZKP Manager not set");
        });

        it("Should reject access to non-existent secure record", async function () {
            await expect(
                academicRecords.getSecureRecord(999)
            ).to.be.revertedWith("Secure record does not exist");
        });
    });
});