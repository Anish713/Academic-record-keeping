import { expect } from "chai";
import { ethers } from "hardhat";
import { AcademicRecords, ZKPManager, AccessManager, KeyStorage } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("AcademicRecords ZKP Integration", function () {
    let academicRecords: AcademicRecords;
    let zkpManager: ZKPManager;
    let accessManager: AccessManager;
    let keyStorage: KeyStorage;
    let admin: SignerWithAddress;
    let university: SignerWithAddress;
    let student: SignerWithAddress;
    let sharedUser: SignerWithAddress;

    beforeEach(async function () {
        [admin, university, student, sharedUser] = await ethers.getSigners();

        // Deploy KeyStorage
        const KeyStorageFactory = await ethers.getContractFactory("KeyStorage");
        keyStorage = await KeyStorageFactory.deploy();
        await keyStorage.waitForDeployment();

        // Deploy AccessManager
        const AccessManagerFactory = await ethers.getContractFactory("AccessManager");
        accessManager = await AccessManagerFactory.deploy();
        await accessManager.waitForDeployment();

        // Deploy ZKPManager
        const ZKPManagerFactory = await ethers.getContractFactory("ZKPManager");
        zkpManager = await ZKPManagerFactory.deploy();
        await zkpManager.waitForDeployment();

        // Deploy RecordStorage library
        const RecordStorageFactory = await ethers.getContractFactory("RecordStorage");
        const recordStorage = await RecordStorageFactory.deploy();
        await recordStorage.waitForDeployment();

        // Deploy AcademicRecords with library linking
        const AcademicRecordsFactory = await ethers.getContractFactory("AcademicRecords", {
            libraries: {
                RecordStorage: await recordStorage.getAddress(),
            },
        });
        academicRecords = await AcademicRecordsFactory.deploy();
        await academicRecords.waitForDeployment();

        // Set up ZKP contracts in ZKPManager
        await zkpManager.setAccessManager(await accessManager.getAddress());
        await zkpManager.setKeyStorage(await keyStorage.getAddress());

        // Set up ZKP contracts in AcademicRecords
        await academicRecords.setZKPContracts(
            await zkpManager.getAddress(),
            await accessManager.getAddress(),
            await keyStorage.getAddress()
        );

        // Grant university role
        await academicRecords.grantRole(await academicRecords.UNIVERSITY_ROLE(), university.address);
    });

    describe("ZKP Contract Setup", function () {
        it("Should set ZKP contracts correctly", async function () {
            const [zkpAddr, accessAddr, keyAddr] = await academicRecords.getZKPContracts();

            expect(zkpAddr).to.equal(await zkpManager.getAddress());
            expect(accessAddr).to.equal(await accessManager.getAddress());
            expect(keyAddr).to.equal(await keyStorage.getAddress());
        });

        it("Should emit ZKPContractsUpdated event", async function () {
            const newZkpManager = await (await ethers.getContractFactory("ZKPManager")).deploy();
            const newAccessManager = await (await ethers.getContractFactory("AccessManager")).deploy();
            const newKeyStorage = await (await ethers.getContractFactory("KeyStorage")).deploy();

            await expect(
                academicRecords.setZKPContracts(
                    await newZkpManager.getAddress(),
                    await newAccessManager.getAddress(),
                    await newKeyStorage.getAddress()
                )
            )
                .to.emit(academicRecords, "ZKPContractsUpdated")
                .withArgs(
                    await newZkpManager.getAddress(),
                    await newAccessManager.getAddress(),
                    await newKeyStorage.getAddress()
                );
        });

        it("Should reject setting zero addresses", async function () {
            await expect(
                academicRecords.setZKPContracts(
                    ethers.ZeroAddress,
                    await accessManager.getAddress(),
                    await keyStorage.getAddress()
                )
            ).to.be.revertedWith("Invalid ZKP Manager address");
        });
    });

    describe("Secure Record Creation", function () {
        it("Should create secure record successfully", async function () {
            const encryptedIPFS = ethers.toUtf8Bytes("encrypted_ipfs_hash");
            const encryptedMetadata = ethers.toUtf8Bytes("encrypted_metadata");
            const encryptedKey = ethers.toUtf8Bytes("encrypted_key_data");

            await expect(
                academicRecords.connect(university).addSecureRecord(
                    "STU001",
                    "John Doe",
                    student.address,
                    "Test University",
                    encryptedIPFS,
                    encryptedMetadata,
                    encryptedKey,
                    0 // TRANSCRIPT
                )
            )
                .to.emit(academicRecords, "SecureRecordAdded");
        });

        it("Should reject secure record creation without ZKP contracts", async function () {
            // Reset ZKP contracts to zero addresses
            await academicRecords.setZKPContracts(
                ethers.ZeroAddress,
                ethers.ZeroAddress,
                ethers.ZeroAddress
            );

            const encryptedIPFS = ethers.toUtf8Bytes("encrypted_ipfs_hash");
            const encryptedMetadata = ethers.toUtf8Bytes("encrypted_metadata");
            const encryptedKey = ethers.toUtf8Bytes("encrypted_key_data");

            await expect(
                academicRecords.connect(university).addSecureRecord(
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
    });

    describe("Secure Record Access", function () {
        let recordId: number;

        beforeEach(async function () {
            const encryptedIPFS = ethers.toUtf8Bytes("encrypted_ipfs_hash");
            const encryptedMetadata = ethers.toUtf8Bytes("encrypted_metadata");
            const encryptedKey = ethers.toUtf8Bytes("encrypted_key_data");

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

            const receipt = await tx.wait();
            const event = receipt?.logs.find(log => {
                try {
                    const parsed = academicRecords.interface.parseLog(log as any);
                    return parsed?.name === "SecureRecordAdded";
                } catch {
                    return false;
                }
            });

            if (event) {
                const parsed = academicRecords.interface.parseLog(event as any);
                recordId = Number(parsed?.args[0]);
            } else {
                recordId = 1; // fallback
            }
        });

        it("Should get secure record", async function () {
            const record = await academicRecords.getSecureRecord(recordId);
            expect(record.id).to.equal(recordId);
            expect(record.studentId).to.equal("STU001");
            expect(record.studentName).to.equal("John Doe");
        });

        it("Should check secure record access", async function () {
            // Student should have access
            const hasAccess = await academicRecords.hasSecureRecordAccess(recordId, student.address);
            expect(hasAccess).to.be.true;
        });
    });

    describe("Utility Functions", function () {
        it("Should get total secure records", async function () {
            const initialCount = await academicRecords.getTotalSecureRecords();
            expect(initialCount).to.equal(0);

            const encryptedIPFS = ethers.toUtf8Bytes("encrypted_ipfs_hash");
            const encryptedMetadata = ethers.toUtf8Bytes("encrypted_metadata");
            const encryptedKey = ethers.toUtf8Bytes("encrypted_key_data");

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

            const finalCount = await academicRecords.getTotalSecureRecords();
            expect(finalCount).to.equal(1);
        });
    });
});