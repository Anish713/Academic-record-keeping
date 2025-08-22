import { ethers } from "hardhat";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: "../../.env" });

async function main() {
    console.log("🔧 Migrating existing records to ZK Access Control...");

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

    // Get deployment info for library address
    const deploymentInfo = require('../deployment-info.json');
    const recordStorageAddress = deploymentInfo.contracts.RecordStorage;

    // Get contract instances
    const AcademicRecords = await ethers.getContractFactory("AcademicRecords", {
        libraries: {
            RecordStorage: recordStorageAddress,
        },
    });
    const academicRecords = AcademicRecords.attach(academicRecordsAddress);

    const ZKAccessControl = await ethers.getContractFactory("ZKAccessControl");
    const zkAccessControl = ZKAccessControl.attach(zkAccessControlAddress);

    try {
        // Get total number of records
        const totalRecords = await academicRecords.getTotalRecords();
        console.log(`Total records to migrate: ${totalRecords}`);

        if (totalRecords.toString() === "0") {
            console.log("No records to migrate.");
            return;
        }

        // Migrate each record
        for (let recordId = 1; recordId <= Number(totalRecords); recordId++) {
            try {
                console.log(`\n📋 Migrating record ${recordId}...`);

                // Get record data
                const record = await academicRecords.getRecord(recordId);
                console.log(`  Student: ${record.studentName} (${record.studentId})`);
                console.log(`  University: ${record.universityName}`);
                console.log(`  IPFS Hash: ${record.ipfsHash}`);

                // Check if record already exists in ZK contract
                let recordExists = false;
                try {
                    const zkRecord = await zkAccessControl.getEncryptedRecord(recordId);
                    recordExists = zkRecord.exists;
                } catch (error) {
                    // Record doesn't exist in ZK contract
                    recordExists = false;
                }

                if (recordExists) {
                    console.log(`  ✅ Record ${recordId} already exists in ZK contract`);
                    continue;
                }

                // Generate encrypted hashes (same logic as in AcademicRecords.sol)
                const encryptedIPFSHash = ethers.solidityPackedKeccak256(
                    ["string", "address", "uint256", "string"],
                    [record.ipfsHash, record.studentAddress, recordId, "IPFS"]
                );

                const encryptedMetadataHash = ethers.solidityPackedKeccak256(
                    ["string", "address", "uint256", "string"],
                    [record.metadataHash || "", record.studentAddress, recordId, "METADATA"]
                );

                const merkleRoot = ethers.solidityPackedKeccak256(
                    ["address", "uint256", "address", "uint256"],
                    [record.studentAddress, recordId, record.issuer, record.timestamp]
                );

                // Store encrypted record in ZK contract
                console.log(`  📝 Storing encrypted record in ZK contract...`);
                const storeTx = await zkAccessControl.storeEncryptedRecord(
                    recordId,
                    encryptedIPFSHash,
                    encryptedMetadataHash,
                    merkleRoot,
                    record.studentAddress
                );
                await storeTx.wait();
                console.log(`  ✅ Encrypted record stored`);

                // Grant access to the issuing university
                console.log(`  🔑 Granting access to university...`);
                const universityAccessKey = ethers.solidityPackedKeccak256(
                    ["address", "uint256", "string"],
                    [record.issuer, recordId, "UNIVERSITY"]
                );

                const grantTx = await zkAccessControl.grantAccess(
                    recordId,
                    record.issuer,
                    universityAccessKey,
                    ethers.MaxUint256 // Permanent access
                );
                await grantTx.wait();
                console.log(`  ✅ University access granted`);

                // Grant access to the student
                console.log(`  🔑 Granting access to student...`);
                const studentAccessKey = ethers.solidityPackedKeccak256(
                    ["address", "uint256", "string"],
                    [record.studentAddress, recordId, "STUDENT"]
                );

                const studentGrantTx = await zkAccessControl.grantAccess(
                    recordId,
                    record.studentAddress,
                    studentAccessKey,
                    ethers.MaxUint256 // Permanent access
                );
                await studentGrantTx.wait();
                console.log(`  ✅ Student access granted`);

                console.log(`  ✅ Record ${recordId} migration completed`);

            } catch (error) {
                console.error(`  ❌ Failed to migrate record ${recordId}:`, error);
                // Continue with next record
            }
        }

        console.log("\n🎉 Record migration completed!");

        // Verify migration
        console.log("\n🔍 Verifying migration...");
        for (let recordId = 1; recordId <= Number(totalRecords); recordId++) {
            try {
                const zkRecord = await zkAccessControl.getEncryptedRecord(recordId);
                if (zkRecord.exists) {
                    console.log(`  ✅ Record ${recordId} verified in ZK contract`);
                } else {
                    console.log(`  ❌ Record ${recordId} not found in ZK contract`);
                }
            } catch (error) {
                console.log(`  ❌ Record ${recordId} verification failed`);
            }
        }

    } catch (error) {
        console.error("❌ Migration failed:", error);
        throw error;
    }
}

main()
    .then(() => {
        console.log("✅ Migration completed successfully!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Migration failed:", error);
        process.exit(1);
    });