import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  console.log("Deploying ZK Access Control contract...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // First, deploy the verifier contract if not already deployed
  let verifierAddress: string;
  
  try {
    // Try to read existing deployment info
    const deploymentInfoPath = path.join(__dirname, "../deployment-info.json");
    const deploymentInfo = JSON.parse(fs.readFileSync(deploymentInfoPath, "utf8"));
    
    if (deploymentInfo.verifier) {
      // Handle both string addresses and object formats
      if (typeof deploymentInfo.verifier === 'string') {
        verifierAddress = deploymentInfo.verifier;
      } else if (deploymentInfo.verifier.address) {
        verifierAddress = deploymentInfo.verifier.address;
      } else {
        throw new Error("Invalid verifier format in deployment info");
      }
      console.log("Using existing verifier at:", verifierAddress);
    } else {
      throw new Error("No verifier found in deployment info");
    }
  } catch (error) {
    console.log("Deploying new verifier contract...");
    const VerifierFactory = await ethers.getContractFactory("Groth16Verifier");
    const verifier = await VerifierFactory.deploy();
    await verifier.waitForDeployment();
    verifierAddress = await verifier.getAddress();
    console.log("Verifier deployed to:", verifierAddress);
  }

  // Deploy ZK Access Control contract
  const ZKAccessControlFactory = await ethers.getContractFactory("ZKAccessControl");
  const zkAccessControl = await ZKAccessControlFactory.deploy(verifierAddress);
  await zkAccessControl.waitForDeployment();

  const zkAccessControlAddress = await zkAccessControl.getAddress();
  console.log("ZK Access Control deployed to:", zkAccessControlAddress);

  // Update deployment info
  const deploymentInfoPath = path.join(__dirname, "../deployment-info.json");
  let deploymentInfo: any = {};
  
  try {
    deploymentInfo = JSON.parse(fs.readFileSync(deploymentInfoPath, "utf8"));
  } catch (error) {
    console.log("Creating new deployment info file");
  }

  deploymentInfo.zkAccessControl = zkAccessControlAddress;
  deploymentInfo.verifier = verifierAddress;
  deploymentInfo.deployedAt = new Date().toISOString();
  deploymentInfo.network = (await ethers.provider.getNetwork()).name;

  fs.writeFileSync(deploymentInfoPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("Deployment info updated");

  // Verify deployment
  console.log("\nVerifying deployment...");
  const superAdmin = await zkAccessControl.SUPER_ADMIN();
  console.log("Super admin:", superAdmin);
  console.log("Verifier address:", await zkAccessControl.verifier());
  console.log("Contract paused:", await zkAccessControl.paused());

  console.log("\nZK Access Control deployment completed successfully!");
  console.log("Contract address:", zkAccessControlAddress);
  console.log("Transaction hash:", zkAccessControl.deploymentTransaction()?.hash);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });