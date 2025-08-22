import { ethers } from "hardhat";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: "../../.env" });

/**
 * Validation script to test Sepolia deployment prerequisites without actually deploying
 */
async function validateSepoliaDeployment() {
    console.log('🔍 Validating Sepolia deployment prerequisites...\n');

    let validationPassed = true;
    const issues: string[] = [];

    // Check required environment variables
    const requiredEnvVars = [
        'PRIVATE_KEY',
        'INFURA_API_KEY',
        'ETHERSCAN_API_KEY'
    ];

    console.log('📋 Checking environment variables...');
    requiredEnvVars.forEach(varName => {
        if (!process.env[varName]) {
            issues.push(`Missing environment variable: ${varName}`);
            validationPassed = false;
            console.log(`❌ ${varName}: Missing`);
        } else {
            console.log(`✅ ${varName}: Present`);
        }
    });

    // Validate private key format
    if (process.env.PRIVATE_KEY) {
        const privateKey = process.env.PRIVATE_KEY.startsWith('0x') ? process.env.PRIVATE_KEY : `0x${process.env.PRIVATE_KEY}`;
        if (!privateKey.match(/^0x[a-fA-F0-9]{64}$/)) {
            issues.push('Invalid private key format (should be 0x followed by 64 hex characters)');
            validationPassed = false;
            console.log('❌ Private key format: Invalid');
        } else {
            console.log('✅ Private key format: Valid');
        }
    }

    // Test network connectivity
    console.log('\n🌐 Testing network connectivity...');
    try {
        const network = await ethers.provider.getNetwork();
        if (network.chainId !== 11155111n) {
            issues.push(`Expected Sepolia network (11155111), got ${network.chainId}`);
            validationPassed = false;
            console.log(`❌ Network: Wrong network (Chain ID: ${network.chainId})`);
        } else {
            console.log(`✅ Network: Connected to Sepolia (Chain ID: ${network.chainId})`);
        }
    } catch (error) {
        issues.push(`Network connectivity failed: ${error.message}`);
        validationPassed = false;
        console.log(`❌ Network: Connection failed - ${error.message}`);
    }

    // Check deployer account and balance
    console.log('\n💰 Checking deployer account...');
    try {
        const [deployer] = await ethers.getSigners();
        if (!deployer.address) {
            issues.push('No deployer account available');
            validationPassed = false;
            console.log('❌ Deployer: No account available');
        } else {
            console.log(`✅ Deployer: ${deployer.address}`);

            const balance = await ethers.provider.getBalance(deployer.address);
            const balanceEth = ethers.formatEther(balance);
            const minBalance = 0.1;

            if (parseFloat(balanceEth) < minBalance) {
                issues.push(`Insufficient balance: ${balanceEth} ETH (minimum ${minBalance} ETH required)`);
                validationPassed = false;
                console.log(`❌ Balance: ${balanceEth} ETH (insufficient)`);
            } else {
                console.log(`✅ Balance: ${balanceEth} ETH (sufficient)`);
            }
        }
    } catch (error) {
        issues.push(`Account validation failed: ${error.message}`);
        validationPassed = false;
        console.log(`❌ Account: Validation failed - ${error.message}`);
    }

    // Test Infura API key
    console.log('\n🔑 Testing Infura API key...');
    try {
        await ethers.provider.getBlockNumber();
        console.log('✅ Infura API: Working correctly');
    } catch (error) {
        issues.push(`Infura API key validation failed: ${error.message}`);
        validationPassed = false;
        console.log(`❌ Infura API: Failed - ${error.message}`);
    }

    // Check contract compilation
    console.log('\n🔨 Checking contract compilation...');
    try {
        // Check basic contracts first
        const basicContracts = ['Groth16Verifier', 'ZKAccessControl', 'RecordStorage'];

        for (const contractName of basicContracts) {
            try {
                await ethers.getContractFactory(contractName);
                console.log(`✅ ${contractName}: Compiled successfully`);
            } catch (error) {
                issues.push(`Contract ${contractName} compilation failed: ${error.message}`);
                validationPassed = false;
                console.log(`❌ ${contractName}: Compilation failed`);
            }
        }

        // Check AcademicRecords with library linking
        try {
            // Just check if we can create the factory with a dummy address
            await ethers.getContractFactory("AcademicRecords", {
                libraries: {
                    RecordStorage: "0x0000000000000000000000000000000000000001", // Dummy address for validation
                },
            });
            console.log(`✅ AcademicRecords: Compiled successfully (with library linking)`);
        } catch (error) {
            issues.push(`Contract AcademicRecords compilation failed: ${error.message}`);
            validationPassed = false;
            console.log(`❌ AcademicRecords: Compilation failed`);
        }
    } catch (error) {
        issues.push(`Contract compilation check failed: ${error.message}`);
        validationPassed = false;
        console.log(`❌ Contract compilation: Failed - ${error.message}`);
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    if (validationPassed) {
        console.log('🎉 VALIDATION PASSED - Ready for Sepolia deployment!');
        console.log('\nTo deploy to Sepolia, run:');
        console.log('  npm run deploy:sepolia');
    } else {
        console.log('❌ VALIDATION FAILED - Please fix the following issues:');
        issues.forEach((issue, index) => {
            console.log(`  ${index + 1}. ${issue}`);
        });
    }
    console.log('='.repeat(60));

    return validationPassed;
}

// Execute validation
validateSepoliaDeployment()
    .then((passed) => {
        process.exit(passed ? 0 : 1);
    })
    .catch((error) => {
        console.error('\n💥 Validation script failed:', error);
        process.exit(1);
    });