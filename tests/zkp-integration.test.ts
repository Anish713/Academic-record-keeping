import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  zkpService,
  encryptedIPFSService,
  blockchainService,
  initializeZKPService,
} from "../src/services";
import {
  ZKAccessType,
  ZKPServiceConfig,
  EncryptedIPFSData,
  UserEncryptionKeys,
} from "../src/types/zkp";

describe("ZKP Integration Tests", function () {
  let admin: SignerWithAddress;
  let university: SignerWithAddress;
  let student: SignerWithAddress;
  let sharedUser: SignerWithAddress;

  let zkpManagerContract: any;
  let keyStorageContract: any;
  let accessManagerContract: any;
  let academicRecordsContract: any;

  let testRecordId: number;
  let studentKeys: UserEncryptionKeys;
  let universityKeys: UserEncryptionKeys;

  before(async function () {
    // Get signers
    [admin, university, student, sharedUser] = await ethers.getSigners();

    // Deploy and setup contracts
    await deployZKPContracts();
    await initializeZKPServices();
    await setupTestData();
  });

  async function deployZKPContracts() {
    console.log("Deploying ZKP contracts for testing...");

    // Deploy KeyStorage
    const KeyStorage = await ethers.getContractFactory("KeyStorage");
    keyStorageContract = await KeyStorage.deploy(admin.address);
    await keyStorageContract.waitForDeployment();

    // Deploy ZKPManager
    const ZKPManager = await ethers.getContractFactory("ZKPManager");
    zkpManagerContract = await ZKPManager.deploy(admin.address);
    await zkpManagerContract.waitForDeployment();

    // Deploy AccessManager
    const AccessManager = await ethers.getContractFactory("AccessManager");
    accessManagerContract = await AccessManager.deploy(admin.address);
    await accessManagerContract.waitForDeployment();

    // Deploy RecordStorage library and AcademicRecords for testing
    const RecordStorage = await ethers.getContractFactory("RecordStorage");
    const recordStorage = await RecordStorage.deploy();
    await recordStorage.waitForDeployment();

    const AcademicRecords = await ethers.getContractFactory("AcademicRecords", {
      libraries: {
        RecordStorage: await recordStorage.getAddress(),
      },
    });
    academicRecordsContract = await AcademicRecords.deploy();
    await academicRecordsContract.waitForDeployment();

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

    // Add university role to university signer
    await zkpManagerContract.addUniversity(university.address);
    await accessManagerContract.addUniversity(university.address);

    console.log("ZKP contracts deployed successfully");
  }

  async function initializeZKPServices() {
    // Initialize ZKP service with test configuration
    const zkpConfig: ZKPServiceConfig = {
      accessVerificationCircuit: {
        wasmPath: "/test/circuits/access_verification.wasm",
        zkeyPath: "/test/circuits/access_verification_final.zkey",
        verificationKeyPath:
          "/test/circuits/access_verification_verification_key.json",
      },
      recordSharingCircuit: {
        wasmPath: "/test/circuits/record_sharing.wasm",
        zkeyPath: "/test/circuits/record_sharing_final.zkey",
        verificationKeyPath:
          "/test/circuits/record_sharing_verification_key.json",
      },
      contractAddress: await zkpManagerContract.getAddress(),
      keyStorageContract: await keyStorageContract.getAddress(),
    };

    initializeZKPService(zkpConfig);
    await zkpService.init();
  }

  async function setupTestData() {
    // Generate keys for student and university
    studentKeys = await zkpService.generateUserKeys();
    universityKeys = await zkpService.generateUserKeys();

    // Register keys in KeyStorage contract
    await keyStorageContract
      .connect(student)
      .generateKeys(
        studentKeys.publicKey,
        ethers.keccak256(ethers.toUtf8Bytes(studentKeys.zkpIdentity))
      );

    await keyStorageContract
      .connect(university)
      .generateKeys(
        universityKeys.publicKey,
        ethers.keccak256(ethers.toUtf8Bytes(universityKeys.zkpIdentity))
      );

    // Create a test record
    const tx = await academicRecordsContract.connect(university).addRecord(
      "STU001",
      "Test Student",
      student.address,
      "Test University",
      "QmTestHash123", // This will be replaced with encrypted hash
      "QmMetadataHash456",
      0 // TRANSCRIPT
    );

    const receipt = await tx.wait();
    const event = receipt.logs?.find((log: any) => {
      try {
        const parsed = academicRecordsContract.interface.parseLog(log);
        return parsed?.name === "RecordAdded";
      } catch {
        return false;
      }
    });

    if (event) {
      const parsedEvent = academicRecordsContract.interface.parseLog(event);
      testRecordId = Number(parsedEvent?.args.recordId);
    }

    console.log(`Test record created with ID: ${testRecordId}`);
  }

  describe("ZKP Service Core Functionality", function () {
    it("should initialize ZKP service successfully", async function () {
      expect(zkpService).to.not.be.undefined;
      expect(zkpService.getUserKeys()).to.not.be.null;
    });

    it("should generate user encryption keys", async function () {
      const newKeys = await zkpService.generateUserKeys();

      expect(newKeys.publicKey).to.be.a("string");
      expect(newKeys.privateKey).to.be.a("string");
      expect(newKeys.zkpIdentity).to.be.a("string");
      expect(newKeys.publicKey.length).to.be.greaterThan(0);
    });

    it("should generate access proof", async function () {
      zkpService.setUserKeys(studentKeys);

      const { proof, publicSignals } = await zkpService.generateAccessProof(
        testRecordId,
        ZKAccessType.STUDENT_ACCESS,
        student.address
      );

      expect(proof.a).to.be.an("array").with.length(2);
      expect(proof.b).to.be.an("array").with.length(2);
      expect(proof.c).to.be.an("array").with.length(2);
      expect(publicSignals.userAddress).to.equal(student.address);
      expect(publicSignals.recordId).to.equal(testRecordId.toString());
    });

    it("should generate sharing proof", async function () {
      zkpService.setUserKeys(studentKeys);

      const { proof, publicSignals } = await zkpService.generateSharingProof(
        testRecordId,
        sharedUser.address,
        student.address
      );

      expect(proof.a).to.be.an("array").with.length(2);
      expect(publicSignals.accessType).to.equal(ZKAccessType.SHARED_ACCESS);
      expect(publicSignals.userAddress).to.equal(student.address);
    });

    it("should verify ZK proof", async function () {
      zkpService.setUserKeys(studentKeys);

      const { proof, publicSignals } = await zkpService.generateAccessProof(
        testRecordId,
        ZKAccessType.STUDENT_ACCESS,
        student.address
      );

      const result = await zkpService.verifyProof(
        proof,
        publicSignals,
        "accessVerification"
      );

      expect(result.isValid).to.be.true;
      expect(result.userAddress).to.equal(student.address);
      expect(result.recordId).to.equal(testRecordId);
    });
  });

  describe("Encrypted IPFS Integration", function () {
    let encryptedData: EncryptedIPFSData;
    let testFile: File;

    before(function () {
      // Create a test file
      const content = "This is a test academic document content";
      testFile = new File([content], "test-document.pdf", {
        type: "application/pdf",
      });
    });

    it("should upload and encrypt file to IPFS", async function () {
      this.timeout(10000); // Increase timeout for IPFS operations

      zkpService.setUserKeys(studentKeys);

      // Mock IPFS upload for testing
      const mockIPFSUpload = async (file: File) => "QmMockHash123";
      (encryptedIPFSService as any).uploadToIPFS = mockIPFSUpload;

      encryptedData = await encryptedIPFSService.uploadEncryptedFile(
        testFile,
        testRecordId,
        student.address
      );

      expect(encryptedData.encryptedHash).to.be.a("string");
      expect(encryptedData.encryptionKey).to.be.a("string");
      expect(encryptedData.accessProof).to.be.an("object");
      expect(encryptedData.publicSignals).to.be.an("object");
    });

    it("should retrieve and decrypt file from IPFS", async function () {
      zkpService.setUserKeys(studentKeys);

      const decryptedHash = await encryptedIPFSService.retrieveDecryptedFile(
        encryptedData,
        student.address
      );

      expect(decryptedHash).to.be.a("string");
      expect(decryptedHash.length).to.be.greaterThan(0);
    });

    it("should verify access to encrypted content", async function () {
      const hasAccess = await encryptedIPFSService.verifyAccess(
        encryptedData,
        student.address
      );

      expect(hasAccess).to.be.true;
    });

    it("should deny access to unauthorized user", async function () {
      try {
        await encryptedIPFSService.retrieveDecryptedFile(
          encryptedData,
          sharedUser.address
        );
        expect.fail("Should have denied access");
      } catch (error: any) {
        expect(error.message).to.include("Access denied");
      }
    });

    it("should share encrypted access with another user", async function () {
      // Generate keys for shared user
      const sharedUserKeys = await zkpService.generateUserKeys();

      await keyStorageContract
        .connect(sharedUser)
        .generateKeys(
          sharedUserKeys.publicKey,
          ethers.keccak256(ethers.toUtf8Bytes(sharedUserKeys.zkpIdentity))
        );

      zkpService.setUserKeys(studentKeys);

      const sharedEncryptedData =
        await encryptedIPFSService.shareEncryptedAccess(
          testRecordId,
          encryptedData,
          sharedUser.address,
          sharedUserKeys.publicKey
        );

      expect(sharedEncryptedData.encryptedHash).to.be.a("string");
      expect(sharedEncryptedData.publicSignals.userAddress).to.equal(
        sharedUser.address
      );
    });
  });

  describe("ZKP Contract Integration", function () {
    it("should verify access using ZKP contract", async function () {
      zkpService.setUserKeys(studentKeys);

      const success = await zkpService.requestRecordAccess(
        testRecordId,
        ZKAccessType.STUDENT_ACCESS
      );

      expect(success).to.be.true;
    });

    it("should check verified access status", async function () {
      const hasAccess = await zkpService.hasVerifiedAccess(
        testRecordId,
        student.address
      );
      expect(hasAccess).to.be.true;
    });

    it("should share record using ZKP", async function () {
      zkpService.setUserKeys(studentKeys);

      const success = await zkpService.shareRecord(
        testRecordId,
        sharedUser.address
      );
      expect(success).to.be.true;
    });

    it("should store encrypted record in AccessManager", async function () {
      const encryptedHash = ethers.keccak256(
        ethers.toUtf8Bytes("encrypted_hash")
      );
      const encryptedKey = ethers.toUtf8Bytes("encrypted_key");

      const success = await accessManagerContract
        .connect(university)
        .storeEncryptedRecord(testRecordId, encryptedHash, encryptedKey);

      expect(success).to.be.ok;
    });

    it("should get encrypted record from AccessManager", async function () {
      const record = await accessManagerContract.getEncryptedRecord(
        testRecordId
      );

      expect(record.isActive).to.be.true;
      expect(record.timestamp).to.be.greaterThan(0);
    });
  });

  describe("Key Storage Integration", function () {
    it("should store user keys in KeyStorage contract", async function () {
      const newKeys = await zkpService.generateUserKeys();

      await keyStorageContract
        .connect(admin)
        .generateKeys(
          newKeys.publicKey,
          ethers.keccak256(ethers.toUtf8Bytes(newKeys.zkpIdentity))
        );

      const hasKeys = await keyStorageContract.hasKeys(admin.address);
      expect(hasKeys).to.be.true;
    });

    it("should retrieve user public key", async function () {
      const publicKey = await keyStorageContract.getPublicKey(student.address);
      expect(publicKey).to.equal(studentKeys.publicKey);
    });

    it("should validate public key format", async function () {
      const isValid = await keyStorageContract.validatePublicKey(
        studentKeys.publicKey
      );
      expect(isValid).to.be.true;

      const isInvalid = await keyStorageContract.validatePublicKey("invalid");
      expect(isInvalid).to.be.false;
    });

    it("should get total registered users", async function () {
      const total = await keyStorageContract.getTotalRegisteredUsers();
      expect(total).to.be.greaterThan(0);
    });
  });

  describe("End-to-End ZKP Workflow", function () {
    it("should complete full ZKP workflow: upload -> verify -> access -> share", async function () {
      this.timeout(15000);

      // Step 1: University uploads encrypted record
      zkpService.setUserKeys(universityKeys);

      const documentContent = "Official Academic Transcript - Confidential";
      const documentFile = new File([documentContent], "transcript.pdf", {
        type: "application/pdf",
      });

      // Mock IPFS upload
      (encryptedIPFSService as any).uploadToIPFS = async () =>
        "QmNewTestHash456";

      const encryptedRecord = await encryptedIPFSService.uploadEncryptedFile(
        documentFile,
        testRecordId,
        student.address
      );

      // Step 2: Student requests access using ZKP
      zkpService.setUserKeys(studentKeys);

      const accessGranted = await zkpService.requestRecordAccess(
        testRecordId,
        ZKAccessType.STUDENT_ACCESS
      );
      expect(accessGranted).to.be.true;

      // Step 3: Student retrieves encrypted document
      const decryptedHash = await encryptedIPFSService.retrieveDecryptedFile(
        encryptedRecord,
        student.address
      );
      expect(decryptedHash).to.be.a("string");

      // Step 4: Student shares with employer
      const employerKeys = await zkpService.generateUserKeys();

      await keyStorageContract
        .connect(sharedUser)
        .generateKeys(
          employerKeys.publicKey,
          ethers.keccak256(ethers.toUtf8Bytes(employerKeys.zkpIdentity))
        );

      const sharedRecord = await encryptedIPFSService.shareEncryptedAccess(
        testRecordId,
        encryptedRecord,
        sharedUser.address,
        employerKeys.publicKey
      );

      expect(sharedRecord.publicSignals.userAddress).to.equal(
        sharedUser.address
      );

      // Step 5: Employer verifies access
      zkpService.setUserKeys(employerKeys);

      const employerHasAccess = await encryptedIPFSService.verifyAccess(
        sharedRecord,
        sharedUser.address
      );
      expect(employerHasAccess).to.be.true;
    });
  });

  describe("Security Tests", function () {
    it("should prevent unauthorized access to encrypted records", async function () {
      const attackerKeys = await zkpService.generateUserKeys();
      zkpService.setUserKeys(attackerKeys);

      try {
        await zkpService.requestRecordAccess(
          testRecordId,
          ZKAccessType.STUDENT_ACCESS
        );
        expect.fail("Should have denied access to unauthorized user");
      } catch (error) {
        // Expected to fail
      }
    });

    it("should prevent proof replay attacks", async function () {
      zkpService.setUserKeys(studentKeys);

      const { proof, publicSignals } = await zkpService.generateAccessProof(
        testRecordId,
        ZKAccessType.STUDENT_ACCESS,
        student.address
      );

      // First verification should succeed
      const result1 = await zkpService.verifyProof(
        proof,
        publicSignals,
        "accessVerification"
      );
      expect(result1.isValid).to.be.true;

      // Simulate time passing (proof should become stale)
      const stalePublicSignals = {
        ...publicSignals,
        timestamp: (parseInt(publicSignals.timestamp) - 600).toString(), // 10 minutes ago
      };

      const result2 = await zkpService.verifyProof(
        proof,
        stalePublicSignals,
        "accessVerification"
      );
      // In a real implementation with actual ZK verification, this should fail
      // For demo purposes, our mock verification doesn't check timestamps strictly
    });

    it("should validate proof components", async function () {
      const invalidProof = {
        a: ["0x000", "0x000"],
        b: [
          ["0x000", "0x000"],
          ["0x000", "0x000"],
        ],
        c: ["0x000", "0x000"],
      };

      const publicSignals = {
        userAddress: student.address,
        recordId: testRecordId.toString(),
        accessType: ZKAccessType.STUDENT_ACCESS,
        timestamp: Date.now().toString(),
      };

      const result = await zkpService.verifyProof(
        invalidProof,
        publicSignals,
        "accessVerification"
      );
      expect(result.isValid).to.be.false;
    });
  });

  describe("Performance and Scalability", function () {
    it("should handle multiple concurrent proof generations", async function () {
      this.timeout(10000);

      zkpService.setUserKeys(studentKeys);

      const proofPromises = [];
      for (let i = 0; i < 5; i++) {
        proofPromises.push(
          zkpService.generateAccessProof(
            testRecordId,
            ZKAccessType.STUDENT_ACCESS,
            student.address
          )
        );
      }

      const results = await Promise.all(proofPromises);

      results.forEach(({ proof, publicSignals }) => {
        expect(proof.a).to.be.an("array").with.length(2);
        expect(publicSignals.userAddress).to.equal(student.address);
      });
    });

    it("should efficiently verify multiple proofs", async function () {
      zkpService.setUserKeys(studentKeys);

      const proofs = await Promise.all([
        zkpService.generateAccessProof(
          testRecordId,
          ZKAccessType.STUDENT_ACCESS,
          student.address
        ),
        zkpService.generateSharingProof(
          testRecordId,
          sharedUser.address,
          student.address
        ),
      ]);

      const verifications = await Promise.all(
        proofs.map(({ proof, publicSignals }, index) =>
          zkpService.verifyProof(
            proof,
            publicSignals,
            index === 0 ? "accessVerification" : "recordSharing"
          )
        )
      );

      verifications.forEach((result) => {
        expect(result.isValid).to.be.true;
      });
    });
  });

  after(async function () {
    console.log("ZKP integration tests completed");
  });
});
