import { ethers } from "hardhat";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: "../../.env" });

async function main() {
    console.log("🔧 Granting UNIVERSITY_ROLE in ZK Access Control...");

    // Get contract addresses from environment
    const zkAccessControlAddress = process.env.NEXT_PUBLIC_ZK_ACCESS_CONTROL_CONTRACT_ADDRESS;

    if (!zkAccessControlAddress) {
        throw new Error("ZK Access Control contract address not found in environment");
    }

    console.log(`ZK Access Control Contract: ${zkAccessControlAddress}`);

    // Get signer
    const [deployer] = await ethers.getSigners();
    console.log(`Using deployer: ${deployer.address}`);

    // Get ZK Access Control contract instance
    const ZKAccessControl = await ethers.getContractFactory("ZKAccessControl");
    const zkAccessControl = ZKAccessControl.attach(zkAccessControlAddress);

    // University address that needs the role (replace with your university wallet address)
    const universityAddress = "0xc389b2830680980fa24b5A78e2f20fc322D64667"; // Your university wallet
    console.log(`University address: ${universityAddress}`);

    try {
        // Get the UNIVERSITY_ROLE hash
        const UNIVERSITY_ROLE = await zkAccessControl.UNIVERSITY_ROLE();
        console.log(`UNIVERSITY_ROLE hash: ${UNIVERSITY_ROLE}`);

        // Check if university already has the role
        const hasRole = await zkAccessControl.hasRole(UNIVERSITY_ROLE, universityAddress);
        console.log(`University has UNIVERSITY_ROLE: ${hasRole}`);

        if (!hasRole) {
            console.log("Granting UNIVERSITY_ROLE to university address...");
            const tx = await zkAccessControl.grantRole(UNIVERSITY_ROLE, universityAddress);
            console.log(`Transaction hash: ${tx.hash}`);

            const receipt = await tx.wait();
            console.log(`Transaction confirmed in block: ${receipt.blockNumber}`);

            // Verify the role was granted
            const hasRoleAfter = await zkAccessControl.hasRole(UNIVERSITY_ROLE, universityAddress);
            console.log(`University has UNIVERSITY_ROLE after grant: ${hasRoleAfter}`);

            if (hasRoleAfter) {
                console.log("✅ UNIVERSITY_ROLE successfully granted!");
            } else {
                console.error("❌ Failed to grant UNIVERSITY_ROLE!");
            }
        } else {
            console.log("✅ University already has UNIVERSITY_ROLE");
        }

        // Also check the Academic Records contract to make sure university has role there too
        const academicRecordsAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
        if (academicRecordsAddress) {
            console.log("\n🔍 Checking Academic Records contract roles...");

            const deploymentInfo = require('../deployment-info.json');
            const recordStorageAddress = deploymentInfo.contracts.RecordStorage;

            const AcademicRecords = await ethers.getContractFactory("AcademicRecords", {
                libraries: {
                    RecordStorage: recordStorageAddress,
                },
            });
            const academicRecords = AcademicRecords.attach(academicRecordsAddress);

            const hasUniversityRoleInAR = await academicRecords.hasRole(UNIVERSITY_ROLE, universityAddress);
            console.log(`University has UNIVERSITY_ROLE in Academic Records: ${hasUniversityRoleInAR}`);

            if (!hasUniversityRoleInAR) {
                console.log("⚠️ Warning: University doesn't have UNIVERSITY_ROLE in Academic Records contract");
                console.log("You may need to grant this role in the Academic Records contract as well");
            }
        }

    } catch (error) {
        console.error("❌ Failed to grant university role:", error);
        throw error;
    }
}

main()
    .then(() => {
        console.log("✅ University role setup completed successfully!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Setup failed:", error);
        process.exit(1);
    });