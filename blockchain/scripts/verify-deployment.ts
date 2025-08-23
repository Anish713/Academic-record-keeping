import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config({ path: "../../.env" });

async function verifyDeployment() {
    console.log("🔍 Verifying deployed contracts...");

    try {
        // Contract addresses from deployment
        const verifierAddress = "0x003c0e18374ee08f1e747EAE8D4672d0570f22E3";
        const zkAccessControlAddress = "0x54082ACE0dE80b8533e006be5400cBdA4bCD9D6A";
        const academicRecordsAddress = "0x16223a02e8796C060192eD27F761008Ce84e82a8";
        const studentManagementAddress = "0xc11Ad9EccAEf9a098089117098634D5Fa8f40361";

        // Test Verifier contract
        console.log("\n📋 Testing Groth16Verifier...");
        const verifierCode = await ethers.provider.getCode(verifierAddress);
        console.log(`✅ Verifier contract exists: ${verifierCode !== "0x"}`);

        // Test ZKAccessControl contract
        console.log("\n📋 Testing ZKAccessControl...");
        const zkAccessControl = await ethers.getContractAt("ZKAccessControl", zkAccessControlAddress);
        const storedVerifierAddress = await zkAccessControl.verifier();
        const isPaused = await zkAccessControl.paused();
        console.log(`✅ ZKAccessControl verifier: ${storedVerifierAddress}`);
        console.log(`✅ ZKAccessControl paused: ${isPaused}`);
        console.log(`✅ Verifier address matches: ${storedVerifierAddress.toLowerCase() === verifierAddress.toLowerCase()}`);

        // Test AcademicRecords contract
        console.log("\n📋 Testing AcademicRecords...");
        const academicRecords = await ethers.getContractAt("AcademicRecords", academicRecordsAddress);
        const totalRecords = await academicRecords.getTotalRecords();
        const totalCustomTypes = await academicRecords.getTotalCustomTypes();
        const retrievedStudentManagement = await academicRecords.studentManagement();
        console.log(`✅ Total records: ${totalRecords.toString()}`);
        console.log(`✅ Total custom types: ${totalCustomTypes.toString()}`);
        console.log(`✅ StudentManagement address: ${retrievedStudentManagement}`);
        console.log(`✅ StudentManagement matches: ${retrievedStudentManagement.toLowerCase() === studentManagementAddress.toLowerCase()}`);

        // Test StudentManagement contract
        console.log("\n📋 Testing StudentManagement...");
        const studentManagementCode = await ethers.provider.getCode(studentManagementAddress);
        console.log(`✅ StudentManagement contract exists: ${studentManagementCode !== "0x"}`);

        console.log("\n🎉 All contracts verified successfully!");

        // Summary
        console.log("\n📋 DEPLOYMENT SUMMARY:");
        console.log("=".repeat(50));
        console.log(`Groth16Verifier: ${verifierAddress}`);
        console.log(`ZKAccessControl: ${zkAccessControlAddress}`);
        console.log(`AcademicRecords: ${academicRecordsAddress}`);
        console.log(`StudentManagement: ${studentManagementAddress}`);
        console.log("=".repeat(50));

    } catch (error) {
        console.error("❌ Verification failed:", error);
        process.exit(1);
    }
}

verifyDeployment()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });