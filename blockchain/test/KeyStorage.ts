import { expect } from "chai";
import { ethers } from "hardhat";
import { KeyStorage } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("KeyStorage", function () {
    let keyStorage: KeyStorage;
    let owner: SignerWithAddress;
    let university: SignerWithAddress;
    let student: SignerWithAddress;
    let admin: SignerWithAddress;
    let unauthorized: SignerWithAddress;
    let sharedUser: SignerWithAddress;

    const UNIVERSITY_ROLE = ethers.keccak256(ethers.toUtf8Bytes("UNIVERSITY_ROLE"));
    const ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_ROLE"));

    beforeEach(async function () {
        [owner, university, student, admin, unauthorized, sharedUser] = await ethers.getSigners();

        const KeyStorageFactory = await ethers.getContractFactory("KeyStorage");
        keyStorage = await KeyStorageFactory.deploy();
        await keyStorage.waitForDeployment();

        // Grant roles
        await keyStorage.addUniversity(university.address, "Test University");
        await keyStorage.addAdmin(admin.address);
    });

    describe("Key Storage", function () {
        const recordId = 1;
        const encryptedKey = ethers.toUtf8Bytes("encrypted_key_data_123");
        let authorizedUsers: string[];

        beforeEach(function () {
            authorizedUsers = [student.address, sharedUser.address];
        });

        it("Should store encrypted key successfully", async function () {
            await expect(
                keyStorage.connect(university).storeEncryptedKey(recordId, encryptedKey, authorizedUsers)
            )
                .to.emit(keyStorage, "KeyStored")
                .withArgs(recordId, university.address, authorizedUsers.length);

            expect(await keyStorage.keyExists(recordId)).to.be.true;
        });

        it("Should reject storing key with empty data", async function () {
            await expect(
                keyStorage.connect(university).storeEncryptedKey(recordId, "0x", authorizedUsers)
            ).to.be.revertedWithCustomError(keyStorage, "InvalidKeyData");
        });

        it("Should reject storing key with no authorized users", async function () {
            await expect(
                keyStorage.connect(university).storeEncryptedKey(recordId, encryptedKey, [])
            ).to.be.revertedWithCustomError(keyStorage, "TooManyAuthorizedUsers");
        });

        it("Should reject storing key with duplicate authorized users", async function () {
            const duplicateUsers = [student.address, student.address];
            await expect(
                keyStorage.connect(university).storeEncryptedKey(recordId, encryptedKey, duplicateUsers)
            ).to.be.revertedWithCustomError(keyStorage, "InvalidAuthorizedUsers");
        });

        it("Should reject storing key with zero address in authorized users", async function () {
            const invalidUsers = [student.address, ethers.ZeroAddress];
            await expect(
                keyStorage.connect(university).storeEncryptedKey(recordId, encryptedKey, invalidUsers)
            ).to.be.revertedWithCustomError(keyStorage, "InvalidAuthorizedUsers");
        });

        it("Should reject storing key if already exists", async function () {
            await keyStorage.connect(university).storeEncryptedKey(recordId, encryptedKey, authorizedUsers);

            await expect(
                keyStorage.connect(university).storeEncryptedKey(recordId, encryptedKey, authorizedUsers)
            ).to.be.revertedWithCustomError(keyStorage, "KeyAlreadyExists");
        });

        it("Should reject storing key from non-university address", async function () {
            await expect(
                keyStorage.connect(unauthorized).storeEncryptedKey(recordId, encryptedKey, authorizedUsers)
            ).to.be.reverted;
        });
    });

    describe("Key Retrieval", function () {
        const recordId = 1;
        const encryptedKey = ethers.toUtf8Bytes("encrypted_key_data_123");
        let authorizedUsers: string[];

        beforeEach(async function () {
            authorizedUsers = [student.address, sharedUser.address];
            await keyStorage.connect(university).storeEncryptedKey(recordId, encryptedKey, authorizedUsers);
        });

        it("Should allow issuer to retrieve key", async function () {
            const retrievedKey = await keyStorage.connect(university).getEncryptedKey(recordId, university.address);
            expect(retrievedKey).to.equal(ethers.hexlify(encryptedKey));
        });

        it("Should allow authorized user to retrieve key", async function () {
            const retrievedKey = await keyStorage.connect(student).getEncryptedKey(recordId, student.address);
            expect(retrievedKey).to.equal(ethers.hexlify(encryptedKey));
        });

        it("Should allow admin to retrieve key", async function () {
            const retrievedKey = await keyStorage.connect(admin).getEncryptedKey(recordId, admin.address);
            expect(retrievedKey).to.equal(ethers.hexlify(encryptedKey));
        });

        it("Should allow super admin to retrieve key", async function () {
            const retrievedKey = await keyStorage.connect(owner).getEncryptedKey(recordId, owner.address);
            expect(retrievedKey).to.equal(ethers.hexlify(encryptedKey));
        });

        it("Should reject unauthorized user", async function () {
            await expect(
                keyStorage.connect(unauthorized).getEncryptedKey(recordId, unauthorized.address)
            ).to.be.revertedWithCustomError(keyStorage, "UnauthorizedKeyAccess");
        });

        it("Should reject retrieval for non-existent key", async function () {
            await expect(
                keyStorage.connect(university).getEncryptedKey(999, university.address)
            ).to.be.revertedWithCustomError(keyStorage, "KeyNotFound");
        });

        it("Should log access when using getEncryptedKeyWithLogging", async function () {
            await expect(
                keyStorage.connect(student).getEncryptedKeyWithLogging(recordId)
            )
                .to.emit(keyStorage, "KeyAccessed")
                .withArgs(recordId, student.address);

            const accessCount = await keyStorage.getUserAccessCount(recordId, student.address);
            expect(accessCount).to.equal(1);
        });
    });

    describe("Access Control Management", function () {
        const recordId = 1;
        const encryptedKey = ethers.toUtf8Bytes("encrypted_key_data_123");
        let authorizedUsers: string[];

        beforeEach(async function () {
            authorizedUsers = [student.address, sharedUser.address];
            await keyStorage.connect(university).storeEncryptedKey(recordId, encryptedKey, authorizedUsers);
        });

        it("Should allow issuer to update key access", async function () {
            const newAuthorizedUsers = [student.address, unauthorized.address];

            await expect(
                keyStorage.connect(university).updateKeyAccess(recordId, newAuthorizedUsers)
            )
                .to.emit(keyStorage, "KeyAccessUpdated")
                .withArgs(recordId, university.address, newAuthorizedUsers.length);

            expect(await keyStorage.hasKeyAccess(recordId, unauthorized.address)).to.be.true;
            expect(await keyStorage.hasKeyAccess(recordId, sharedUser.address)).to.be.false;
        });

        it("Should allow admin to update key access", async function () {
            const newAuthorizedUsers = [student.address];

            await expect(
                keyStorage.connect(admin).updateKeyAccess(recordId, newAuthorizedUsers)
            )
                .to.emit(keyStorage, "KeyAccessUpdated")
                .withArgs(recordId, admin.address, newAuthorizedUsers.length);
        });

        it("Should reject unauthorized user updating access", async function () {
            const newAuthorizedUsers = [student.address];

            await expect(
                keyStorage.connect(unauthorized).updateKeyAccess(recordId, newAuthorizedUsers)
            ).to.be.revertedWithCustomError(keyStorage, "UnauthorizedKeyAccess");
        });

        it("Should get authorized users list", async function () {
            const users = await keyStorage.connect(university).getAuthorizedUsers(recordId);
            expect(users).to.deep.equal(authorizedUsers);
        });

        it("Should reject unauthorized user getting authorized users list", async function () {
            await expect(
                keyStorage.connect(unauthorized).getAuthorizedUsers(recordId)
            ).to.be.revertedWithCustomError(keyStorage, "UnauthorizedKeyAccess");
        });
    });

    describe("Key Rotation", function () {
        const recordId = 1;
        const encryptedKey = ethers.toUtf8Bytes("encrypted_key_data_123");
        const newEncryptedKey = ethers.toUtf8Bytes("new_encrypted_key_data_456");
        let authorizedUsers: string[];

        beforeEach(async function () {
            authorizedUsers = [student.address, sharedUser.address];
            await keyStorage.connect(university).storeEncryptedKey(recordId, encryptedKey, authorizedUsers);
        });

        it("Should allow issuer to rotate key", async function () {
            // Set rotation interval to 1 day for testing
            await keyStorage.connect(owner).setKeyRotationInterval(24 * 60 * 60); // 1 day

            // Fast forward time by increasing block timestamp
            await ethers.provider.send("evm_increaseTime", [25 * 60 * 60]); // 25 hours
            await ethers.provider.send("evm_mine", []);

            await expect(
                keyStorage.connect(university).rotateKey(recordId, newEncryptedKey)
            )
                .to.emit(keyStorage, "KeyRotated")
                .withArgs(recordId, university.address);

            const retrievedKey = await keyStorage.connect(university).getEncryptedKey(recordId, university.address);
            expect(retrievedKey).to.equal(ethers.hexlify(newEncryptedKey));
        });

        it("Should allow admin to rotate key anytime", async function () {
            await expect(
                keyStorage.connect(admin).rotateKey(recordId, newEncryptedKey)
            )
                .to.emit(keyStorage, "KeyRotated")
                .withArgs(recordId, admin.address);
        });

        it("Should reject rotation with empty key data", async function () {
            await expect(
                keyStorage.connect(university).rotateKey(recordId, "0x")
            ).to.be.revertedWithCustomError(keyStorage, "InvalidKeyData");
        });

        it("Should reject unauthorized user rotating key", async function () {
            await expect(
                keyStorage.connect(unauthorized).rotateKey(recordId, newEncryptedKey)
            ).to.be.revertedWithCustomError(keyStorage, "UnauthorizedKeyAccess");
        });

        it("Should check if key rotation is due", async function () {
            // Initially not due (just created)
            expect(await keyStorage.isKeyRotationDue(recordId)).to.be.false;

            // Set a short rotation interval for testing (minimum 1 day)
            await keyStorage.connect(owner).setKeyRotationInterval(24 * 60 * 60); // 1 day

            // Fast forward time
            await ethers.provider.send("evm_increaseTime", [25 * 60 * 60]); // 25 hours
            await ethers.provider.send("evm_mine", []);

            expect(await keyStorage.isKeyRotationDue(recordId)).to.be.true;
        });
    });

    describe("Emergency Access", function () {
        const recordId = 1;
        const encryptedKey = ethers.toUtf8Bytes("encrypted_key_data_123");
        let authorizedUsers: string[];

        beforeEach(async function () {
            authorizedUsers = [student.address];
            await keyStorage.connect(university).storeEncryptedKey(recordId, encryptedKey, authorizedUsers);
        });

        it("Should allow admin emergency access", async function () {
            const reason = "Security audit";

            await expect(
                keyStorage.connect(admin).emergencyKeyAccess(recordId, reason)
            )
                .to.emit(keyStorage, "EmergencyKeyAccess")
                .withArgs(recordId, admin.address, reason);
        });

        it("Should allow super admin emergency access", async function () {
            const reason = "System maintenance";

            await expect(
                keyStorage.connect(owner).emergencyKeyAccess(recordId, reason)
            )
                .to.emit(keyStorage, "EmergencyKeyAccess")
                .withArgs(recordId, owner.address, reason);
        });

        it("Should reject emergency access without reason", async function () {
            await expect(
                keyStorage.connect(admin).emergencyKeyAccess(recordId, "")
            ).to.be.revertedWithCustomError(keyStorage, "InvalidKeyData");
        });

        it("Should reject unauthorized emergency access", async function () {
            await expect(
                keyStorage.connect(unauthorized).emergencyKeyAccess(recordId, "reason")
            ).to.be.revertedWith("Not admin or super admin");
        });

        it("Should enforce emergency access limits", async function () {
            const reason = "Test reason";

            // Use up all emergency access attempts
            for (let i = 0; i < 10; i++) {
                await keyStorage.connect(admin).emergencyKeyAccess(recordId, `${reason} ${i}`);
            }

            // Next attempt should fail
            await expect(
                keyStorage.connect(admin).emergencyKeyAccess(recordId, reason)
            ).to.be.revertedWithCustomError(keyStorage, "EmergencyAccessLimitExceeded");
        });
    });

    describe("Key Metadata", function () {
        const recordId = 1;
        const encryptedKey = ethers.toUtf8Bytes("encrypted_key_data_123");
        let authorizedUsers: string[];

        beforeEach(async function () {
            authorizedUsers = [student.address, sharedUser.address];
            await keyStorage.connect(university).storeEncryptedKey(recordId, encryptedKey, authorizedUsers);
        });

        it("Should return correct key metadata", async function () {
            const [issuer, createdAt, lastRotated, authorizedCount] = await keyStorage.getKeyMetadata(recordId);

            expect(issuer).to.equal(university.address);
            expect(authorizedCount).to.equal(2);
            expect(createdAt).to.equal(lastRotated);
        });

        it("Should track user access count", async function () {
            await keyStorage.connect(student).getEncryptedKeyWithLogging(recordId);
            await keyStorage.connect(student).getEncryptedKeyWithLogging(recordId);

            const accessCount = await keyStorage.getUserAccessCount(recordId, student.address);
            expect(accessCount).to.equal(2);
        });

        it("Should check key existence", async function () {
            expect(await keyStorage.keyExists(recordId)).to.be.true;
            expect(await keyStorage.keyExists(999)).to.be.false;
        });
    });

    describe("Access Control Settings", function () {
        it("Should allow admin to set key rotation interval", async function () {
            const newInterval = 30 * 24 * 60 * 60; // 30 days
            await keyStorage.connect(admin).setKeyRotationInterval(newInterval);
            expect(await keyStorage.keyRotationInterval()).to.equal(newInterval);
        });

        it("Should reject setting too short rotation interval", async function () {
            const shortInterval = 60 * 60; // 1 hour
            await expect(
                keyStorage.connect(admin).setKeyRotationInterval(shortInterval)
            ).to.be.revertedWith("Interval too short");
        });

        it("Should reject setting too long rotation interval", async function () {
            const longInterval = 1096 * 24 * 60 * 60; // More than 3 years
            await expect(
                keyStorage.connect(admin).setKeyRotationInterval(longInterval)
            ).to.be.revertedWith("Interval too long");
        });

        it("Should reject unauthorized user setting rotation interval", async function () {
            await expect(
                keyStorage.connect(unauthorized).setKeyRotationInterval(30 * 24 * 60 * 60)
            ).to.be.revertedWith("Not admin or super admin");
        });
    });

    describe("Pause Functionality", function () {
        const recordId = 1;
        const encryptedKey = ethers.toUtf8Bytes("encrypted_key_data_123");
        let authorizedUsers: string[];

        beforeEach(async function () {
            authorizedUsers = [student.address];
            await keyStorage.connect(university).storeEncryptedKey(recordId, encryptedKey, authorizedUsers);
        });

        it("Should allow admin to pause contract", async function () {
            await keyStorage.connect(admin).pause();

            await expect(
                keyStorage.connect(university).storeEncryptedKey(2, encryptedKey, authorizedUsers)
            ).to.be.revertedWith("Pausable: paused");
        });

        it("Should allow admin to unpause contract", async function () {
            await keyStorage.connect(admin).pause();
            await keyStorage.connect(admin).unpause();

            // Should work normally after unpause
            await expect(
                keyStorage.connect(university).storeEncryptedKey(2, encryptedKey, authorizedUsers)
            ).to.emit(keyStorage, "KeyStored");
        });

        it("Should reject unauthorized pause", async function () {
            await expect(
                keyStorage.connect(unauthorized).pause()
            ).to.be.revertedWith("Not admin or super admin");
        });
    });
});