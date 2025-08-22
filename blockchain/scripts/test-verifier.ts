import { ethers } from "hardhat";

async function main() {
  console.log("🧪 Testing deployed ZK Verifier contract...");

  // Read deployment info
  const fs = require('fs');
  const path = require('path');
  const deploymentPath = path.join(__dirname, '../deployment-info.json');
  
  if (!fs.existsSync(deploymentPath)) {
    throw new Error("Deployment info not found. Please deploy the verifier first.");
  }

  const deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  const verifierAddress = deploymentInfo.verifier?.address;

  if (!verifierAddress) {
    throw new Error("Verifier address not found in deployment info.");
  }

  console.log("📍 Testing verifier at address:", verifierAddress);

  // Get the contract instance
  const verifier = await ethers.getContractAt("Groth16Verifier", verifierAddress);

  // Test 1: Invalid proof with all zeros
  console.log("\n🔍 Test 1: Invalid proof with all zeros");
  try {
    const result1 = await verifier.verifyProof(
      [0, 0], // pA
      [[0, 0], [0, 0]], // pB
      [0, 0], // pC
      [0, 0, 0] // pubSignals: recordHash, merkleRoot, isAuthorized
    );
    console.log("✅ Result:", result1 ? "VALID" : "INVALID");
    if (!result1) {
      console.log("✅ Correctly rejected invalid proof");
    } else {
      console.log("❌ Unexpectedly accepted invalid proof");
    }
  } catch (error) {
    console.log("❌ Error during verification:", error.message);
  }

  // Test 2: Another invalid proof with non-zero values
  console.log("\n🔍 Test 2: Invalid proof with non-zero values");
  try {
    const result2 = await verifier.verifyProof(
      ["1", "2"], // pA
      [["3", "4"], ["5", "6"]], // pB
      ["7", "8"], // pC
      ["9", "10", "11"] // pubSignals
    );
    console.log("✅ Result:", result2 ? "VALID" : "INVALID");
    if (!result2) {
      console.log("✅ Correctly rejected invalid proof");
    } else {
      console.log("❌ Unexpectedly accepted invalid proof");
    }
  } catch (error) {
    console.log("❌ Error during verification:", error.message);
  }

  // Test 3: Gas estimation
  console.log("\n⛽ Test 3: Gas estimation");
  try {
    const gasEstimate = await verifier.verifyProof.estimateGas(
      ["1", "2"],
      [["3", "4"], ["5", "6"]],
      ["7", "8"],
      ["9", "10", "11"]
    );
    console.log("✅ Gas estimate:", gasEstimate.toString());
  } catch (error) {
    console.log("❌ Error estimating gas:", error.message);
  }

  // Test 4: Contract interface check
  console.log("\n🔧 Test 4: Contract interface check");
  try {
    const address = await verifier.getAddress();
    const code = await ethers.provider.getCode(address);
    console.log("✅ Contract address:", address);
    console.log("✅ Contract has code:", code !== "0x");
    console.log("✅ Code size:", code.length, "characters");
  } catch (error) {
    console.log("❌ Error checking contract:", error.message);
  }

  console.log("\n🎉 Verifier testing completed!");
}

main()
  .then(() => {
    console.log("✅ All tests completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Testing failed:", error);
    process.exit(1);
  });