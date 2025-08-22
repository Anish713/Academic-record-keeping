import { ethers } from "hardhat";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: "../../.env" });

async function main() {
    console.log("🔧 Setting ZK Access Control contract address in Academic Records...");

    // Get contract addresses from environment
    const academicRecordsAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
    const zkAccessControlAddress = process.env.NEXT_PUBLIC_ZK_ACCESS_CONTROL_CONTRACT_ADDRESS;

    if (!academicRecordsAddress) {
        throw new Error("NEXT_PUBLIC_CONTRACT_ADDRESS not found in environment");
    }

    if (!zkAccessControlAddress) {
        throw new Error("NEXT_PUBLIC_ZK_ACCESS_CONTROL_CONTRACT_ADDRESS not found in environment");
    }

    console.log(`Academic Records Contract: ${academicRecordsAddress}`);
    console.log(`ZK Access Control Contract: ${zkAccessControlAddress}`);

    // Get signer
    const [deployer] = await ethers.getSigners();
    console.log(`Using deployer: ${deployer.address}`);

    // Get deployment info to get library address
    const deploymentInfo = require('../deployment-info.json');
    const recordStorageAddress = deploymentInfo.contracts.RecordStorage;

    if (!recordStorageAddress) {
        throw new Error("RecordStorage library address not found in deployment info");
    }

    console.log(`RecordStorage Library: ${recordStorageAddress}`);

    // Get Academic Records contract instance with library linking
    const AcademicRecords = await ethers.getContractFactory("AcademicRecords", {
        libraries: {
            RecordStorage: recordStorageAddress,
        },
    });
    const academicRecords = AcademicRecords.attach(academicRecordsAddress);

    try {
        // Check current ZK Access Control address
        let currentZKAddress;
        try {
            currentZKAddress = await academicRecords.zkAccessControl();
            console.log(`Current ZK Access Control address: ${currentZKAddress}`);
        } catch (error) {
            console.log("Could not read current ZK Access Control address");
        }

        // Set the ZK Access Control contract address
        console.log("Setting ZK Access Control contract address...");
        const tx = await academicRecords.setZKAccessControl(zkAccessControlAddress);
        console.log(`Transaction hash: ${tx.hash}`);

        // Wait for confirmation
        const receipt = await tx.wait();
        console.log(`Transaction confirmed in block: ${receipt.blockNumber}`);

        // Verify the setting
        const newZKAddress = await academicRecords.zkAccessControl();
        console.log(`✅ ZK Access Control address set to: ${newZKAddress}`);

        if (newZKAddress.toLowerCase() === zkAccessControlAddress.toLowerCase()) {
            console.log("✅ ZK Access Control contract successfully linked!");
        } else {
            console.error("❌ ZK Access Control address mismatch!");
        }

    } catch (error) {
        console.error("❌ Failed to set ZK Access Control address:", error);
        throw error;
    }
}

main()
    .then(() => {
        console.log("✅ ZK Access Control setup completed successfully!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Setup failed:", error);
        process.exit(1);
    });