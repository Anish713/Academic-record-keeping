import { ethers } from "hardhat";
import deploymentInfo from "../deployment-info.json";

async function main() {
    console.log("Adding test record for ZK proof testing...");

    // Get the deployer account
    const [deployer] = await ethers.getSigners();
    console.log("Using account:", deployer.address);

    // Get the deployed contracts
    const academicRecords = await ethers.getContractAt(
        "AcademicRecords",
        deploymentInfo.contracts.AcademicRecords
    );

    // Check current roles
    const UNIVERSITY_ROLE = ethers.keccak256(ethers.toUtf8Bytes("UNIVERSITY_ROLE"));
    const superAdminRole = await academicRecords.DEFAULT_ADMIN_ROLE();

    console.log("Checking roles for address:", deployer.address);
    console.log("Super admin address from deployment:", deploymentInfo.superAdmin);

    const hasSuperAdminRole = await academicRecords.hasRole(superAdminRole, deployer.address);
    const hasUniversityRole = await academicRecords.hasRole(UNIVERSITY_ROLE, deployer.address);

    console.log("Has super admin role:", hasSuperAdminRole);
    console.log("Has university role:", hasUniversityRole);

    // Check if the super admin from deployment has the role
    const superAdminHasRole = await academicRecords.hasRole(superAdminRole, deploymentInfo.superAdmin);
    console.log("Deployment super admin has role:", superAdminHasRole);

    if (!hasUniversityRole) {
        if (hasSuperAdminRole) {
            console.log("Granting university role to deployer...");
            await academicRecords.grantRole(UNIVERSITY_ROLE, deployer.address);
            console.log("✓ University role granted");
        } else {
            console.error("❌ Current account doesn't have admin privileges");
            console.error("❌ Please use the super admin account:", deploymentInfo.superAdmin);
            console.error("❌ Or grant university role to current account using the super admin");
            return;
        }
    } else {
        console.log("✓ Deployer already has university role");
    }

    // Add a test record
    const studentId = "TEST001";
    const studentName = "Test Student";
    const studentAddress = deployer.address; // Use deployer as student for testing
    const ipfsHash = "QmTestHash123456789"; // Mock IPFS hash
    const encryptedMetadata = "encrypted-test-metadata";
    const accessKey = "test-access-key-123";
    const merkleRoot = 1; // Simple merkle root for testing

    console.log("Adding test record...");
    const tx = await academicRecords.addRecord(
        studentId,
        studentName,
        studentAddress,
        ipfsHash,
        encryptedMetadata,
        accessKey,
        merkleRoot
    );

    const receipt = await tx.wait();
    console.log("✓ Test record added successfully");
    console.log("Transaction hash:", receipt?.hash);

    // Get the record ID from the event
    const recordAddedEvent = receipt?.logs.find(
        (log: any) => {
            try {
                const parsed = academicRecords.interface.parseLog(log);
                return parsed?.name === 'RecordAdded';
            } catch {
                return false;
            }
        }
    );

    if (recordAddedEvent) {
        const parsed = academicRecords.interface.parseLog(recordAddedEvent);
        const recordId = parsed?.args.recordId;
        console.log("✓ Test record ID:", recordId.toString());

        // Check if user has access via ZK contract
        const zkAccessControl = await ethers.getContractAt(
            "ZKAccessControl",
            deploymentInfo.zkAccessControl
        );

        try {
            const hasAccess = await zkAccessControl.hasAccess(recordId, deployer.address);
            console.log("✓ User has access to record:", hasAccess);

            const accessibleRecords = await zkAccessControl.getUserAccessibleRecords(deployer.address);
            console.log("✓ User's accessible records:", accessibleRecords.map(id => id.toString()));
        } catch (error) {
            console.log("Note: ZK access check failed (this might be expected if ZK integration isn't fully set up)");
            console.log("Error:", error instanceof Error ? error.message : error);
        }
    }

    console.log("✅ Test record setup completed successfully!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Error adding test record:", error);
        process.exit(1);
    });