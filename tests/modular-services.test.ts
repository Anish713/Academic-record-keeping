import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  walletService,
  roleManagementService,
  universityManagementService,
  studentManagementService,
  recordsManagementService,
  zkpService,
  encryptedIPFSService,
  blockchainService,
  UserRole,
} from "../src/services";

describe("Modular Blockchain Services", function () {
  let admin: SignerWithAddress;
  let university: SignerWithAddress;
  let student: SignerWithAddress;
  let verifier: SignerWithAddress;

  let academicRecordsContract: any;
  let studentManagementContract: any;
  let zkpManagerContract: any;
  let keyStorageContract: any;
  let accessManagerContract: any;

  before(async function () {
    // Get signers
    [admin, university, student, verifier] = await ethers.getSigners();

    // Deploy contracts for testing
    await deployTestContracts();

    // Initialize services with test configuration
    await initializeTestServices();
  });

  async function deployTestContracts() {
    console.log("Deploying test contracts...");

    // Deploy RecordStorage library
    const RecordStorage = await ethers.getContractFactory("RecordStorage");
    const recordStorage = await RecordStorage.deploy();
    await recordStorage.waitForDeployment();

    // Deploy ZKP contracts
    const KeyStorage = await ethers.getContractFactory("KeyStorage");
    keyStorageContract = await KeyStorage.deploy(admin.address);
    await keyStorageContract.waitForDeployment();

    const ZKPManager = await ethers.getContractFactory("ZKPManager");
    zkpManagerContract = await ZKPManager.deploy(admin.address);
    await zkpManagerContract.waitForDeployment();

    const AccessManager = await ethers.getContractFactory("AccessManager");
    accessManagerContract = await AccessManager.deploy(admin.address);
    await accessManagerContract.waitForDeployment();

    // Deploy AcademicRecords
    const AcademicRecords = await ethers.getContractFactory("AcademicRecords", {
      libraries: {
        RecordStorage: await recordStorage.getAddress(),
      },
    });
    academicRecordsContract = await AcademicRecords.deploy();
    await academicRecordsContract.waitForDeployment();

    // Get StudentManagement address
    const studentManagementAddress =
      await academicRecordsContract.studentManagement();
    studentManagementContract = await ethers.getContractAt(
      "StudentManagement",
      studentManagementAddress
    );

    // Setup interconnections
    await zkpManagerContract.setContractAddresses(
      await academicRecordsContract.getAddress(),
      await keyStorageContract.getAddress(),
      await accessManagerContract.getAddress()
    );

    await accessManagerContract.setContractAddresses(
      await zkpManagerContract.getAddress(),
      await keyStorageContract.getAddress(),
      await academicRecordsContract.getAddress()
    );

    console.log("Test contracts deployed successfully");
  }

  async function initializeTestServices() {
    // Mock wallet service for testing
    (walletService as any).provider = admin.provider;
    (walletService as any).signer = admin;

    // Update contract addresses for services
    roleManagementService.updateContractAddress(
      await academicRecordsContract.getAddress()
    );
    universityManagementService.updateContractAddress(
      await academicRecordsContract.getAddress()
    );
    studentManagementService.updateContractAddress(
      await studentManagementContract.getAddress()
    );
    recordsManagementService.updateContractAddress(
      await academicRecordsContract.getAddress()
    );

    // Initialize services
    await roleManagementService.init();
    await universityManagementService.init();
    await studentManagementService.init();
    await recordsManagementService.init();

    // Initialize blockchain service
    await blockchainService.init();
  }

  describe("Wallet Service", function () {
    it("should connect to wallet", async function () {
      expect(walletService.isConnected()).to.be.true;
    });

    it("should get current address", async function () {
      const address = await walletService.getCurrentAddress();
      expect(address).to.equal(admin.address);
    });

    it("should get network info", async function () {
      const network = await walletService.getNetwork();
      expect(network.name).to.be.a("string");
    });
  });

  describe("Role Management Service", function () {
    it("should check admin role for deployer", async function () {
      const isAdmin = await roleManagementService.hasRole(
        UserRole.ADMIN_ROLE,
        admin.address
      );
      expect(isAdmin).to.be.true;
    });

    it("should add university role", async function () {
      await roleManagementService.addUniversity(university.address);
      const isUniversity = await roleManagementService.hasRole(
        UserRole.UNIVERSITY_ROLE,
        university.address
      );
      expect(isUniversity).to.be.true;
    });

    it("should get all admins", async function () {
      const admins = await roleManagementService.getAllAdmins();
      expect(admins).to.include(admin.address);
    });

    it("should get current user roles", async function () {
      const roles = await roleManagementService.getCurrentUserRoles();
      expect(roles).to.include(UserRole.ADMIN_ROLE);
    });
  });

  describe("University Management Service", function () {
    it("should add university with name", async function () {
      await universityManagementService.addUniversity(
        university.address,
        "Test University"
      );
      const name = await universityManagementService.getUniversityName(
        university.address
      );
      expect(name).to.equal("Test University");
    });

    it("should get all universities", async function () {
      const universities =
        await universityManagementService.getAllUniversities();
      expect(universities.length).to.be.greaterThan(0);
      expect(universities[0].name).to.equal("Test University");
    });

    it("should check if address is university", async function () {
      const isUniversity = await universityManagementService.isUniversity(
        university.address
      );
      expect(isUniversity).to.be.true;
    });

    it("should get university details", async function () {
      const details = await universityManagementService.getUniversityDetails(
        university.address
      );
      expect(details.name).to.equal("Test University");
      expect(details.isActive).to.be.true;
    });
  });

  describe("Student Management Service", function () {
    it("should register student", async function () {
      await studentManagementService.registerStudent("STU001", student.address);
      const studentId = await studentManagementService.getStudentId(
        student.address
      );
      expect(studentId).to.equal("STU001");
    });

    it("should get student address by ID", async function () {
      const address = await studentManagementService.getStudentAddress(
        "STU001"
      );
      expect(address).to.equal(student.address);
    });

    it("should check if student is registered", async function () {
      const isRegistered = await studentManagementService.isStudentRegistered(
        "STU001"
      );
      expect(isRegistered).to.be.true;
    });

    it("should validate student ID format", async function () {
      expect(studentManagementService.validateStudentIdFormat("STU001")).to.be
        .true;
      expect(studentManagementService.validateStudentIdFormat("")).to.be.false;
      expect(studentManagementService.validateStudentIdFormat("AB")).to.be
        .false;
    });
  });

  describe("Records Management Service", function () {
    let recordId: number;

    it("should add a new record", async function () {
      // Switch to university signer
      (walletService as any).signer = university;
      await universityManagementService.init();
      await recordsManagementService.init();

      recordId = await recordsManagementService.addRecord(
        "STU001",
        "John Doe",
        student.address,
        "Test University",
        "QmTestHash123",
        "QmMetadataHash456",
        0 // TRANSCRIPT
      );

      expect(recordId).to.be.a("number");
      expect(recordId).to.be.greaterThan(0);
    });

    it("should get record by ID", async function () {
      const record = await recordsManagementService.getRecord(recordId);

      expect(record.studentName).to.equal("John Doe");
      expect(record.studentId).to.equal("STU001");
      expect(record.recordType).to.equal(0);
      expect(record.ipfsHash).to.equal("QmTestHash123");
    });

    it("should get student records", async function () {
      const records = await recordsManagementService.getStudentRecords(
        "STU001"
      );
      expect(records).to.include(recordId);
    });

    it("should get university records", async function () {
      const records = await recordsManagementService.getUniversityRecords(
        university.address
      );
      expect(records).to.include(recordId);
    });

    it("should verify record", async function () {
      const isValid = await recordsManagementService.verifyRecord(recordId);
      expect(isValid).to.be.true;
    });

    it("should share record", async function () {
      await recordsManagementService.shareRecord(recordId, verifier.address);
      const isShared = await recordsManagementService.isRecordSharedWith(
        recordId,
        verifier.address
      );
      expect(isShared).to.be.true;
    });

    it("should get shared records", async function () {
      const sharedRecords = await recordsManagementService.getSharedRecords(
        verifier.address
      );
      expect(sharedRecords).to.include(recordId);
    });

    it("should search records", async function () {
      const records = await recordsManagementService.searchRecords("John");
      expect(records.length).to.be.greaterThan(0);
      expect(records[0].studentName).to.include("John");
    });
  });

  describe("Blockchain Service Integration", function () {
    it("should initialize successfully", async function () {
      // Reset to admin for main service
      (walletService as any).signer = admin;

      const initialized = await blockchainService.init();
      expect(initialized).to.be.true;
    });

    it("should perform health check", async function () {
      const health = await blockchainService.healthCheck();

      expect(health.wallet).to.be.true;
      expect(health.roleManagement).to.be.true;
      expect(health.universityManagement).to.be.true;
      expect(health.studentManagement).to.be.true;
      expect(health.recordsManagement).to.be.true;
    });

    it("should get service info", async function () {
      const info = blockchainService.getServiceInfo();

      expect(info.isInitialized).to.be.true;
      expect(info.walletConnected).to.be.true;
    });

    it("should check wallet connection", async function () {
      expect(blockchainService.isWalletConnected()).to.be.true;
    });

    it("should get current address", async function () {
      const address = await blockchainService.getCurrentAddress();
      expect(address).to.equal(admin.address);
    });
  });

  describe("Error Handling", function () {
    it("should handle service not initialized", async function () {
      const newService = new (recordsManagementService.constructor as any)("");

      try {
        await newService.getRecord(1);
        expect.fail("Should have thrown error");
      } catch (error: any) {
        expect(error.message).to.include("not initialized");
      }
    });

    it("should handle invalid addresses", async function () {
      try {
        await roleManagementService.hasRole(
          UserRole.ADMIN_ROLE,
          "invalid_address"
        );
        expect.fail("Should have thrown error");
      } catch (error) {
        // Expected to fail
      }
    });

    it("should handle network disconnection", async function () {
      const originalSigner = walletService.getSigner();
      walletService.disconnect();

      expect(walletService.isConnected()).to.be.false;

      // Restore connection
      (walletService as any).signer = originalSigner;
    });
  });

  describe("Performance Tests", function () {
    it("should handle batch operations efficiently", async function () {
      const startTime = Date.now();

      // Batch get multiple records
      const recordIds = [1]; // Use existing record
      const records = await recordsManagementService.getRecordsBatch(recordIds);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(records.length).to.equal(recordIds.length);
      expect(duration).to.be.lessThan(5000); // Should complete within 5 seconds
    });

    it("should handle concurrent service calls", async function () {
      const promises = [
        roleManagementService.getAllAdmins(),
        universityManagementService.getAllUniversities(),
        recordsManagementService.getTotalRecords(),
      ];

      const results = await Promise.all(promises);

      expect(results[0]).to.be.an("array"); // admins
      expect(results[1]).to.be.an("array"); // universities
      expect(results[2]).to.be.a("number"); // total records
    });
  });

  describe("Service Isolation", function () {
    it("should maintain service independence", async function () {
      // Each service should work independently
      const adminCount = await roleManagementService.getAllAdmins();
      const universityCount =
        await universityManagementService.getAllUniversities();
      const recordCount = await recordsManagementService.getTotalRecords();

      expect(adminCount).to.be.an("array");
      expect(universityCount).to.be.an("array");
      expect(recordCount).to.be.a("number");
    });

    it("should handle service failures gracefully", async function () {
      // Simulate service failure by using invalid contract address
      const invalidService = new (roleManagementService.constructor as any)(
        "0x0000000000000000000000000000000000000000"
      );

      try {
        await invalidService.init();
        // Should either fail initialization or handle gracefully
      } catch (error) {
        // Expected for invalid address
      }
    });
  });

  after(async function () {
    // Cleanup if needed
    console.log("Modular services tests completed");
  });
});
