import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

/**
 * Deploys the Academic Records System contracts and saves deployment details.
 *
 * Deploys the RecordStorage library and the AcademicRecords contract (linked to the library), retrieves the StudentManagement contract address and Super Admin from the deployed contracts, verifies the deployment by checking initial contract state, logs a deployment summary, and writes deployment information to a JSON file.
 *
 * @returns An object containing the deployed addresses for RecordStorage, AcademicRecords, StudentManagement, and the Super Admin address.
 */
async function main() {
  console.log("Deploying Academic Records System...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log(
    "Account balance:",
    (await deployer.provider.getBalance(deployer.address)).toString()
  );

  // Step 1: Deploy RecordStorage library
  const RecordStorage = await ethers.getContractFactory("RecordStorage");
  const recordStorage = await RecordStorage.deploy();
  await recordStorage.waitForDeployment();
  const recordStorageAddress = await recordStorage.getAddress();

  // Step 2: Deploy AcademicRecords
  const AcademicRecords = await ethers.getContractFactory("AcademicRecords", {
    libraries: {
      RecordStorage: recordStorageAddress,
    },
  });

  const academicRecords = await AcademicRecords.deploy();
  await academicRecords.waitForDeployment();
  const academicRecordsAddress = await academicRecords.getAddress();

  // Step 3: Get StudentManagement address
  const studentManagementAddress = await academicRecords.studentManagement();

  // Step 4: Get Super Admin
  const superAdmin = await academicRecords.SUPER_ADMIN();

  // Step 5: Verify deployment
  try {
    const totalRecords = await academicRecords.getTotalRecords();
    const totalCustomTypes = await academicRecords.getTotalCustomTypes();
    console.log("Initial total records:", totalRecords.toString());
    console.log("Initial total custom types:", totalCustomTypes.toString());
  } catch (error) {
    console.error("❌ Deployment verification failed:", error);
    throw error;
  }

  // Step 6: Log summary
  const network = (await deployer.provider.getNetwork()).name;
  console.log("\n📋 Deployment Summary:");
  console.log(`RecordStorage Library: ${recordStorageAddress}`);
  console.log(`AcademicRecords Contract: ${academicRecordsAddress}`);
  console.log(`StudentManagement Contract: ${studentManagementAddress}`);
  console.log(`Super Admin: ${superAdmin}`);
  console.log(`Network: ${network}`);

  // Step 7: Save to file
  const deploymentInfo = {
    network,
    timestamp: new Date().toISOString(),
    superAdmin,
    contracts: {
      RecordStorage: recordStorageAddress,
      AcademicRecords: academicRecordsAddress,
      StudentManagement: studentManagementAddress,
    },
  };
  fs.writeFileSync(
    "deployment-info.json",
    JSON.stringify(deploymentInfo, null, 2)
  );

  return deploymentInfo.contracts;
}

/**
 * Copies all `.json` files (excluding `.dbg.json`) from a nested directory to a flat output directory.
 * @param {string} inputDir - Source directory path.
 * @param {string} outputDir - Destination directory path.
 */
function copyJsonFiles(
  inputDir = "/Users/anishshrestha/learning/solidity/blockchain-record-keeping/blockchain/artifacts/contracts",
  outputDir = "/Users/anishshrestha/learning/solidity/blockchain-record-keeping/src/contracts"
) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  function traverseAndCopy(inputDir: string) {
    const files = fs.readdirSync(inputDir);

    files.forEach((file) => {
      const fullPath = path.join(inputDir, file);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        traverseAndCopy(fullPath);
      } else if (
        stat.isFile() &&
        file.endsWith(".json") &&
        !file.endsWith(".dbg.json")
      ) {
        const destPath = path.join(outputDir, file);
        fs.copyFileSync(fullPath, destPath);
        console.log(`Copied: ${file}`);
      }
    });
  }

  traverseAndCopy(inputDir);
}

main()
  .then((addresses) => {
    console.log("\n🎉 Deployment completed successfully!");
    console.log("Contract addresses:", addresses);

    console.log("\n📂 Copying ABI files...");
    try {
      copyJsonFiles();
      console.log("✅ ABI files copied successfully!");
    } catch (copyError) {
      console.error("❌ Failed to copy ABI files:");
      console.error(copyError);
    }

    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Deployment failed:");
    console.error(error);
    process.exit(1);
  });
