import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  console.log("Testing ZK Access Control contract...");

  // Read deployment info
  const deploymentInfoPath = path.join(__dirname, "../deployment-info.json");
  const deploymentInfo = JSON.parse(fs.readFileSync(deploymentInfoPath, "utf8"));
  
  if (!deploymentInfo.zkAccessControl) {
    throw new Error("ZK Access Control contract not deployed. Run deploy-zk-access-control.ts first.");
  }

  // Get contract instance
  const zkAccessControl = await ethers.getContractAt("ZKAccessControl", deploymentInfo.zkAccessControl);
  const [deployer, university, student] = await ethers.getSigners();

  console.log("Contract address:", await zkAccessControl.getAddress());
  console.log("Super admin:", await zkAccessControl.SUPER_ADMIN());
  console.log("Verifier address:", await zkAccessControl.verifier());

  // Test basic functionality
  console.log("\nTesting basic functionality...");

  // Add university role
  console.log("Adding university role...");
  await zkAccessControl.addUniversity(university.address, "Test University");
  console.log("University added successfully");

  // Test storing encrypted record
  console.log("Testing encrypted record storage...");
  const recordId = 1;
  const encryptedIPFSHash = ethers.keccak256(ethers.toUtf8Bytes("test_encrypted_ipfs_hash"));
  const encryptedMetadataHash = ethers.keccak256(ethers.toUtf8Bytes("test_encrypted_metadata_hash"));
  const merkleRoot = ethers.keccak256(ethers.toUtf8Bytes("test_merkle_root"));

  const tx = await zkAccessControl.connect(university).storeEncryptedRecord(
    recordId,
    encryptedIPFSHash,
    encryptedMetadataHash,
    merkleRoot,
    student.address
  );
  
  await tx.wait();
  console.log("Encrypted record stored successfully");

  // Test record retrieval
  console.log("Testing record retrieval...");
  const record = await zkAccessControl.getEncryptedRecord(recordId);
  console.log("Record owner:", record.owner);
  console.log("Record exists:", record.exists);
  console.log("Encrypted IPFS hash:", record.encryptedIPFSHash);

  // Test access check
  console.log("Testing access check...");
  const hasAccess = await zkAccessControl.hasAccess(recordId, student.address);
  console.log("Student has access:", hasAccess);

  // Test user accessible records
  console.log("Testing user accessible records...");
  const accessibleRecords = await zkAccessControl.getUserAccessibleRecords(student.address);
  console.log("Accessible records:", accessibleRecords.map(r => Number(r)));

  // Test access key retrieval
  console.log("Testing access key retrieval...");
  const accessKey = await zkAccessControl.connect(student).getUserAccessKey(recordId, student.address);
  console.log("Access key retrieved:", accessKey !== ethers.ZeroHash);

  console.log("\nAll tests passed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });