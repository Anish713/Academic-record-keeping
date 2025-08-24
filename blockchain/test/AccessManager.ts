import { expect } from "chai";
import { ethers } from "hardhat";
import { AccessManager } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("AccessManager", function () {
    let accessManager: AccessManager;
    let owner: SignerWithAddress;
    let university: SignerWithAddress;
    let student: SignerWithAddress;
    let admin: SignerWithAddress;
    let unauthorized: SignerWithAddress;
    let sharedUser: SignerWithAddress;

    const UNIVERSITY_ROLE = ethers.keccak256(ethers.toUtf8Bytes("UNIVERSITY_ROLE"));
    const ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_ROLE"));

    // Access types enum values
    const AccessType = {
        OWNER: 0,
        SHARED: 1,
        ADMIN: 2,
        EMERGENCY: 3
    };

    beforeEach(async function () {
        [owner, university, student, admin, unauthorized, sharedUser] = await ethers.getSigners();

        const AccessManagerFactory = await ethers.getContractFactory("AccessManager");
        accessManager = await AccessManagerFactory.deploy();
        await accessManager.waitForDeployment();

        // Grant roles
        await accessManager.addUniversity(university.address, "Test University");
        await accessManager.addAdmin(admin.address);
    });

    describe("Access Management", function () {
        const recordId = 1;
        const accessDuration = 7 * 24 * 60 * 60; // 7 days

        it("Should grant access successfully", async function () {
            await expect(
                accessManager.connect(admin).grantAccess(recordId, student.address, accessDuration, AccessType.SHARED)
            )
                .to.emit(accessManager, "AccessGranted");

            expect(await accessManager.hasAccess(recordId, student.address)).to.be.true;
        });

        it("Should grant access with default duration", async function () {
            await expect(
                accessManager.connect(admin).grantAccessWithDefaultDuration(recordId, student.address, AccessType.SHARED)
            )
                .to.emit(accessManager, "AccessGranted");

            expect(await accessManager.hasAccess(recordId, student.address)).to.be.true;
        });

        it("Should reject granting access to zero address", async function () {
            await expect(
                accessManager.connect(admin).grantAccess(recordId, ethers.ZeroAddress, accessDuration, AccessType.SHARED)
            ).to.be.revertedWithCustomError(accessManager, "InvalidAddress");
        });

        it("Should reject granting access with excessive duration", async function () {
            const excessiveDuration = 400 * 24 * 60 * 60; // 400 days
            await expect(
                accessManager.connect(admin).grantAccess(recordId, student.address, excessiveDuration, AccessType.SHARED)
            ).to.be.revertedWithCustomError(accessManager, "InvalidDuration");
        });

        it("Should reject granting access from unauthorized user", async function () {
            await expect(
                accessManager.connect(unauthorized).grantAccess(recordId, student.address, accessDuration, AccessType.SHARED)
            ).to.be.revertedWithCustomError(accessManager, "UnauthorizedAccess");
        });

        it("Should reject granting access if already granted and active", async function () {
            await accessManager.connect(admin).grantAccess(recordId, student.address, accessDuration, AccessType.SHARED);

            await expect(
                accessManager.connect(admin).grantAccess(recordId, student.address, accessDuration, AccessType.SHARED)
            ).to.be.revertedWithCustomError(accessManager, "AccessAlreadyGranted");
        });

        it("Should allow admin to always have access", async function () {
            expect(await accessManager.hasAccess(recordId, admin.address)).to.be.true;
        });

        it("Should allow super admin to always have access", async function () {
            expect(await accessManager.hasAccess(recordId, owner.address)).to.be.true;
        });
    });

    describe("Access Revocation", function () {
        const recordId = 1;
        const accessDuration = 7 * 24 * 60 * 60; // 7 days

        beforeEach(async function () {
            await accessManager.connect(admin).grantAccess(recordId, student.address, accessDuration, AccessType.SHARED);
        });

        it("Should revoke access successfully", async function () {
            await expect(
                accessManager.connect(admin).revokeAccess(recordId, student.address)
            )
                .to.emit(accessManager, "AccessRevoked")
                .withArgs(recordId, student.address, admin.address);

            expect(await accessManager.hasAccess(recordId, student.address)).to.be.false;
        });

        it("Should allow user to revoke their own access", async function () {
            await expect(
                accessManager.connect(student).revokeAccess(recordId, student.address)
            )
                .to.emit(accessManager, "AccessRevoked")
                .withArgs(recordId, student.address, student.address);

            expect(await accessManager.hasAccess(recordId, student.address)).to.be.false;
        });

        it("Should reject revoking non-existent access", async function () {
            await expect(
                accessManager.connect(admin).revokeAccess(recordId, unauthorized.address)
            ).to.be.revertedWithCustomError(accessManager, "AccessNotFound");
        });

        it("Should reject unauthorized revocation", async function () {
            await expect(
                accessManager.connect(unauthorized).revokeAccess(recordId, student.address)
            ).to.be.revertedWithCustomError(accessManager, "UnauthorizedAccess");
        });
    });

    describe("Sharing Tokens", function () {
        const recordId = 1;
        const tokenDuration = 24 * 60 * 60; // 1 day
        const maxUsage = 5;

        beforeEach(async function () {
            // Grant access to student so they can create sharing tokens
            await accessManager.connect(admin).grantAccess(recordId, student.address, 7 * 24 * 60 * 60, AccessType.OWNER);
        });

        it("Should create sharing token successfully", async function () {
            await expect(
                accessManager.connect(student).createSharingToken(recordId, sharedUser.address, tokenDuration, maxUsage)
            )
                .to.emit(accessManager, "SharingTokenCreated");
        });

        it("Should validate and use sharing token", async function () {
            const tx = await accessManager.connect(student).createSharingToken(recordId, sharedUser.address, tokenDuration, maxUsage);
            const receipt = await tx.wait();
            const event = receipt!.logs.find(log => {
                try {
                    return accessManager.interface.parseLog(log as any)?.name === "SharingTokenCreated";
                } catch {
                    return false;
                }
            });
            const parsedEvent = accessManager.interface.parseLog(event as any);
            const tokenHash = parsedEvent!.args.tokenHash;

            await expect(
                accessManager.connect(sharedUser).validateSharingToken(tokenHash, recordId, sharedUser.address)
            ).to.emit(accessManager, "SharingTokenUsed");
        });

        it("Should reject creating token for zero address", async function () {
            await expect(
                accessManager.connect(student).createSharingToken(recordId, ethers.ZeroAddress, tokenDuration, maxUsage)
            ).to.be.revertedWithCustomError(accessManager, "InvalidAddress");
        });

        it("Should reject creating token with excessive duration", async function () {
            const excessiveDuration = 400 * 24 * 60 * 60; // 400 days
            await expect(
                accessManager.connect(student).createSharingToken(recordId, sharedUser.address, excessiveDuration, maxUsage)
            ).to.be.revertedWithCustomError(accessManager, "InvalidDuration");
        });

        it("Should reject creating token without access", async function () {
            await expect(
                accessManager.connect(unauthorized).createSharingToken(recordId, sharedUser.address, tokenDuration, maxUsage)
            ).to.be.revertedWithCustomError(accessManager, "UnauthorizedAccess");
        });

        it("Should revoke sharing token", async function () {
            const tx = await accessManager.connect(student).createSharingToken(recordId, sharedUser.address, tokenDuration, maxUsage);
            const receipt = await tx.wait();
            const event = receipt!.logs.find(log => {
                try {
                    return accessManager.interface.parseLog(log as any)?.name === "SharingTokenCreated";
                } catch {
                    return false;
                }
            });
            const parsedEvent = accessManager.interface.parseLog(event as any);
            const tokenHash = parsedEvent!.args.tokenHash;

            await expect(
                accessManager.connect(student).revokeSharingToken(tokenHash)
            )
                .to.emit(accessManager, "SharingTokenRevoked")
                .withArgs(tokenHash, recordId, student.address);
        });

        it("Should reject validating revoked token", async function () {
            const tx = await accessManager.connect(student).createSharingToken(recordId, sharedUser.address, tokenDuration, maxUsage);
            const receipt = await tx.wait();
            const event = receipt!.logs.find(log => {
                try {
                    return accessManager.interface.parseLog(log as any)?.name === "SharingTokenCreated";
                } catch {
                    return false;
                }
            });
            const parsedEvent = accessManager.interface.parseLog(event as any);
            const tokenHash = parsedEvent!.args.tokenHash;

            await accessManager.connect(student).revokeSharingToken(tokenHash);

            await expect(
                accessManager.connect(sharedUser).validateSharingToken(tokenHash, recordId, sharedUser.address)
            ).to.be.revertedWithCustomError(accessManager, "SharingTokenAlreadyRevoked");
        });

        it("Should enforce token usage limits", async function () {
            const tx = await accessManager.connect(student).createSharingToken(recordId, sharedUser.address, tokenDuration, 1); // Max 1 usage
            const receipt = await tx.wait();
            const event = receipt!.logs.find(log => {
                try {
                    return accessManager.interface.parseLog(log as any)?.name === "SharingTokenCreated";
                } catch {
                    return false;
                }
            });
            const parsedEvent = accessManager.interface.parseLog(event as any);
            const tokenHash = parsedEvent!.args.tokenHash;

            // First usage should work
            await accessManager.connect(sharedUser).validateSharingToken(tokenHash, recordId, sharedUser.address);

            // Second usage should fail
            await expect(
                accessManager.connect(sharedUser).validateSharingToken(tokenHash, recordId, sharedUser.address)
            ).to.be.revertedWithCustomError(accessManager, "SharingTokenUsageLimitExceeded");
        });

        it("Should reject validating expired token", async function () {
            const shortDuration = 1; // 1 second
            const tx = await accessManager.connect(student).createSharingToken(recordId, sharedUser.address, shortDuration, maxUsage);
            const receipt = await tx.wait();
            const event = receipt!.logs.find(log => {
                try {
                    return accessManager.interface.parseLog(log as any)?.name === "SharingTokenCreated";
                } catch {
                    return false;
                }
            });
            const parsedEvent = accessManager.interface.parseLog(event as any);
            const tokenHash = parsedEvent!.args.tokenHash;

            // Fast forward time
            await ethers.provider.send("evm_increaseTime", [2]);
            await ethers.provider.send("evm_mine", []);

            await expect(
                accessManager.connect(sharedUser).validateSharingToken(tokenHash, recordId, sharedUser.address)
            ).to.be.revertedWithCustomError(accessManager, "SharingTokenExpired");
        });
    });

    describe("Access Logging", function () {
        const recordId = 1;
        const action = "VIEW";
        const proofHash = ethers.keccak256(ethers.toUtf8Bytes("test_proof"));

        beforeEach(async function () {
            await accessManager.connect(admin).grantAccess(recordId, student.address, 7 * 24 * 60 * 60, AccessType.SHARED);
        });

        it("Should log access successfully", async function () {
            await expect(
                accessManager.connect(admin).logAccess(recordId, student.address, action, proofHash)
            )
                .to.emit(accessManager, "AccessLogged")
                .withArgs(recordId, student.address, action, await ethers.provider.getBlock('latest').then(b => b!.timestamp + 1));
        });

        it("Should get access history", async function () {
            await accessManager.connect(admin).logAccess(recordId, student.address, action, proofHash);

            const history = await accessManager.connect(admin).getAccessHistory(recordId);
            expect(history.length).to.equal(1);
            expect(history[0].action).to.equal(action);
            expect(history[0].accessor).to.equal(student.address);
        });

        it("Should get user access history", async function () {
            await accessManager.connect(admin).logAccess(recordId, student.address, action, proofHash);

            const history = await accessManager.connect(student).getUserAccessHistory(student.address);
            expect(history.length).to.equal(1);
            expect(history[0].action).to.equal(action);
        });

        it("Should reject unauthorized access to history", async function () {
            await expect(
                accessManager.connect(unauthorized).getAccessHistory(recordId)
            ).to.be.revertedWithCustomError(accessManager, "UnauthorizedAccess");
        });

        it("Should reject unauthorized access to user history", async function () {
            await expect(
                accessManager.connect(unauthorized).getUserAccessHistory(student.address)
            ).to.be.revertedWithCustomError(accessManager, "UnauthorizedAccess");
        });
    });

    describe("Access Information", function () {
        const recordId = 1;

        beforeEach(async function () {
            await accessManager.connect(admin).grantAccess(recordId, student.address, 7 * 24 * 60 * 60, AccessType.SHARED);
            await accessManager.connect(admin).grantAccess(recordId, sharedUser.address, 7 * 24 * 60 * 60, AccessType.SHARED);
        });

        it("Should get access permission details", async function () {
            const permission = await accessManager.getAccessPermission(recordId, student.address);
            expect(permission.accessor).to.equal(student.address);
            expect(permission.recordId).to.equal(recordId);
            expect(permission.isActive).to.be.true;
            expect(permission.accessType).to.equal(AccessType.SHARED);
        });

        it("Should get record accessors", async function () {
            const accessors = await accessManager.connect(admin).getRecordAccessors(recordId);
            expect(accessors.length).to.equal(2);
            expect(accessors).to.include(student.address);
            expect(accessors).to.include(sharedUser.address);
        });

        it("Should get user accessible records", async function () {
            const records = await accessManager.connect(student).getUserAccessibleRecords(student.address);
            expect(records.length).to.equal(1);
            expect(records[0]).to.equal(recordId);
        });

        it("Should get record access statistics", async function () {
            await accessManager.connect(admin).logAccess(recordId, student.address, "VIEW", ethers.ZeroHash);
            await accessManager.connect(admin).logAccess(recordId, sharedUser.address, "DOWNLOAD", ethers.ZeroHash);

            const [accessCount, accessorCount, tokenCount] = await accessManager.connect(admin).getRecordAccessStats(recordId);
            expect(accessCount).to.equal(2);
            expect(accessorCount).to.equal(2);
            expect(tokenCount).to.equal(0);
        });

        it("Should get user access statistics", async function () {
            await accessManager.connect(admin).logAccess(recordId, student.address, "VIEW", ethers.ZeroHash);

            const [totalAccess, accessibleRecords, sharingTokens] = await accessManager.connect(student).getUserAccessStats(student.address);
            expect(totalAccess).to.equal(1);
            expect(accessibleRecords).to.equal(1);
            expect(sharingTokens).to.equal(0);
        });
    });

    describe("Admin Settings", function () {
        it("Should allow admin to set default access duration", async function () {
            const newDuration = 14 * 24 * 60 * 60; // 14 days
            await accessManager.connect(admin).setDefaultAccessDuration(newDuration);
            expect(await accessManager.defaultAccessDuration()).to.equal(newDuration);
        });

        it("Should allow admin to set max access duration", async function () {
            const newMaxDuration = 730 * 24 * 60 * 60; // 2 years
            await accessManager.connect(admin).setMaxAccessDuration(newMaxDuration);
            expect(await accessManager.maxAccessDuration()).to.equal(newMaxDuration);
        });

        it("Should allow admin to set max sharing token usage", async function () {
            const newMaxUsage = 20;
            await accessManager.connect(admin).setMaxSharingTokenUsage(newMaxUsage);
            expect(await accessManager.maxSharingTokenUsage()).to.equal(newMaxUsage);
        });

        it("Should reject setting invalid default duration", async function () {
            const invalidDuration = 400 * 24 * 60 * 60; // 400 days (exceeds max)
            await expect(
                accessManager.connect(admin).setDefaultAccessDuration(invalidDuration)
            ).to.be.revertedWith("Duration exceeds maximum");
        });

        it("Should reject setting invalid max duration", async function () {
            const invalidMaxDuration = 1 * 24 * 60 * 60; // 1 day (below default)
            await expect(
                accessManager.connect(admin).setMaxAccessDuration(invalidMaxDuration)
            ).to.be.revertedWith("Duration below default");
        });

        it("Should reject setting zero max sharing token usage", async function () {
            await expect(
                accessManager.connect(admin).setMaxSharingTokenUsage(0)
            ).to.be.revertedWith("Max usage must be positive");
        });

        it("Should reject unauthorized settings changes", async function () {
            await expect(
                accessManager.connect(unauthorized).setDefaultAccessDuration(14 * 24 * 60 * 60)
            ).to.be.revertedWith("Not admin or super admin");
        });
    });

    describe("Pause Functionality", function () {
        const recordId = 1;

        it("Should allow admin to pause contract", async function () {
            await accessManager.connect(admin).pause();

            await expect(
                accessManager.connect(admin).grantAccess(recordId, student.address, 7 * 24 * 60 * 60, AccessType.SHARED)
            ).to.be.revertedWith("Pausable: paused");
        });

        it("Should allow admin to unpause contract", async function () {
            await accessManager.connect(admin).pause();
            await accessManager.connect(admin).unpause();

            // Should work normally after unpause
            await expect(
                accessManager.connect(admin).grantAccess(recordId, student.address, 7 * 24 * 60 * 60, AccessType.SHARED)
            ).to.emit(accessManager, "AccessGranted");
        });

        it("Should reject unauthorized pause", async function () {
            await expect(
                accessManager.connect(unauthorized).pause()
            ).to.be.revertedWith("Not admin or super admin");
        });
    });

    describe("Access Expiration", function () {
        const recordId = 1;
        const shortDuration = 1; // 1 second

        it("Should handle expired access correctly", async function () {
            await accessManager.connect(admin).grantAccess(recordId, student.address, shortDuration, AccessType.SHARED);

            // Initially should have access
            expect(await accessManager.hasAccess(recordId, student.address)).to.be.true;

            // Fast forward time
            await ethers.provider.send("evm_increaseTime", [2]);
            await ethers.provider.send("evm_mine", []);

            // Should no longer have access
            expect(await accessManager.hasAccess(recordId, student.address)).to.be.false;
        });

        it("Should allow re-granting access after expiration", async function () {
            await accessManager.connect(admin).grantAccess(recordId, student.address, shortDuration, AccessType.SHARED);

            // Fast forward time to expire access
            await ethers.provider.send("evm_increaseTime", [2]);
            await ethers.provider.send("evm_mine", []);

            // Should be able to grant access again
            await expect(
                accessManager.connect(admin).grantAccess(recordId, student.address, 7 * 24 * 60 * 60, AccessType.SHARED)
            ).to.emit(accessManager, "AccessGranted");

            expect(await accessManager.hasAccess(recordId, student.address)).to.be.true;
        });
    });
});