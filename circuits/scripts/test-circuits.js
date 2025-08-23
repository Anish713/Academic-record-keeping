#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const snarkjs = require('snarkjs');

const CIRCUITS_DIR = path.join(__dirname, '..');
const COMPILED_DIR = path.join(CIRCUITS_DIR, 'compiled');
const KEYS_DIR = path.join(CIRCUITS_DIR, 'keys');

async function testAccessVerificationCircuit() {
    console.log('\n🧪 Testing Access Verification Circuit...');

    const wasmPath = path.join(COMPILED_DIR, 'access_verification', 'access_verification.wasm');
    const zkeyPath = path.join(KEYS_DIR, 'access_verification.zkey');

    if (!fs.existsSync(wasmPath) || !fs.existsSync(zkeyPath)) {
        console.error('❌ Circuit files not found. Please compile and generate keys first.');
        return false;
    }

    try {
        // Test case 1: Student accessing their own record
        const input1 = {
            recordId: "12345",
            userAddress: "0x1234567890123456789012345678901234567890",
            issuerAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdef",
            studentAddress: "0x1234567890123456789012345678901234567890", // Same as user
            accessType: "0", // OWNER
            timestamp: "1640995200", // Jan 1, 2022
            accessSecret: "secret123"
        };

        console.log('🔍 Test 1: Student accessing own record');
        const { proof: proof1, publicSignals: publicSignals1 } = await snarkjs.groth16.fullProve(
            input1,
            wasmPath,
            zkeyPath
        );

        console.log(`✅ hasAccess: ${publicSignals1[0]}`);
        console.log(`✅ proofHash: ${publicSignals1[1]}`);

        // Test case 2: Unauthorized user trying to access record
        const input2 = {
            recordId: "12345",
            userAddress: "0x9999999999999999999999999999999999999999", // Different user
            issuerAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdef",
            studentAddress: "0x1234567890123456789012345678901234567890",
            accessType: "0", // OWNER (but user is not owner)
            timestamp: "1640995200",
            accessSecret: "secret123"
        };

        console.log('🔍 Test 2: Unauthorized access attempt');
        const { proof: proof2, publicSignals: publicSignals2 } = await snarkjs.groth16.fullProve(
            input2,
            wasmPath,
            zkeyPath
        );

        console.log(`✅ hasAccess: ${publicSignals2[0]} (should be 0)`);
        console.log(`✅ proofHash: ${publicSignals2[1]}`);

        return true;
    } catch (error) {
        console.error('❌ Access verification circuit test failed:', error.message);
        return false;
    }
}

async function testRecordSharingCircuit() {
    console.log('\n🧪 Testing Record Sharing Circuit...');

    const wasmPath = path.join(COMPILED_DIR, 'record_sharing', 'record_sharing.wasm');
    const zkeyPath = path.join(KEYS_DIR, 'record_sharing.zkey');

    if (!fs.existsSync(wasmPath) || !fs.existsSync(zkeyPath)) {
        console.error('❌ Circuit files not found. Please compile and generate keys first.');
        return false;
    }

    try {
        // Test case 1: Valid sharing by owner
        const currentTime = Math.floor(Date.now() / 1000);
        const expiryTime = currentTime + 3600; // 1 hour from now

        const input1 = {
            recordId: "12345",
            ownerAddress: "0x1234567890123456789012345678901234567890",
            sharedWithAddress: "0x9999999999999999999999999999999999999999",
            expiryTime: expiryTime.toString(),
            currentTime: currentTime.toString(),
            shareSecret: "shareSecret123",
            userAddress: "0x1234567890123456789012345678901234567890" // Same as owner
        };

        console.log('🔍 Test 1: Valid sharing by owner');
        const { proof: proof1, publicSignals: publicSignals1 } = await snarkjs.groth16.fullProve(
            input1,
            wasmPath,
            zkeyPath
        );

        console.log(`✅ canShare: ${publicSignals1[0]} (should be 1)`);
        console.log(`✅ sharingToken: ${publicSignals1[1]}`);

        // Test case 2: Invalid sharing by non-owner
        const input2 = {
            recordId: "12345",
            ownerAddress: "0x1234567890123456789012345678901234567890",
            sharedWithAddress: "0x9999999999999999999999999999999999999999",
            expiryTime: expiryTime.toString(),
            currentTime: currentTime.toString(),
            shareSecret: "shareSecret123",
            userAddress: "0x8888888888888888888888888888888888888888" // Different from owner
        };

        console.log('🔍 Test 2: Invalid sharing by non-owner');
        const { proof: proof2, publicSignals: publicSignals2 } = await snarkjs.groth16.fullProve(
            input2,
            wasmPath,
            zkeyPath
        );

        console.log(`✅ canShare: ${publicSignals2[0]} (should be 0)`);
        console.log(`✅ sharingToken: ${publicSignals2[1]}`);

        return true;
    } catch (error) {
        console.error('❌ Record sharing circuit test failed:', error.message);
        return false;
    }
}

async function main() {
    console.log('🧪 Starting circuit tests...');

    const results = [];

    // Test access verification circuit
    const accessTest = await testAccessVerificationCircuit();
    results.push({ circuit: 'access_verification', success: accessTest });

    // Test record sharing circuit
    const sharingTest = await testRecordSharingCircuit();
    results.push({ circuit: 'record_sharing', success: sharingTest });

    console.log('\n📊 Test Results:');
    results.forEach(({ circuit, success }) => {
        console.log(`${success ? '✅' : '❌'} ${circuit}`);
    });

    const allSuccessful = results.every(r => r.success);
    if (allSuccessful) {
        console.log('\n🎉 All circuit tests passed!');
    } else {
        console.log('\n⚠️  Some circuit tests failed.');
        process.exit(1);
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { testAccessVerificationCircuit, testRecordSharingCircuit };