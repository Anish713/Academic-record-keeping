import { ethers } from "hardhat";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("🚀 Setting up ZK infrastructure...");

  // Step 1: Check if circuit files exist
  console.log("\n📋 Step 1: Checking circuit files...");
  const circuitPath = path.join(__dirname, "../circuits/access-control.circom");
  const publicCircuitsDir = path.join(__dirname, "../../public/circuits");
  
  if (!fs.existsSync(circuitPath)) {
    throw new Error("Circuit file not found at: " + circuitPath);
  }
  console.log("✅ Circuit file found");

  // Step 2: Compile circuit if needed
  console.log("\n🔧 Step 2: Compiling circuit...");
  const r1csPath = path.join(publicCircuitsDir, "access-control.r1cs");
  
  if (!fs.existsSync(r1csPath)) {
    console.log("Compiling circuit...");
    execSync("npm run compile:circuits", { stdio: "inherit", cwd: __dirname + "/.." });
  } else {
    console.log("✅ Circuit already compiled");
  }

  // Step 3: Generate proving keys if needed
  console.log("\n🔑 Step 3: Generating proving keys...");
  const zkeyPath = path.join(publicCircuitsDir, "access-control_0001.zkey");
  
  if (!fs.existsSync(zkeyPath)) {
    console.log("Generating proving keys...");
    
    // Check if PTAU file exists
    const ptauPath = path.join(__dirname, "../circuits/pot14_final.ptau");
    if (!fs.existsSync(ptauPath)) {
      console.log("Copying PTAU file...");
      const sourcePtauPath = path.join(__dirname, "../../circuits/pot14_final.ptau");
      if (fs.existsSync(sourcePtauPath)) {
        fs.copyFileSync(sourcePtauPath, ptauPath);
      } else {
        throw new Error("PTAU file not found. Please run the circuit setup first.");
      }
    }
    
    // Generate keys
    execSync(`npx snarkjs groth16 setup ${r1csPath} ${ptauPath} ${path.join(publicCircuitsDir, "access-control_0000.zkey")}`, 
      { stdio: "inherit" });
    
    execSync(`npx snarkjs zkey contribute ${path.join(publicCircuitsDir, "access-control_0000.zkey")} ${zkeyPath} --name="Setup contribution" -v`, 
      { stdio: "inherit" });
    
    execSync(`npx snarkjs zkey export verificationkey ${zkeyPath} ${path.join(__dirname, "../circuits/verification_key.json")}`, 
      { stdio: "inherit" });
  } else {
    console.log("✅ Proving keys already exist");
  }

  // Step 4: Generate Solidity verifier
  console.log("\n📝 Step 4: Generating Solidity verifier...");
  const verifierPath = path.join(__dirname, "../contracts/verifier.sol");
  
  console.log("Generating verifier contract...");
  execSync(`npx snarkjs zkey export solidityverifier ${zkeyPath} ${verifierPath}`, 
    { stdio: "inherit" });
  console.log("✅ Verifier contract generated");

  // Step 5: Compile contracts
  console.log("\n🔨 Step 5: Compiling contracts...");
  execSync("npm run compile", { stdio: "inherit", cwd: __dirname + "/.." });
  console.log("✅ Contracts compiled");

  // Step 6: Run tests
  console.log("\n🧪 Step 6: Running verifier tests...");
  execSync('npm test -- --grep "Groth16Verifier"', { stdio: "inherit", cwd: __dirname + "/.." });
  console.log("✅ Tests passed");

  console.log("\n🎉 ZK infrastructure setup completed successfully!");
  console.log("\n📋 Summary:");
  console.log("✅ Circuit compiled");
  console.log("✅ Proving keys generated");
  console.log("✅ Verifier contract generated");
  console.log("✅ Contracts compiled");
  console.log("✅ Tests passed");
  console.log("\n🚀 Ready to deploy verifier contract!");
  console.log("Run: npm run deploy:verifier:local");
}

main()
  .then(() => {
    console.log("✅ Setup completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Setup failed:", error);
    process.exit(1);
  });