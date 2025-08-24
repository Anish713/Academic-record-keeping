import { expect } from "chai";
import { ethers } from "hardhat";
import { ZKPManager, AccessManager, KeyStorage } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("ZKPManager", function () {
    let zkpManager: ZKPManager;
    let accessManager: AccessManager;
    let keyStorage: KeyStorage;
    let mockAccessVerifier: any;
    let mockSharingVerifier: any;
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

    // Mock proof components
    const mockProof = {
        a: [1, 2],
        b: [[3, 4], [5, 6]],
        c: [7, 8],
        publicInputs: [9, 10]
    };

    beforeEach(async function () {
        [owner, university, student, admin, unauthorized, sharedUser] = await ethers.getSigners();

        // Deploy AccessManager
        const AccessManagerFactory = await ethers.getContractFactory("AccessManager");
        accessManager = await AccessManagerFactory.deploy();
        await accessManager.waitForDeployment();

        // Deploy KeyStorage
        const KeyStorageFactory = await ethers.getContractFactory("KeyStorage");
        keyStorage = await KeyStorageFactory.deploy();
        await keyStorage.waitForDeployment();

        // Deploy ZKPManager
        const ZKPManagerFactory = await ethers.getContractFactory("ZKPManager");
        zkpManager = await ZKPManagerFactory.deploy();
        await zkpManager.waitForDeployment();

        // Deploy mock verifiers
        const MockVerifierFactory = await ethers.getContractFactory("Access_verificationVerifier");
        mockAccessVerifier = await MockVerifierFactory.deploy();
        await mockAccessVerifier.waitForDeployment();

        const MockSharingVerifierFactory = await ethers.getContractFactory("Access_verificationVerifier");
        mockSharingVerifier = await MockSharingVerifierFactory.deploy();
        await mockSharingVerifier.waitForDeployment();

        // Grant roles
        await accessManager.addUniversity(university.address, "Test University");
        await accessManager.addAdmin(admin.address);
        await keyStorage.addUniversity(university.address, "Test University");
        await keyStorage.addAdmin(admin.address);
        await zkpManager.addUniversity(university.address, "Test University");
        await zkpManager.addAdmin(admin.address);

        // Set up ZKPManager dependencies
        await zkpManager.setAccessManager(await accessManager.getAddress());
        await zkpManager.setKeyStorage(await keyStorage.getAddress());
        await zkpManager.setAccessVerifier(await mockAccessVerifier.getAddress());
        await zkpManager.setSharingVerifier(await mockSharingVerifier.getAddress());
    });

    describe("Contract Setup", function () {
        it("Should set AccessManager correctly", async function () {
            expect(await zkpManager.accessManager()).to.equal(await accessManager.getAddress());
        });

        it("Should set KeyStorage correctly", async function () {
            expect(await zkpManager.keyStorage()).to.equal(await keyStorage.getAddress());
        });

        it("Should set access verifier correctly", async function () {
            expect(await zkpManager.accessVerifier()).to.equal(await mockAccessVerifier.getAddress());
        });

        it("Should set sharing verifier correctly", async function () {
            expect(await zkpManager.sharingVerifier()).to.equal(await mockSharingVerifier.getAddress());
        });

        it("Should reject setting zero address as AccessManager", async function () {
            await expect(
                zkpManager.connect(admin).setAccessManager(ethers.ZeroAddress)
            ).to.be.revertedWithCustomError(zkpManager, "InvalidVerifier");
        });

        it("Should reject unauthorized verifier updates", async function () {
            await expect(
                zkpManager.connect(unauthorized).setAccessVerifier(await mockAccessVerifier.getAddress())
            ).to.be.revertedWith("Not admin or super admin");
        });
    });

    describe("Proof Generation", function () {
        const recordId = 1;

        it("Should generate access proof successfully", async function () {
            await expect(
                zkpManager.connect(student).generateAccessProof(
                    recordId,
                    student.address,
                    mockProof.a as [number, number],
                    mockProof.b as [[number, number], [number, number]],
                    mockProof.c as [number, number],
                    mockProof.publicInputs as [number, number]
                )
            )
                .to.emit(zkpManager, "ProofGenerated");
        });

        it("Should reject proof generation for different accessor without authorization", async function () {
            await expect(
                zkpManager.connect(unauthorized).generateAccessProof(
                    recordId,
                    student.address,
                    mockProof.a as [number, number],
                    mockProof.b as [[number, number], [number, number]],
                    mockProof.c as [number, number],
                    mockProof.publicInputs as [number, number]
                )
            ).to.be.revertedWithCustomError(zkpManager, "UnauthorizedProofGeneration");
        });

        it("Should allow admin to generate proof for any accessor", async function () {
            await expect(
                zkpManager.connect(admin).generateAccessProof(
                    recordId,
                    student.address,
                    mockProof.a as [number, number],
                    mockProof.b as [[number, number], [number, number]],
                    mockProof.c as [number, number],
                    mockProof.publicInputs as [number, number]
                )
            )
                .to.emit(zkpManager, "ProofGenerated");
        });

        it("Should reject proof generation when user limit exceeded", async function () {
            // Generate first proof
            await zkpManager.connect(student).generateAccessProof(
                recordId,
                student.address,
                mockProof.a as [number, number],
                mockProof.b as [[number, number], [number, number]],
                mockProof.c as [number, number],
                mockProof.publicInputs as [number, number]
            );

            // Set a very low limit to test the limit functionality
            await zkpManager.connect(admin).setMaxProofsPerUser(1);

            await expect(
                zkpManager.connect(student).generateAccessProof(
                    recordId + 1, // Different record to avoid other conflicts
                    student.address,
                    [mockProof.a[0] + 1, mockProof.a[1]] as [number, number], // Slightly different proof
                    mockProof.b as [[number, number], [number, number]],
                    mockProof.c as [number, number],
                    mockProof.publicInputs as [number, number]
                )
            ).to.be.revertedWithCustomError(zkpManager, "ProofLimitExceeded");
        });

        it("Should reject proof generation without AccessManager", async function () {
            // Deploy new ZKPManager without AccessManager
            const ZKPManagerFactory = await ethers.getContractFactory("ZKPManager");
            const newZkpManager = await ZKPManagerFactory.deploy();
            await newZkpManager.waitForDeployment();

            await expect(
                newZkpManager.connect(student).generateAccessProof(
                    recordId,
                    student.address,
                    mockProof.a as [number, number],
                    mockProof.b as [[number, number], [number, number]],
                    mockProof.c as [number, number],
                    mockProof.publicInputs as [number, number]
                )
            ).to.be.revertedWithCustomError(newZkpManager, "AccessManagerNotSet");
        });
    });

    describe("Proof Verification", function () {
        const recordId = 1;
        let proofHash: string;

        beforeEach(async function () {
            const tx = await zkpManager.connect(student).generateAccessProof(
                recordId,
                student.address,
                mockProof.a as [number, number],
                mockProof.b as [[number, number], [number, number]],
                mockProof.c as [number, number],
                mockProof.publicInputs as [number, number]
            );
            const receipt = await tx.wait();
            const event = receipt!.logs.find(log => {
                try {
                    return zkpManager.interface.parseLog(log as any)?.name === "ProofGenerated";
                } catch {
                    return false;
                }
            });
            const parsedEvent = zkpManager.interface.parseLog(event as any);
            proofHash = parsedEvent!.args.proofHash;
        });

        it("Should verify access proof successfully", async function () {
            await expect(
                zkpManager.verifyAccessProof(proofHash, recordId, student.address)
            )
                .to.emit(zkpManager, "ProofVerified")
                .withArgs(proofHash, recordId, student.address, true);
        });

        it("Should verify access proof using view function", async function () {
            const result = await zkpManager.verifyAccessProofView(proofHash, recordId, student.address);
            expect(result).to.be.true;
        });

        it("Should reject verification with invalid proof hash", async function () {
            const invalidHash = ethers.keccak256(ethers.toUtf8Bytes("invalid"));
            await expect(
                zkpManager.verifyAccessProof(invalidHash, recordId, student.address)
            ).to.be.revertedWithCustomError(zkpManager, "InvalidProof");
        });

        it("Should reject verification with mismatched record ID", async function () {
            await expect(
                zkpManager.verifyAccessProof(proofHash, 999, student.address)
            ).to.be.revertedWithCustomError(zkpManager, "InvalidProof");
        });

        it("Should reject verification with mismatched accessor", async function () {
            await expect(
                zkpManager.verifyAccessProof(proofHash, recordId, unauthorized.address)
            ).to.be.revertedWithCustomError(zkpManager, "InvalidProof");
        });

        it("Should reject verification of expired proof", async function () {
            // Set short validity duration
            await zkpManager.connect(admin).setProofValidityDuration(1); // 1 second

            // Fast forward time
            await ethers.provider.send("evm_increaseTime", [2]);
            await ethers.provider.send("evm_mine", []);

            await expect(
                zkpManager.verifyAccessProof(proofHash, recordId, student.address)
            ).to.be.revertedWithCustomError(zkpManager, "ProofExpired");
        });

        it("Should reject verification without verifier set", async function () {
            // Deploy new ZKPManager without verifier
            const ZKPManagerFactory = await ethers.getContractFactory("ZKPManager");
            const newZkpManager = await ZKPManagerFactory.deploy();
            await newZkpManager.waitForDeployment();
            await newZkpManager.setAccessManager(await accessManager.getAddress());

            const tx = await newZkpManager.connect(student).generateAccessProof(
                recordId,
                student.address,
                mockProof.a as [number, number],
                mockProof.b as [[number, number], [number, number]],
                mockProof.c as [number, number],
                mockProof.publicInputs as [number, number]
            );
            const receipt = await tx.wait();
            const event = receipt!.logs.find(log => {
                try {
                    return newZkpManager.interface.parseLog(log as any)?.name === "ProofGenerated";
                } catch {
                    return false;
                }
            });
            const parsedEvent = newZkpManager.interface.parseLog(event as any);
            const newProofHash = parsedEvent!.args.proofHash;

            await expect(
                newZkpManager.verifyAccessProof(newProofHash, recordId, student.address)
            ).to.be.revertedWithCustomError(newZkpManager, "VerifierNotSet");
        });
    });

    describe("Sharing Token Creation", function () {
        const recordId = 1;
        const duration = 24 * 60 * 60; // 1 day
        const maxUsage = 5;

        beforeEach(async function () {
            // Grant access to student so they can create sharing tokens
            await accessManager.connect(admin).grantAccess(recordId, student.address, 7 * 24 * 60 * 60, AccessType.OWNER);
        });

        it("Should create sharing token without proof", async function () {
            // First ensure student has access
            const hasAccess = await accessManager.hasAccess(recordId, student.address);
            if (!hasAccess) {
                await accessManager.connect(admin).grantAccess(recordId, student.address, 7 * 24 * 60 * 60, AccessType.OWNER);
            }

            await expect(
                zkpManager.connect(student).createSharingToken(
                    recordId,
                    sharedUser.address,
                    duration,
                    maxUsage,
                    ethers.ZeroHash
                )
            )
                .to.emit(zkpManager, "SharingTokenCreated");
        });

        it("Should reject sharing token creation without AccessManager", async function () {
            // Deploy new ZKPManager without AccessManager
            const ZKPManagerFactory = await ethers.getContractFactory("ZKPManager");
            const newZkpManager = await ZKPManagerFactory.deploy();
            await newZkpManager.waitForDeployment();

            await expect(
                newZkpManager.connect(student).createSharingToken(
                    recordId,
                    sharedUser.address,
                    duration,
                    maxUsage,
                    ethers.ZeroHash
                )
            ).to.be.revertedWithCustomError(newZkpManager, "AccessManagerNotSet");
        });
    });

    describe("Access Coordination", function () {
        const recordId = 1;
        const action = "VIEW";

        beforeEach(async function () {
            // Grant access to student
            await accessManager.connect(admin).grantAccess(recordId, student.address, 7 * 24 * 60 * 60, AccessType.SHARED);
        });

        it("Should coordinate access with traditional permissions", async function () {
            await expect(
                zkpManager.coordinateAccess(recordId, student.address, action, ethers.ZeroHash)
            )
                .to.emit(zkpManager, "AccessCoordinated")
                .withArgs(recordId, student.address, action);
        });

        it("Should coordinate access with ZK proof", async function () {
            // Generate proof using admin (who can generate proofs for others)
            const tx = await zkpManager.connect(admin).generateAccessProof(
                recordId,
                unauthorized.address,
                mockProof.a as [number, number],
                mockProof.b as [[number, number], [number, number]],
                mockProof.c as [number, number],
                mockProof.publicInputs as [number, number]
            );
            const receipt = await tx.wait();
            const event = receipt!.logs.find(log => {
                try {
                    return zkpManager.interface.parseLog(log as any)?.name === "ProofGenerated";
                } catch {
                    return false;
                }
            });
            const parsedEvent = zkpManager.interface.parseLog(event as any);
            const proofHash = parsedEvent!.args.proofHash;

            const result = await zkpManager.coordinateAccess(recordId, unauthorized.address, action, proofHash);

            // Since the mock verifier always returns true, this should succeed
            await expect(
                zkpManager.coordinateAccess(recordId, unauthorized.address, action, proofHash)
            )
                .to.emit(zkpManager, "AccessCoordinated")
                .withArgs(recordId, unauthorized.address, action);
        });

        it("Should reject access coordination without AccessManager", async function () {
            // Deploy new ZKPManager without AccessManager
            const ZKPManagerFactory = await ethers.getContractFactory("ZKPManager");
            const newZkpManager = await ZKPManagerFactory.deploy();
            await newZkpManager.waitForDeployment();

            await expect(
                newZkpManager.coordinateAccess(recordId, student.address, action, ethers.ZeroHash)
            ).to.be.revertedWithCustomError(newZkpManager, "AccessManagerNotSet");
        });
    });

    describe("Proof Information", function () {
        const recordId = 1;
        let proofHash: string;

        beforeEach(async function () {
            const tx = await zkpManager.connect(student).generateAccessProof(
                recordId,
                student.address,
                mockProof.a as [number, number],
                mockProof.b as [[number, number], [number, number]],
                mockProof.c as [number, number],
                mockProof.publicInputs as [number, number]
            );
            const receipt = await tx.wait();
            const event = receipt!.logs.find(log => {
                try {
                    return zkpManager.interface.parseLog(log as any)?.name === "ProofGenerated";
                } catch {
                    return false;
                }
            });
            const parsedEvent = zkpManager.interface.parseLog(event as any);
            proofHash = parsedEvent!.args.proofHash;
        });

        it("Should get proof details", async function () {
            const proof = await zkpManager.getProof(proofHash);
            expect(proof.recordId).to.equal(recordId);
            expect(proof.prover).to.equal(student.address);
            expect(proof.proofType).to.equal("ACCESS");
        });

        it("Should get proof metadata", async function () {
            const metadata = await zkpManager.getProofMetadata(proofHash);
            expect(metadata.recordId).to.equal(recordId);
            expect(metadata.accessor).to.equal(student.address);
            expect(metadata.action).to.equal("ACCESS_REQUEST");
        });

        it("Should get record proofs", async function () {
            const proofs = await zkpManager.getRecordProofs(recordId);
            expect(proofs.length).to.equal(1);
            expect(proofs[0]).to.equal(proofHash);
        });

        it("Should get user proofs", async function () {
            const proofs = await zkpManager.getUserProofs(student.address);
            expect(proofs.length).to.equal(1);
            expect(proofs[0]).to.equal(proofHash);
        });

        it("Should check if proof is valid", async function () {
            expect(await zkpManager.isProofValid(proofHash)).to.be.true;
        });

        it("Should get record proof statistics", async function () {
            const [proofCount, verifiedCount] = await zkpManager.getRecordProofStats(recordId);
            expect(proofCount).to.equal(1);
            expect(verifiedCount).to.equal(0); // Not verified yet
        });

        it("Should get user proof statistics", async function () {
            const [proofCount, verifiedCount] = await zkpManager.getUserProofStats(student.address);
            expect(proofCount).to.equal(1);
            expect(verifiedCount).to.equal(0); // Not verified yet
        });

        it("Should get global proof statistics", async function () {
            const [totalGenerated, totalVerified, verificationRate] = await zkpManager.getGlobalProofStats();
            expect(totalGenerated).to.equal(1);
            expect(totalVerified).to.equal(0);
            expect(verificationRate).to.equal(0);
        });

        it("Should reject getting invalid proof", async function () {
            const invalidHash = ethers.keccak256(ethers.toUtf8Bytes("invalid"));
            await expect(
                zkpManager.getProof(invalidHash)
            ).to.be.revertedWithCustomError(zkpManager, "InvalidProof");
        });
    });

    describe("Admin Functions", function () {
        const recordId = 1;
        let proofHash: string;

        beforeEach(async function () {
            const tx = await zkpManager.connect(student).generateAccessProof(
                recordId,
                student.address,
                mockProof.a as [number, number],
                mockProof.b as [[number, number], [number, number]],
                mockProof.c as [number, number],
                mockProof.publicInputs as [number, number]
            );
            const receipt = await tx.wait();
            const event = receipt!.logs.find(log => {
                try {
                    return zkpManager.interface.parseLog(log as any)?.name === "ProofGenerated";
                } catch {
                    return false;
                }
            });
            const parsedEvent = zkpManager.interface.parseLog(event as any);
            proofHash = parsedEvent!.args.proofHash;
        });

        it("Should allow admin to set proof validity duration", async function () {
            const newDuration = 2 * 60 * 60; // 2 hours
            await zkpManager.connect(admin).setProofValidityDuration(newDuration);
            expect(await zkpManager.proofValidityDuration()).to.equal(newDuration);
        });

        it("Should allow admin to set max proofs per record", async function () {
            const newMax = 500;
            await zkpManager.connect(admin).setMaxProofsPerRecord(newMax);
            expect(await zkpManager.maxProofsPerRecord()).to.equal(newMax);
        });

        it("Should allow admin to set max proofs per user", async function () {
            const newMax = 500;
            await zkpManager.connect(admin).setMaxProofsPerUser(newMax);
            expect(await zkpManager.maxProofsPerUser()).to.equal(newMax);
        });

        it("Should allow admin to invalidate proof", async function () {
            await zkpManager.connect(admin).invalidateProof(proofHash);
            const metadata = await zkpManager.getProofMetadata(proofHash);
            expect(metadata.isValid).to.be.false;
        });

        it("Should allow admin to cleanup expired proofs", async function () {
            // Set short validity duration
            await zkpManager.connect(admin).setProofValidityDuration(1); // 1 second

            // Fast forward time
            await ethers.provider.send("evm_increaseTime", [2]);
            await ethers.provider.send("evm_mine", []);

            await zkpManager.connect(admin).cleanupExpiredProofs([proofHash]);
            const metadata = await zkpManager.getProofMetadata(proofHash);
            expect(metadata.isValid).to.be.false;
        });

        it("Should reject invalid proof validity duration", async function () {
            // Test duration too long (25 hours)
            await expect(
                zkpManager.connect(admin).setProofValidityDuration(25 * 60 * 60) // 25 hours (too long)
            ).to.be.revertedWith("Duration too long");
        });

        it("Should reject zero max proofs", async function () {
            await expect(
                zkpManager.connect(admin).setMaxProofsPerRecord(0)
            ).to.be.revertedWith("Max proofs must be positive");

            await expect(
                zkpManager.connect(admin).setMaxProofsPerUser(0)
            ).to.be.revertedWith("Max proofs must be positive");
        });

        it("Should reject unauthorized admin functions", async function () {
            await expect(
                zkpManager.connect(unauthorized).setProofValidityDuration(2 * 60 * 60)
            ).to.be.revertedWith("Not admin or super admin");

            await expect(
                zkpManager.connect(unauthorized).invalidateProof(proofHash)
            ).to.be.revertedWith("Not admin or super admin");
        });
    });

    describe("Pause Functionality", function () {
        const recordId = 1;

        it("Should allow admin to pause contract", async function () {
            await zkpManager.connect(admin).pause();

            await expect(
                zkpManager.connect(student).generateAccessProof(
                    recordId,
                    student.address,
                    mockProof.a as [number, number],
                    mockProof.b as [[number, number], [number, number]],
                    mockProof.c as [number, number],
                    mockProof.publicInputs as [number, number]
                )
            ).to.be.revertedWith("Pausable: paused");
        });

        it("Should allow admin to unpause contract", async function () {
            await zkpManager.connect(admin).pause();
            await zkpManager.connect(admin).unpause();

            // Should work normally after unpause
            await expect(
                zkpManager.connect(student).generateAccessProof(
                    recordId,
                    student.address,
                    mockProof.a as [number, number],
                    mockProof.b as [[number, number], [number, number]],
                    mockProof.c as [number, number],
                    mockProof.publicInputs as [number, number]
                )
            ).to.emit(zkpManager, "ProofGenerated");
        });

        it("Should reject unauthorized pause", async function () {
            await expect(
                zkpManager.connect(unauthorized).pause()
            ).to.be.revertedWith("Not admin or super admin");
        });
    });
});