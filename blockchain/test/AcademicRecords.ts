import { expect } from "chai";
import { ethers } from "hardhat";

describe("AcademicRecords", function () {
  let academicRecords: any;
  let owner: any;
  let university: any;
  let student: any;
  let otherAccount: any;

  const UNIVERSITY_ROLE = ethers.keccak256(
    ethers.toUtf8Bytes("UNIVERSITY_ROLE")
  );
  const ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_ROLE"));

  beforeEach(async function () {
    // Get signers
    [owner, university, student, otherAccount] = await ethers.getSigners();

    // Deploy RecordStorage library
    const RecordStorage = await ethers.getContractFactory("RecordStorage");
    const recordStorage = await RecordStorage.deploy();
    await recordStorage.waitForDeployment();
    const recordStorageAddress = await recordStorage.getAddress();

    // Deploy the contract with library linking
    const AcademicRecords = await ethers.getContractFactory("AcademicRecords", {
      libraries: {
        RecordStorage: recordStorageAddress,
      },
    });
    academicRecords = await AcademicRecords.deploy();

    // Add university role
    await academicRecords.addUniversity(university.address, "Test University");
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await academicRecords.hasRole(ADMIN_ROLE, owner.address)).to.equal(
        true
      );
    });

    it("Should assign university role correctly", async function () {
      expect(
        await academicRecords.hasRole(UNIVERSITY_ROLE, university.address)
      ).to.equal(true);
    });
  });

  describe("Record Management", function () {
    it("Should allow university to add a record", async function () {
      const studentId = "S12345";
      const studentName = "John Doe";
      const studentAddress = "0x1234567890123456789012345678901234567890"; // Example address
      const universityName = "Example University";
      const ipfsHash = "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco";
      const metadataHash = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";
      const recordType = 0; // TRANSCRIPT

      await expect(
        academicRecords
          .connect(university)
          .addRecord(
            studentId,
            studentName,
            studentAddress,
            universityName,
            ipfsHash,
            metadataHash,
            recordType
          )
      )
        .to.emit(academicRecords, "RecordAdded")
        .withArgs(1, studentId, recordType, university.address);

      const record = await academicRecords.getRecord(1);
      expect(record.studentId).to.equal(studentId);
      expect(record.studentName).to.equal(studentName);
      expect(record.universityName).to.equal(universityName);
      expect(record.ipfsHash).to.equal(ipfsHash);
      expect(record.metadataHash).to.equal(metadataHash);
      expect(record.recordType).to.equal(recordType);
      expect(record.isVerified).to.equal(true);
      expect(record.issuer).to.equal(university.address);
    });

    it("Should not allow non-university to add a record", async function () {
      await expect(
        academicRecords
          .connect(student)
          .addRecord(
            "S12345",
            "John Doe",
            "Example University",
            "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
            "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
            0
          )
      ).to.be.revertedWithCustomError(
        academicRecords,
        "AccessControlUnauthorizedAccount"
      );
    });

    it("Should retrieve student records correctly", async function () {
      const studentId = "S12345";

      // Add two records for the same student
      await academicRecords.connect(university).addRecord(
        studentId,
        "John Doe",
        "Example University",
        "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
        "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
        0 // TRANSCRIPT
      );

      await academicRecords.connect(university).addRecord(
        studentId,
        "John Doe",
        "Example University",
        "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
        "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
        1 // CERTIFICATE
      );

      const studentRecords = await academicRecords.getStudentRecords(studentId);
      expect(studentRecords.length).to.equal(2);
      expect(studentRecords[0]).to.equal(1);
      expect(studentRecords[1]).to.equal(2);
    });
  });

  describe("Access Control", function () {
    it("Should allow admin to add and remove universities", async function () {
      await academicRecords.addUniversity(otherAccount.address);
      expect(
        await academicRecords.hasRole(UNIVERSITY_ROLE, otherAccount.address)
      ).to.equal(true);

      await academicRecords.removeUniversity(otherAccount.address);
      expect(
        await academicRecords.hasRole(UNIVERSITY_ROLE, otherAccount.address)
      ).to.equal(false);
    });

    it("Should not allow non-admin to add universities", async function () {
      await expect(
        academicRecords.connect(university).addUniversity(otherAccount.address)
      ).to.be.revertedWithCustomError(
        academicRecords,
        "AccessControlUnauthorizedAccount"
      );
    });
  });

  describe("Pause Functionality", function () {
    it("Should allow admin to pause and unpause", async function () {
      await academicRecords.pause();

      // Try to add a record while paused
      await expect(
        academicRecords
          .connect(university)
          .addRecord(
            "S12345",
            "John Doe",
            "Example University",
            "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
            "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
            0
          )
      ).to.be.revertedWith("Pausable: paused");

      // Unpause and try again
      await academicRecords.unpause();
      await expect(
        academicRecords
          .connect(university)
          .addRecord(
            "S12345",
            "John Doe",
            "Example University",
            "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
            "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
            0
          )
      ).to.not.be.reverted;
    });
  });
});
