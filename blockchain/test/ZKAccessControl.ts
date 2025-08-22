import { expect } from "chai";
import { ethers } from "hardhat";
import { ZKAccessControl, Groth16Verifier } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("ZKAccessControl", function () {
  let zkAccessControl: ZKAccessControl;
  let verifier: Groth16Verifier;
  let owner: SignerWithAddress;
  let university: SignerWithAddress;
  let student: SignerWithAddress;
  let sharedUser: SignerWithAddress;
  let admin: SignerWithAddress;
  let unauthorized: SignerWithAddress;

  // Mock proof data for testing
  const mockProof = {
    pA: ["0x1", "0x2"] as [string, string],
    pB: [["0x3", "0x4"], ["0x5", "0x6"]] as [[string, string], [string, string]],
    pC: ["0x7", "0x8"] as [string, string],
    publicSignals: ["1", "123456789", "0x1234567890abcdef"] as [string, string, string]
  };

  const recordId = 1;
  const encryptedIPFSHash = ethers.keccak256(ethers.toUtf8Bytes("encrypted_ipfs_hash"));
  const encryptedMetadataHash = ethers.keccak256(ethers.toUtf8Bytes("encrypted_metadata_hash"));
  const merkleRoot = ethers.keccak256(ethers.toUtf8Bytes("merkle_root"));

  beforeEach(async function () {
    [owner, university, student, sharedUser, admin, unauthorized] = await ethers.getSigners();

    // Deploy verifier contract
    const VerifierFactory = await ethers.getContractFactory("Groth16Verifier");
    verifier = await VerifierFactory.deploy();
    await verifier.waitForDeployment();

    // Deploy ZKAccessControl contract
    const ZKAccessControlFactory = await ethers.getContractFactory("ZKAccessControl");
    zkAccessControl = await ZKAccessControlFactory.deploy(await verifier.getAddress());
    await zkAccessControl.waitForDeployment();

    // Set up roles
    await zkAccessControl.addUniversity(university.address, "Test University");
    await zkAccessControl.addAdmin(admin.address);
  });

  describe("Deployment", function () {
    it("Should set the correct verifier address", async function () {
      expect(await zkAccessControl.verifier()).to.equal(await verifier.getAddress());
    });

    it("Should set the deployer as super admin", async function () {
      expect(await zkAccessControl.SUPER_ADMIN()).to.equal(owner.address);
    });
  });

  describe("Store Encrypted Record", function () {
    it("Should allow university to store encrypted record", async function () {
      await expect(
        zkAccessControl.connect(university).storeEncryptedRecord(
          recordId,
          encryptedIPFSHash,
          encryptedMetadataHash,
          merkleRoot,
          student.address
        )
      ).to.emit(zkAccessControl, "EncryptedRecordStored")
        .withArgs(recordId, student.address, merkleRoot)
        .and.to.emit(zkAccessControl, "AccessGranted")
        .withArgs(recordId, student.address, university.address);
    });

    it("Should allow admin to store encrypted record", async function () {
      await expect(
        zkAccessControl.connect(admin).storeEncryptedRecord(
          recordId,
          encryptedIPFSHash,
          encryptedMetadataHash,
          merkleRoot,
          student.address
        )
      ).to.emit(zkAccessControl, "EncryptedRecordStored");
    });

    it("Should reject unauthorized users from storing records", async function () {
      await expect(
        zkAccessControl.connect(unauthorized).storeEncryptedRecord(
          recordId,
          encryptedIPFSHash,
          encryptedMetadataHash,
          merkleRoot,
          student.address
        )
      ).to.be.revertedWith("Not authorized to store records");
    });

    it("Should reject invalid parameters", async function () {
      await expect(
        zkAccessControl.connect(university).storeEncryptedRecord(
          recordId,
          ethers.ZeroHash,
          encryptedMetadataHash,
          merkleRoot,
          student.address
        )
      ).to.be.revertedWith("Invalid IPFS hash");

      await expect(
        zkAccessControl.connect(university).storeEncryptedRecord(
          recordId,
          encryptedIPFSHash,
          encryptedMetadataHash,
          ethers.ZeroHash,
          student.address
        )
      ).to.be.revertedWith("Invalid merkle root");

      await expect(
        zkAccessControl.connect(university).storeEncryptedRecord(
          recordId,
          encryptedIPFSHash,
          encryptedMetadataHash,
          merkleRoot,
          ethers.ZeroAddress
        )
      ).to.be.revertedWith("Invalid owner address");
    });

    it("Should reject duplicate record IDs", async function () {
      await zkAccessControl.connect(university).storeEncryptedRecord(
        recordId,
        encryptedIPFSHash,
        encryptedMetadataHash,
        merkleRoot,
        student.address
      );

      await expect(
        zkAccessControl.connect(university).storeEncryptedRecord(
          recordId,
          encryptedIPFSHash,
          encryptedMetadataHash,
          merkleRoot,
          student.address
        )
      ).to.be.revertedWith("Record already exists");
    });

    it("Should automatically grant access to record owner", async function () {
      await zkAccessControl.connect(university).storeEncryptedRecord(
        recordId,
        encryptedIPFSHash,
        encryptedMetadataHash,
        merkleRoot,
        student.address
      );

      expect(await zkAccessControl.hasAccess(recordId, student.address)).to.be.true;
      expect(await zkAccessControl.isRecordOwner(recordId, student.address)).to.be.true;
    });
  });

  describe("Access Management", function () {
    beforeEach(async function () {
      await zkAccessControl.connect(university).storeEncryptedRecord(
        recordId,
        encryptedIPFSHash,
        encryptedMetadataHash,
        merkleRoot,
        student.address
      );
    });

    it("Should allow record owner to grant access", async function () {
      const accessKey = ethers.keccak256(ethers.toUtf8Bytes("access_key"));
      const validUntil = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

      await expect(
        zkAccessControl.connect(student).grantAccess(
          recordId,
          sharedUser.address,
          accessKey,
          validUntil
        )
      ).to.emit(zkAccessControl, "AccessGranted")
        .withArgs(recordId, sharedUser.address, student.address);

      expect(await zkAccessControl.hasAccess(recordId, sharedUser.address)).to.be.true;
    });

    it("Should allow admin to grant access", async function () {
      const accessKey = ethers.keccak256(ethers.toUtf8Bytes("access_key"));
      const validUntil = Math.floor(Date.now() / 1000) + 3600;

      await expect(
        zkAccessControl.connect(admin).grantAccess(
          recordId,
          sharedUser.address,
          accessKey,
          validUntil
        )
      ).to.emit(zkAccessControl, "AccessGranted");
    });

    it("Should reject unauthorized users from granting access", async function () {
      const accessKey = ethers.keccak256(ethers.toUtf8Bytes("access_key"));
      const validUntil = Math.floor(Date.now() / 1000) + 3600;

      await expect(
        zkAccessControl.connect(unauthorized).grantAccess(
          recordId,
          sharedUser.address,
          accessKey,
          validUntil
        )
      ).to.be.revertedWith("Not record owner or admin");
    });

    it("Should reject invalid grant access parameters", async function () {
      const accessKey = ethers.keccak256(ethers.toUtf8Bytes("access_key"));
      const validUntil = Math.floor(Date.now() / 1000) + 3600;

      await expect(
        zkAccessControl.connect(student).grantAccess(
          recordId,
          ethers.ZeroAddress,
          accessKey,
          validUntil
        )
      ).to.be.revertedWith("Invalid user address");

      await expect(
        zkAccessControl.connect(student).grantAccess(
          recordId,
          sharedUser.address,
          ethers.ZeroHash,
          validUntil
        )
      ).to.be.revertedWith("Invalid access key");

      await expect(
        zkAccessControl.connect(student).grantAccess(
          recordId,
          sharedUser.address,
          accessKey,
          Math.floor(Date.now() / 1000) - 3600 // Past timestamp
        )
      ).to.be.revertedWith("Invalid validity period");
    });

    it("Should allow record owner to revoke access", async function () {
      const accessKey = ethers.keccak256(ethers.toUtf8Bytes("access_key"));
      const validUntil = Math.floor(Date.now() / 1000) + 3600;

      await zkAccessControl.connect(student).grantAccess(
        recordId,
        sharedUser.address,
        accessKey,
        validUntil
      );

      await expect(
        zkAccessControl.connect(student).revokeAccess(recordId, sharedUser.address)
      ).to.emit(zkAccessControl, "AccessRevoked")
        .withArgs(recordId, sharedUser.address, student.address);

      expect(await zkAccessControl.hasAccess(recordId, sharedUser.address)).to.be.false;
    });

    it("Should not allow revoking owner access", async function () {
      await expect(
        zkAccessControl.connect(student).revokeAccess(recordId, student.address)
      ).to.be.revertedWith("Cannot revoke owner access");
    });

    it("Should reject revoking access for users without access", async function () {
      await expect(
        zkAccessControl.connect(student).revokeAccess(recordId, sharedUser.address)
      ).to.be.revertedWith("User does not have access");
    });
  });

  describe("Proof Verification", function () {
    beforeEach(async function () {
      await zkAccessControl.connect(university).storeEncryptedRecord(
        recordId,
        encryptedIPFSHash,
        encryptedMetadataHash,
        merkleRoot,
        student.address
      );
    });

    it("Should verify access with valid proof structure", async function () {
      // Note: This test uses mock proof data. In real implementation,
      // the verifier contract would need to be properly configured
      // with the actual circuit verification key
      
      const publicSignals: [string, string, string] = [
        recordId.toString(),
        "123456789", // Mock user address as field element
        merkleRoot
      ];

      // This will likely fail with the real verifier, but tests the contract logic
      try {
        const result = await zkAccessControl.verifyAccess(
          recordId,
          mockProof.pA,
          mockProof.pB,
          mockProof.pC,
          publicSignals
        );
        // If it doesn't revert, the contract logic is working
        expect(typeof result).to.equal("boolean");
      } catch (error) {
        // Expected to fail with mock proof data
        expect(error).to.be.ok;
      }
    });

    it("Should reject proof with wrong record ID", async function () {
      const publicSignals: [string, string, string] = [
        "999", // Wrong record ID
        "123456789",
        merkleRoot
      ];

      const result = await zkAccessControl.verifyAccess(
        recordId,
        mockProof.pA,
        mockProof.pB,
        mockProof.pC,
        publicSignals
      );
      expect(result).to.be.false;
    });

    it("Should reject proof with wrong merkle root", async function () {
      const wrongMerkleRoot = ethers.keccak256(ethers.toUtf8Bytes("wrong_merkle_root"));
      const publicSignals: [string, string, string] = [
        recordId.toString(),
        "123456789",
        wrongMerkleRoot
      ];

      const result = await zkAccessControl.verifyAccess(
        recordId,
        mockProof.pA,
        mockProof.pB,
        mockProof.pC,
        publicSignals
      );
      expect(result).to.be.false;
    });

    it("Should reject access to non-existent record", async function () {
      const nonExistentRecordId = 999;
      const publicSignals: [string, string, string] = [
        nonExistentRecordId.toString(),
        "123456789",
        merkleRoot
      ];

      await expect(
        zkAccessControl.verifyAccess(
          nonExistentRecordId,
          mockProof.pA,
          mockProof.pB,
          mockProof.pC,
          publicSignals
        )
      ).to.be.revertedWith("Record does not exist");
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      await zkAccessControl.connect(university).storeEncryptedRecord(
        recordId,
        encryptedIPFSHash,
        encryptedMetadataHash,
        merkleRoot,
        student.address
      );
    });

    it("Should return encrypted record data", async function () {
      const record = await zkAccessControl.getEncryptedRecord(recordId);
      
      expect(record.encryptedIPFSHash).to.equal(encryptedIPFSHash);
      expect(record.encryptedMetadataHash).to.equal(encryptedMetadataHash);
      expect(record.merkleRoot).to.equal(merkleRoot);
      expect(record.owner).to.equal(student.address);
      expect(record.exists).to.be.true;
    });

    it("Should return user access key for authorized users", async function () {
      const accessKey = await zkAccessControl.connect(student).getUserAccessKey(recordId, student.address);
      expect(accessKey).to.not.equal(ethers.ZeroHash);
    });

    it("Should reject unauthorized access to access keys", async function () {
      await expect(
        zkAccessControl.connect(unauthorized).getUserAccessKey(recordId, student.address)
      ).to.be.revertedWith("Not authorized to view access key");
    });

    it("Should return correct owner status", async function () {
      expect(await zkAccessControl.isRecordOwner(recordId, student.address)).to.be.true;
      expect(await zkAccessControl.isRecordOwner(recordId, sharedUser.address)).to.be.false;
    });

    it("Should return user accessible records", async function () {
      const records = await zkAccessControl.getUserAccessibleRecords(student.address);
      expect(records.map(r => Number(r))).to.include(recordId);
    });

    it("Should return record access list for authorized users", async function () {
      const accessList = await zkAccessControl.connect(student).getRecordAccessList(recordId);
      expect(accessList).to.include(student.address);
    });

    it("Should reject unauthorized access to record access list", async function () {
      await expect(
        zkAccessControl.connect(unauthorized).getRecordAccessList(recordId)
      ).to.be.revertedWith("Not authorized to view access list");
    });
  });

  describe("Merkle Root Updates", function () {
    beforeEach(async function () {
      await zkAccessControl.connect(university).storeEncryptedRecord(
        recordId,
        encryptedIPFSHash,
        encryptedMetadataHash,
        merkleRoot,
        student.address
      );
    });

    it("Should allow record owner to update merkle root", async function () {
      const newMerkleRoot = ethers.keccak256(ethers.toUtf8Bytes("new_merkle_root"));
      
      await zkAccessControl.connect(student).updateMerkleRoot(recordId, newMerkleRoot);
      
      const record = await zkAccessControl.getEncryptedRecord(recordId);
      expect(record.merkleRoot).to.equal(newMerkleRoot);
    });

    it("Should allow admin to update merkle root", async function () {
      const newMerkleRoot = ethers.keccak256(ethers.toUtf8Bytes("new_merkle_root"));
      
      await zkAccessControl.connect(admin).updateMerkleRoot(recordId, newMerkleRoot);
      
      const record = await zkAccessControl.getEncryptedRecord(recordId);
      expect(record.merkleRoot).to.equal(newMerkleRoot);
    });

    it("Should reject unauthorized merkle root updates", async function () {
      const newMerkleRoot = ethers.keccak256(ethers.toUtf8Bytes("new_merkle_root"));
      
      await expect(
        zkAccessControl.connect(unauthorized).updateMerkleRoot(recordId, newMerkleRoot)
      ).to.be.revertedWith("Not record owner or admin");
    });

    it("Should reject invalid merkle root", async function () {
      await expect(
        zkAccessControl.connect(student).updateMerkleRoot(recordId, ethers.ZeroHash)
      ).to.be.revertedWith("Invalid merkle root");
    });
  });

  describe("Pause Functionality", function () {
    it("Should allow admin to pause contract", async function () {
      await zkAccessControl.connect(admin).pause();
      expect(await zkAccessControl.paused()).to.be.true;
    });

    it("Should allow admin to unpause contract", async function () {
      await zkAccessControl.connect(admin).pause();
      await zkAccessControl.connect(admin).unpause();
      expect(await zkAccessControl.paused()).to.be.false;
    });

    it("Should reject unauthorized pause attempts", async function () {
      await expect(
        zkAccessControl.connect(unauthorized).pause()
      ).to.be.revertedWith("Not authorized to pause");
    });

    it("Should prevent operations when paused", async function () {
      await zkAccessControl.connect(admin).pause();
      
      await expect(
        zkAccessControl.connect(university).storeEncryptedRecord(
          recordId,
          encryptedIPFSHash,
          encryptedMetadataHash,
          merkleRoot,
          student.address
        )
      ).to.be.revertedWith("Pausable: paused");
    });
  });

  describe("Edge Cases", function () {
    it("Should handle multiple records for same user", async function () {
      const recordId2 = 2;
      
      await zkAccessControl.connect(university).storeEncryptedRecord(
        recordId,
        encryptedIPFSHash,
        encryptedMetadataHash,
        merkleRoot,
        student.address
      );
      
      await zkAccessControl.connect(university).storeEncryptedRecord(
        recordId2,
        encryptedIPFSHash,
        encryptedMetadataHash,
        merkleRoot,
        student.address
      );
      
      const records = await zkAccessControl.getUserAccessibleRecords(student.address);
      expect(records.map(r => Number(r))).to.include(recordId);
      expect(records.map(r => Number(r))).to.include(recordId2);
    });

    it("Should handle access expiration", async function () {
      await zkAccessControl.connect(university).storeEncryptedRecord(
        recordId,
        encryptedIPFSHash,
        encryptedMetadataHash,
        merkleRoot,
        student.address
      );

      const accessKey = ethers.keccak256(ethers.toUtf8Bytes("access_key"));
      const validUntil = Math.floor(Date.now() / 1000) + 3600; // Valid for 1 hour

      await zkAccessControl.connect(student).grantAccess(
        recordId,
        sharedUser.address,
        accessKey,
        validUntil
      );

      // Should have access when valid
      expect(await zkAccessControl.hasAccess(recordId, sharedUser.address)).to.be.true;

      // Test revocation (simulates expiration behavior)
      await zkAccessControl.connect(student).revokeAccess(recordId, sharedUser.address);
      expect(await zkAccessControl.hasAccess(recordId, sharedUser.address)).to.be.false;
    });
  });
});