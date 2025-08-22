import { ethers } from "hardhat";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: "../../.env" });

async function main() {
    console.log("🔧 Setting up ZK Access Control permissions...");

    // Get contract addresses from environment
    const academicRecordsAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
    const zkAccessControlAddress = process.env.NEXT_PUBLIC_ZK_ACCESS_CONTROL_CONTRACT_ADDRESS;

    if (!academicRecordsAddress || !zkAccessControlAddress) {
        throw new Error("Contract addresses not found in environment");
    }

    console.log(`Academic Records Contract: ${academicRecordsAddress}`);
    console.log(`ZK Access Control Contract: ${zkAccessControlAddress}`);

    // Get signer
    const [deployer] = await ethers.getSigners();
    console.log(`Using deployer: ${deployer.address}`);

    // Get ZK Access Control contract instance
    const ZKAccessControl = await ethers.getContractFactory("ZKAccessControl");
    const zkAccessControl = ZKAccessControl.attach(zkAccessControlAddress);

    try {
        // Define the ACADEMIC_RECORDS_ROLE
        const ACADEMIC_RECORDS_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ACADEMIC_RECORDS_ROLE"));
        console.log(`ACADEMIC_RECORDS_ROLE hash: ${ACADEMIC_RECORDS_ROLE}`);

        // Check if Academic Records contract already has the role
        const hasRole = await zkAccessControl.hasRole(ACADEMIC_RECORDS_ROLE, academicRecordsAddress);
        console.log(`Academic Records contract has ACADEMIC_RECORDS_ROLE: ${hasRole}`);

        if (!hasRole) {
            console.log("Granting ACADEMIC_RECORDS_ROLE to Academic Records contract...");
            const tx = await zkAccessControl.grantRole(ACADEMIC_RECORDS_ROLE, academicRecordsAddress);
            console.log(`Transaction hash: ${tx.hash}`);

            const receipt = await tx.wait();
            console.log(`Transaction confirmed in block: ${receipt.blockNumber}`);

            // Verify the role was granted
            const hasRoleAfter = await zkAccessControl.hasRole(ACADEMIC_RECORDS_ROLE, academicRecordsAddress);
            console.log(`Academic Records contract has ACADEMIC_RECORDS_ROLE after grant: ${hasRoleAfter}`);

            if (hasRoleAfter) {
                console.log("✅ ACADEMIC_RECORDS_ROLE successfully granted!");
            } else {
                console.error("❌ Failed to grant ACADEMIC_RECORDS_ROLE!");
            }
        } else {
            console.log("✅ Academic Records contract already has ACADEMIC_RECORDS_ROLE");
        }

        // Also check if the deployer has admin role to grant university roles
        const ADMIN_ROLE = await zkAccessControl.ADMIN_ROLE();
        const deployerHasAdmin = await zkAccessControl.hasRole(ADMIN_ROLE, deployer.address);
        console.log(`Deployer has ADMIN_ROLE: ${deployerHasAdmin}`);

        // Check if deployer is super admin
        const SUPER_ADMIN = await zkAccessControl.SUPER_ADMIN();
        const isSuperAdmin = (SUPER_ADMIN.toLowerCase() === deployer.address.toLowerCase());
        console.log(`Deployer is SUPER_ADMIN: ${isSuperAdmin}`);

        if (!deployerHasAdmin && !isSuperAdmin) {
            console.log("⚠️ Warning: Deployer doesn't have admin privileges in ZK contract");
            console.log("This might cause issues when universities try to add records");
        }

    } catch (error) {
        console.error("❌ Failed to setup ZK permissions:", error);
        throw error;
    }
}

main()
    .then(() => {
        console.log("✅ ZK permissions setup completed successfully!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Setup failed:", error);
        process.exit(1);
    });