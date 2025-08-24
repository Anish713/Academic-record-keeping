const { ethers } = require("hardhat");

async function main() {
    // Deploy RecordStorage library first
    const RecordStorageFactory = await ethers.getContractFactory("RecordStorage");
    const recordStorageLib = await RecordStorageFactory.deploy();
    const recordStorageAddress = await recordStorageLib.getAddress();

    // Get contract factories with library linking
    const AcademicRecordsFactory = await ethers.getContractFactory("AcademicRecords", {
        libraries: {
            RecordStorage: recordStorageAddress,
        },
    });
    const AcademicRecordsOptimizedFactory = await ethers.getContractFactory("AcademicRecordsOptimized", {
        libraries: {
            RecordStorage: recordStorageAddress,
        },
    });

    // Get bytecode sizes
    const recordStorageSize = RecordStorageFactory.bytecode.length / 2 - 1; // Remove 0x prefix and convert to bytes
    const academicRecordsSize = AcademicRecordsFactory.bytecode.length / 2 - 1;
    const academicRecordsOptimizedSize = AcademicRecordsOptimizedFactory.bytecode.length / 2 - 1;

    console.log("Contract Sizes:");
    console.log("===============");
    console.log(`RecordStorage Library: ${recordStorageSize} bytes`);
    console.log(`AcademicRecords (Original): ${academicRecordsSize} bytes`);
    console.log(`AcademicRecordsOptimized: ${academicRecordsOptimizedSize} bytes`);
    console.log(`Mainnet Limit: 24576 bytes`);
    console.log("");

    if (academicRecordsOptimizedSize <= 24576) {
        console.log("✅ AcademicRecordsOptimized is deployable on Mainnet!");
    } else {
        console.log("❌ AcademicRecordsOptimized is still too large for Mainnet");
        console.log(`Need to reduce by ${academicRecordsOptimizedSize - 24576} bytes`);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });