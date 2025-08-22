import { expect } from "chai";
import { ethers } from "hardhat";
import { AcademicRecords, ZKAccessControl, Groth16Verifier, StudentManagement } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Academic Records - ZK Access Control Integration", function () {
    let academicRecords: AcademicRecords;
    let zkAccessControl: ZKAccessControl;
    let verifier: Groth16Verifier;
    let studentManagement: StudentManagement;
    
    let owner: SignerWithAddress;
    let university: SignerWithAddress;
    let student: SignerWithAddress;
    let sharedUser: SignerWithAddress;
    let admin: SignerWithAddress;

    const UNIVERSITY_ROLE = ethers.keccak256(ethers.toUtf8Bytes("UNIVERSITY_ROLE"));
    const ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_ROLE"));

    beforeEach(async function () {
        [owner, university, student, sharedUser, admin] = await ethers.getSigners();

        // Deploy Verifier contract
        const VerifierFactory = await ethers.getContractFactory("Groth16Verifier");
        verifier = await VerifierFactory.deploy();
        await verifier.waitForDeployment();

        // Deploy ZK Access Control contract
        const ZKAccessControlFactory = await ethers.getContractFactory("ZKAccessControl");
        zkAccessControl = await ZKAccessControlFactory.deploy(await verifier.getAddress());
        await zkAccessControl.waitForDeployment();

        // Deploy RecordStorage library
        const RecordStorageFactory = await ethers.getContractFactory("RecordStorage");
        const recordStorage = await RecordStorageFactory.deploy();
        await recordStorage.waitForDeployment();
        const recordStorageAddress = await recordStorage.getAddress();

        // Deploy Academic Records contract with library linking
        const AcademicRecordsFactory = await ethers.getContractFactory("AcademicRecords", {
            libraries: {
                RecordStorage: recordStorageAddress,
            },
        });
        academicRecords = await AcademicRecordsFactory.deploy();
        await academicRecords.waitForDeployment();

        // Get student management contract address
        const studentManagementAddress = await academicRecords.studentManagement();
        studentManagement = await ethers.getContractAt("StudentManagement", studentManagementAddress);

        // Set up roles
        await academicRecords.grantRole(UNIVERSITY_ROLE, university.address);
        await academicRecords.grantRole(ADMIN_ROLE, admin.address);
        await zkAccessControl.grantRole(UNIVERSITY_ROLE, university.address);
        await zkAccessControl.grantRole(ADMIN_ROLE, admin.address);
        
        // Grant Academic Records contract permission to store records in ZK contract
        const ACADEMIC_RECORDS_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ACADEMIC_RECORDS_ROLE"));
        await zkAccessControl.grantRole(ACADEMIC_RECORDS_ROLE, await academicRecords.getAddress());

        // Set ZK Access Control in Academic Records
        await academicRecords.connect(admin).setZKAccessControl(await zkAccessControl.getAddress());
    });

    describe("ZK Access Control Integration", function () {
        it("Should set ZK Access Control contract address", async function () {
            const zkAddress = await academicRecords.zkAccessControl();
            expect(zkAddress).to.equal(await zkAccessControl.getAddress());
        });

        it("Should emit ZKAccessControlSet event when setting ZK contract", async function () {
            const newZKContract = await (await ethers.getContractFactory("ZKAccessControl")).deploy(await verifier.getAddress());
            await newZKContract.waitForDeployment();

            await expect(academicRecords.connect(admin).setZKAccessControl(await newZKContract.getAddress()))
                .to.emit(academicRecords, "ZKAccessControlSet")
                .withArgs(await newZKContract.getAddress());
        });

        it("Should revert when non-admin tries to set ZK Access Control", async function () {
            const newZKContract = await (await ethers.getContractFactory("ZKAccessControl")).deploy(await verifier.getAddress());
            await newZKContract.waitForDeployment();

            await expect(academicRecords.connect(student).setZKAccessControl(await newZKContract.getAddress()))
                .to.be.reverted;
        });
    });

    describe("Record Creation with ZK Integration", function () {
        it("Should create record and store encrypted data in ZK contract", async function () {
            const studentId = "STU001";
            const studentName = "John Doe";
            const universityName = "Test University";
            const ipfsHash = "QmTestHash123";
            const metadataHash = "QmMetadataHash456";

            // Add record
            const tx = await academicRecords.connect(university).addRecord(
                studentId,
                studentName,
                student.address,
                universityName,
                ipfsHash,
                metadataHash,
                0 // TRANSCRIPT
            );

            const receipt = await tx.wait();
            const recordAddedEvent = receipt?.logs.find(log => {
                try {
                    const parsed = academicRecords.interface.parseLog({
                        topics: log.topics,
                        data: log.data
                    });
                    return parsed?.name === "RecordAdded";
                } catch {
                    return false;
                }
            });

            expect(recordAddedEvent).to.not.be.undefined;
            const parsedEvent = academicRecords.interface.parseLog({
                topics: recordAddedEvent!.topics,
                data: recordAddedEvent!.data
            });
            const recordId = parsedEvent?.args[0];

            // Check that record exists in main contract with empty hashes
            const record = await academicRecords.getRecord(recordId);
            expect(record.studentId).to.equal(studentId);
            expect(record.studentName).to.equal(studentName);
            expect(record.ipfsHash).to.equal(""); // Should be empty
            expect(record.metadataHash).to.equal(""); // Should be empty

            // Check that encrypted record exists in ZK contract
            const encryptedRecord = await zkAccessControl.getEncryptedRecord(recordId);
            expect(encryptedRecord.exists).to.be.true;
            expect(encryptedRecord.owner).to.equal(student.address);
            expect(encryptedRecord.encryptedIPFSHash).to.not.equal(ethers.ZeroHash);
            expect(encryptedRecord.encryptedMetadataHash).to.not.equal(ethers.ZeroHash);
        });

        it("Should grant automatic access to student and university", async function () {
            const studentId = "STU002";
            const ipfsHash = "QmTestHash456";

            const tx = await academicRecords.connect(university).addRecord(
                studentId,
                "Jane Doe",
                student.address,
                "Test University",
                ipfsHash,
                "QmMetadata456",
                1 // DEGREE
            );

            const receipt = await tx.wait();
            const recordAddedEvent = receipt?.logs.find(log => {
                try {
                    const parsed = academicRecords.interface.parseLog({
                        topics: log.topics,
                        data: log.data
                    });
                    return parsed?.name === "RecordAdded";
                } catch {
                    return false;
                }
            });

            const parsedEvent = academicRecords.interface.parseLog({
                topics: recordAddedEvent!.topics,
                data: recordAddedEvent!.data
            });
            const recordId = parsedEvent?.args[0];

            // Check student has access
            const studentHasAccess = await zkAccessControl.hasAccess(recordId, student.address);
            expect(studentHasAccess).to.be.true;

            // Check university has access
            const universityHasAccess = await zkAccessControl.hasAccess(recordId, university.address);
            expect(universityHasAccess).to.be.true;
        });
    });

    describe("Record Sharing with ZK Integration", function () {
        let recordId: bigint;

        beforeEach(async function () {
            // Create a record first
            const tx = await academicRecords.connect(university).addRecord(
                "STU003",
                "Alice Smith",
                student.address,
                "Test University",
                "QmTestHash789",
                "QmMetadata789",
                0 // TRANSCRIPT
            );

            const receipt = await tx.wait();
            const recordAddedEvent = receipt?.logs.find(log => {
                try {
                    const parsed = academicRecords.interface.parseLog({
                        topics: log.topics,
                        data: log.data
                    });
                    return parsed?.name === "RecordAdded";
                } catch {
                    return false;
                }
            });

            const parsedEvent = academicRecords.interface.parseLog({
                topics: recordAddedEvent!.topics,
                data: recordAddedEvent!.data
            });
            recordId = parsedEvent?.args[0];
        });

        it("Should grant ZK access when sharing record", async function () {
            // Initially, shared user should not have access
            const initialAccess = await zkAccessControl.hasAccess(recordId, sharedUser.address);
            expect(initialAccess).to.be.false;

            // Share record
            await academicRecords.connect(student).shareRecord(recordId, sharedUser.address);

            // Now shared user should have access
            const finalAccess = await zkAccessControl.hasAccess(recordId, sharedUser.address);
            expect(finalAccess).to.be.true;

            // Check that user appears in accessible records
            const userRecords = await academicRecords.getRecordsWithZKAccess(sharedUser.address);
            expect(userRecords).to.include(recordId);
        });

        it("Should revoke ZK access when unsharing record", async function () {
            // Share record first
            await academicRecords.connect(student).shareRecord(recordId, sharedUser.address);
            
            // Verify access is granted
            let hasAccess = await zkAccessControl.hasAccess(recordId, sharedUser.address);
            expect(hasAccess).to.be.true;

            // Unshare record
            await academicRecords.connect(student).unshareRecord(recordId, sharedUser.address);

            // Verify access is revoked
            hasAccess = await zkAccessControl.hasAccess(recordId, sharedUser.address);
            expect(hasAccess).to.be.false;

            // Check that user no longer appears in accessible records
            const userRecords = await academicRecords.getRecordsWithZKAccess(sharedUser.address);
            expect(userRecords).to.not.include(recordId);
        });

        it("Should update merkle root when sharing/unsharing", async function () {
            const initialRecord = await zkAccessControl.getEncryptedRecord(recordId);
            const initialMerkleRoot = initialRecord.merkleRoot;

            // Share record
            await academicRecords.connect(student).shareRecord(recordId, sharedUser.address);
            
            const sharedRecord = await zkAccessControl.getEncryptedRecord(recordId);
            const sharedMerkleRoot = sharedRecord.merkleRoot;
            expect(sharedMerkleRoot).to.not.equal(initialMerkleRoot);

            // Unshare record
            await academicRecords.connect(student).unshareRecord(recordId, sharedUser.address);
            
            const unsharedRecord = await zkAccessControl.getEncryptedRecord(recordId);
            const unsharedMerkleRoot = unsharedRecord.merkleRoot;
            expect(unsharedMerkleRoot).to.not.equal(sharedMerkleRoot);
            expect(unsharedMerkleRoot).to.not.equal(initialMerkleRoot);
        });
    });

    describe("ZK Proof Verification", function () {
        let recordId: bigint;
        const originalIPFSHash = "QmOriginalHash123";

        beforeEach(async function () {
            const tx = await academicRecords.connect(university).addRecord(
                "STU004",
                "Bob Johnson",
                student.address,
                "Test University",
                originalIPFSHash,
                "QmMetadata123",
                2 // MARKSHEET
            );

            const receipt = await tx.wait();
            const recordAddedEvent = receipt?.logs.find(log => {
                try {
                    const parsed = academicRecords.interface.parseLog({
                        topics: log.topics,
                        data: log.data
                    });
                    return parsed?.name === "RecordAdded";
                } catch {
                    return false;
                }
            });

            const parsedEvent = academicRecords.interface.parseLog({
                topics: recordAddedEvent!.topics,
                data: recordAddedEvent!.data
            });
            recordId = parsedEvent?.args[0];
        });

        it("Should return empty hash for invalid ZK proof", async function () {
            // Create dummy proof data (invalid)
            const dummyProof = {
                _pA: [0, 0] as [number, number],
                _pB: [[0, 0], [0, 0]] as [[number, number], [number, number]],
                _pC: [0, 0] as [number, number],
                publicSignals: [Number(recordId), 0, 0] as [number, number, number]
            };

            const [record, decryptedHash] = await academicRecords.getRecordWithZKProof(
                recordId,
                dummyProof._pA,
                dummyProof._pB,
                dummyProof._pC,
                dummyProof.publicSignals,
                originalIPFSHash
            );

            expect(record.id).to.equal(recordId);
            expect(decryptedHash).to.equal(""); // Should be empty for invalid proof
        });

        it("Should revert when ZK Access Control is not configured", async function () {
            // Deploy RecordStorage library for new contract
            const RecordStorageFactory = await ethers.getContractFactory("RecordStorage");
            const newRecordStorage = await RecordStorageFactory.deploy();
            await newRecordStorage.waitForDeployment();
            const newRecordStorageAddress = await newRecordStorage.getAddress();

            // Deploy new Academic Records without ZK integration
            const AcademicRecordsFactory = await ethers.getContractFactory("AcademicRecords", {
                libraries: {
                    RecordStorage: newRecordStorageAddress,
                },
            });
            const newAcademicRecords = await AcademicRecordsFactory.deploy();
            await newAcademicRecords.waitForDeployment();

            // Grant university role and create a record first
            await newAcademicRecords.grantRole(UNIVERSITY_ROLE, university.address);
            const tx = await newAcademicRecords.connect(university).addRecord(
                "STU999",
                "Test Student",
                student.address,
                "Test University",
                "QmTestHash",
                "QmTestMetadata",
                0 // TRANSCRIPT
            );

            const receipt = await tx.wait();
            const recordAddedEvent = receipt?.logs.find(log => {
                try {
                    const parsed = newAcademicRecords.interface.parseLog({
                        topics: log.topics,
                        data: log.data
                    });
                    return parsed?.name === "RecordAdded";
                } catch {
                    return false;
                }
            });

            const parsedEvent = newAcademicRecords.interface.parseLog({
                topics: recordAddedEvent!.topics,
                data: recordAddedEvent!.data
            });
            const recordId = parsedEvent?.args[0];

            const dummyProof = {
                _pA: [0, 0] as [number, number],
                _pB: [[0, 0], [0, 0]] as [[number, number], [number, number]],
                _pC: [0, 0] as [number, number],
                publicSignals: [Number(recordId), 0, 0] as [number, number, number]
            };

            await expect(newAcademicRecords.getRecordWithZKProof(
                recordId,
                dummyProof._pA,
                dummyProof._pB,
                dummyProof._pC,
                dummyProof.publicSignals,
                "QmTestHash"
            )).to.be.revertedWith("ZK Access Control not configured");
        });
    });

    describe("Backward Compatibility", function () {
        it("Should store hashes directly when ZK Access Control is not set", async function () {
            // Deploy RecordStorage library for new contract
            const RecordStorageFactory = await ethers.getContractFactory("RecordStorage");
            const newRecordStorage = await RecordStorageFactory.deploy();
            await newRecordStorage.waitForDeployment();
            const newRecordStorageAddress = await newRecordStorage.getAddress();

            // Deploy new Academic Records without ZK integration
            const AcademicRecordsFactory = await ethers.getContractFactory("AcademicRecords", {
                libraries: {
                    RecordStorage: newRecordStorageAddress,
                },
            });
            const newAcademicRecords = await AcademicRecordsFactory.deploy();
            await newAcademicRecords.waitForDeployment();

            // Grant university role
            await newAcademicRecords.grantRole(UNIVERSITY_ROLE, university.address);

            const ipfsHash = "QmBackwardCompatHash";
            const metadataHash = "QmBackwardCompatMetadata";

            // Add record without ZK integration
            const tx = await newAcademicRecords.connect(university).addRecord(
                "STU005",
                "Charlie Brown",
                student.address,
                "Test University",
                ipfsHash,
                metadataHash,
                0 // TRANSCRIPT
            );

            const receipt = await tx.wait();
            const recordAddedEvent = receipt?.logs.find(log => {
                try {
                    const parsed = newAcademicRecords.interface.parseLog({
                        topics: log.topics,
                        data: log.data
                    });
                    return parsed?.name === "RecordAdded";
                } catch {
                    return false;
                }
            });

            const parsedEvent = newAcademicRecords.interface.parseLog({
                topics: recordAddedEvent!.topics,
                data: recordAddedEvent!.data
            });
            const recordId = parsedEvent?.args[0];

            // Check that hashes are stored directly in main contract
            const record = await newAcademicRecords.getRecord(recordId);
            expect(record.ipfsHash).to.equal(ipfsHash);
            expect(record.metadataHash).to.equal(metadataHash);
        });
    });

    describe("Access Control", function () {
        it("Should allow only admin to set ZK Access Control", async function () {
            const newZKContract = await (await ethers.getContractFactory("ZKAccessControl")).deploy(await verifier.getAddress());
            await newZKContract.waitForDeployment();

            // Admin should be able to set
            await expect(academicRecords.connect(admin).setZKAccessControl(await newZKContract.getAddress()))
                .to.not.be.reverted;

            // University should not be able to set
            await expect(academicRecords.connect(university).setZKAccessControl(await newZKContract.getAddress()))
                .to.be.reverted;

            // Student should not be able to set
            await expect(academicRecords.connect(student).setZKAccessControl(await newZKContract.getAddress()))
                .to.be.reverted;
        });

        it("Should revert when setting zero address as ZK Access Control", async function () {
            await expect(academicRecords.connect(admin).setZKAccessControl(ethers.ZeroAddress))
                .to.be.revertedWith("Invalid ZK Access Control address");
        });
    });
});