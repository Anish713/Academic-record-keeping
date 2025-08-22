import { ethers } from "hardhat";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: "../../.env" });

async function main() {
  console.log("🚀 Deploying ZK Verifier contract...");

  // Get the contract factory
  const Verifier = await ethers.getContractFactory("Groth16Verifier");

  // Deploy the contract
  const verifier = await Verifier.deploy();
  await verifier.waitForDeployment();

  const verifierAddress = await verifier.getAddress();
  console.log("✅ Groth16Verifier deployed to:", verifierAddress);

  // Test the contract by calling a view function
  try {
    // The verifier contract doesn't have any initialization functions to test,
    // but we can verify it's deployed correctly by checking the contract code
    const code = await ethers.provider.getCode(verifierAddress);
    if (code === "0x") {
      throw new Error("Contract deployment failed - no code at address");
    }
    console.log("✅ Contract deployment verified - code exists at address");
  } catch (error) {
    console.error("❌ Contract verification failed:", error);
    throw error;
  }

  // Save deployment info
  const deploymentInfo = {
    verifier: {
      address: verifierAddress,
      contractName: "Groth16Verifier",
      deployedAt: new Date().toISOString(),
      network: (await ethers.provider.getNetwork()).name,
      chainId: (await ethers.provider.getNetwork()).chainId.toString()
    }
  };

  const fs = require('fs');
  const path = require('path');

  // Read existing deployment info if it exists
  const deploymentPath = path.join(__dirname, '../deployment-info.json');
  let existingInfo = {};

  try {
    if (fs.existsSync(deploymentPath)) {
      existingInfo = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
    }
  } catch (error) {
    console.warn("⚠️  Could not read existing deployment info:", error.message);
  }

  // Merge with existing info
  const updatedInfo = { ...existingInfo, ...deploymentInfo };

  fs.writeFileSync(deploymentPath, JSON.stringify(updatedInfo, null, 2));
  console.log("📝 Deployment info saved to deployment-info.json");

  return verifierAddress;
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then((address) => {
    console.log("🎉 Deployment completed successfully!");
    console.log("📍 Verifier address:", address);
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Deployment failed:", error);
    process.exit(1);
  });