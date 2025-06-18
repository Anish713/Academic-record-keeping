import { ethers } from "hardhat";

async function main() {
  console.log("Deploying AcademicRecords contract...");

  const AcademicRecords = await ethers.getContractFactory("AcademicRecords");
  const academicRecords = await AcademicRecords.deploy();

  await academicRecords.waitForDeployment();

  const address = await academicRecords.getAddress();
  console.log(`AcademicRecords deployed to: ${address}`);

  // For testing purposes, you can add a university here
  // const adminSigner = await ethers.provider.getSigner(0);
  // const universityAddress = "0x...";
  // await academicRecords.connect(adminSigner).addUniversity(universityAddress);
  // console.log(`Added university: ${universityAddress}`);

  console.log("Deployment completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
