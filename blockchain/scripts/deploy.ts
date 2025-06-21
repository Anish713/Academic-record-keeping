import { ethers } from "hardhat";

async function main() {
  console.log("Deploying Academic Records System...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log(
    "Account balance:",
    (await deployer.provider.getBalance(deployer.address)).toString()
  );

  // Step 1: Deploy the RecordStorage library
  console.log("\n1. Deploying RecordStorage library...");
  const RecordStorage = await ethers.getContractFactory("RecordStorage");
  const recordStorage = await RecordStorage.deploy();
  await recordStorage.waitForDeployment();
  const recordStorageAddress = await recordStorage.getAddress();
  console.log("RecordStorage library deployed to:", recordStorageAddress);

  // Step 2: Deploy AcademicRecords contract with library linking
  console.log("\n2. Deploying AcademicRecords contract...");
  const AcademicRecords = await ethers.getContractFactory("AcademicRecords", {
    libraries: {
      RecordStorage: recordStorageAddress,
    },
  });

  const academicRecords = await AcademicRecords.deploy();
  await academicRecords.waitForDeployment();
  const academicRecordsAddress = await academicRecords.getAddress();
  console.log("AcademicRecords contract deployed to:", academicRecordsAddress);

  // Step 3: Get the StudentManagement contract address
  const studentManagementAddress = await academicRecords.studentManagement();
  console.log(
    "StudentManagement contract deployed to:",
    studentManagementAddress
  );

  // Step 4: Verify deployment
  console.log("\n3. Verifying deployment...");
  try {
    const totalRecords = await academicRecords.getTotalRecords();
    const totalCustomTypes = await academicRecords.getTotalCustomTypes();
    console.log("Initial total records:", totalRecords.toString());
    console.log("Initial total custom types:", totalCustomTypes.toString());
    console.log("✅ Deployment verification successful!");
  } catch (error) {
    console.log("❌ Deployment verification failed:", error);
    throw error;
  }

  // Step 5: Display deployment summary
  console.log("\n📋 Deployment Summary:");
  console.log("========================");
  console.log(`RecordStorage Library: ${recordStorageAddress}`);
  console.log(`AcademicRecords Contract: ${academicRecordsAddress}`);
  console.log(`StudentManagement Contract: ${studentManagementAddress}`);
  console.log(`Deployer Address: ${deployer.address}`);
  console.log(`Network: ${(await deployer.provider.getNetwork()).name}`);

  // Step 6: Save deployment addresses to a file
  const fs = require("fs");
  const deploymentInfo = {
    network: (await deployer.provider.getNetwork()).name,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
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
  console.log("\n💾 Deployment info saved to deployment-info.json");

  return {
    recordStorage: recordStorageAddress,
    academicRecords: academicRecordsAddress,
    studentManagement: studentManagementAddress,
  };
}

// Handle errors and run the deployment
main()
  .then((addresses) => {
    console.log("\n🎉 Deployment completed successfully!");
    console.log("Contract addresses:", addresses);
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Deployment failed:");
    console.error(error);
    process.exit(1);
  });
