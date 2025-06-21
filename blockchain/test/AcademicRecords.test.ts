import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";

describe("AcademicRecords", function () {
  let academicRecords: Contract;
  let deployer: any, admin: any, university: any, university2: any, student: any, viewer: any;

  beforeEach(async function () {
    [deployer, admin, university, university2, student, viewer] = await ethers.getSigners();

    const AcademicRecords = await ethers.getContractFactory("AcademicRecords");
    academicRecords = await AcademicRecords.connect(deployer).deploy();
    await academicRecords.waitForDeployment();

    // Super admin grants admin role
    await academicRecords.connect(deployer).addAdmin(admin.address);

    // Admin adds universities
    await academicRecords.connect(admin).addUniversity(university.address, "University A");
    await academicRecords.connect(admin).addUniversity(university2.address, "University B");
  });

  it("Should set deployer as super admin", async function () {
    const DEFAULT_ADMIN_ROLE = await academicRecords.DEFAULT_ADMIN_ROLE();
    expect(await academicRecords.hasRole(DEFAULT_ADMIN_ROLE, deployer.address)).to.be.true;
  });

  it("Super admin can add and remove admins", async function () {
    const ADMIN_ROLE = await academicRecords.ADMIN_ROLE();

    expect(await academicRecords.hasRole(ADMIN_ROLE, admin.address)).to.be.true;

    await academicRecords.connect(deployer).removeAdmin(admin.address);
    expect(await academicRecords.hasRole(ADMIN_ROLE, admin.address)).to.be.false;
  });

  it("Admin can add and remove universities", async function () {
    const UNIVERSITY_ROLE = await academicRecords.UNIVERSITY_ROLE();
    expect(await academicRecords.hasRole(UNIVERSITY_ROLE, university.address)).to.be.true;

    await academicRecords.connect(admin).removeUniversity(university.address);
    expect(await academicRecords.hasRole(UNIVERSITY_ROLE, university.address)).to.be.false;
  });

  it("University can add a record", async function () {
    const tx = await academicRecords.connect(university).addRecord(
      "stu001",
      "Alice",
      "University A",
      "QmIpfsHash",
      "QmMetadataHash",
      0 // RecordType.TRANSCRIPT
    );

    const receipt = await tx.wait();
    const recordId = receipt?.logs[0]?.args?.recordId;

    const record = await academicRecords.getRecord(recordId);
    expect(record.studentId).to.equal("stu001");
    expect(record.studentName).to.equal("Alice");
    expect(record.ipfsHash).to.equal("QmIpfsHash");
  });

  it("University can delete student records", async function () {
    const tx = await academicRecords.connect(university).addRecord(
      "stu002",
      "Bob",
      "University A",
      "QmIpfsHash2",
      "QmMetadataHash2",
      1 // CERTIFICATE
    );
    const receipt = await tx.wait();
    const recordId = receipt?.logs[0]?.args?.recordId;

    await academicRecords.connect(university).deleteStudentRecord(recordId);

    await expect(academicRecords.getRecord(recordId)).to.be.revertedWith("Record does not exist");
  });

  it("University can add custom record type", async function () {
    const tx = await academicRecords.connect(university).addCustomRecordType("HONOR_AWARD");
    await tx.wait();

    const customType = await academicRecords.getCustomRecordTypeId("HONOR_AWARD");
    expect(customType).to.be.a("bigint"); // or use `to.be.gt(3)` if enums start from 0
  });

  it("Student can grant and revoke access to record", async function () {
    // University adds a record for student
    const tx = await academicRecords.connect(university).addRecord(
      "stu003",
      "Charlie",
      "University A",
      "QmHash",
      "QmMetaHash",
      0
    );
    const receipt = await tx.wait();
    const recordId = receipt?.logs[0]?.args?.recordId;

    // Assume the student is msg.sender here for demo purposes
    await academicRecords.connect(student).grantAccessToRecord("stu003", recordId, viewer.address);

    const sharedRecord = await academicRecords.connect(viewer).getSharedRecord("stu003", recordId);
    expect(sharedRecord.ipfsHash).to.equal("QmHash");

    await academicRecords.connect(student).revokeAccessFromRecord("stu003", recordId, viewer.address);

    await expect(
      academicRecords.connect(viewer).getSharedRecord("stu003", recordId)
    ).to.be.revertedWith("Access not granted");
  });
});
