#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const CIRCUITS_DIR = path.join(__dirname, '..');
const COMPILED_DIR = path.join(CIRCUITS_DIR, 'compiled');
const KEYS_DIR = path.join(CIRCUITS_DIR, 'keys');

async function testAccessVerificationCircuit() {
    console.log('\n🧪 Testing Access Verification Circuit...');

    const wasmPath = path.join(COMPILED_DIR, 'access_verification', 'access_verification.wasm');
    const r1csPath = path.join(COMPILED_DIR, 'access_verification', 'access_verification.r1cs');
    const zkeyPath = path.join(KEYS_DIR, 'access_verification.zkey');
    const vkeyPath = path.join(KEYS_DIR, 'access_verification_verification_key.json');

    try {
        // Check if all required files exist
        const requiredFiles = [wasmPath, r1csPath, zkeyPath, vkeyPath];
        for (const file of requiredFiles) {
            if (!fs.existsSync(file)) {
                throw new Error(`Required file not found: ${file}`);
            }
        }

        // Check file sizes to ensure they're not empty
        const wasmStats = fs.statSync(wasmPath);
        const r1csStats = fs.statSync(r1csPath);

        console.log('📊 Circuit files:');
        console.log(`  - WASM: ${wasmStats.size} bytes`);
        console.log(`  - R1CS: ${r1csStats.size} bytes`);
        console.log(`  - Proving key: ${fs.existsSync(zkeyPath) ? '✅' : '❌'}`);
        console.log(`  - Verification key: ${fs.existsSync(vkeyPath) ? '✅' : '❌'}`);

        if (wasmStats.size === 0 || r1csStats.size === 0) {
            throw new Error('Circuit files are empty');
        }

        console.log('✅ Access verification circuit test passed');
        return true;
    } catch (error) {
        console.error('❌ Access verification circuit test failed:', error.message);
        return false;
    }
}

async function testRecordSharingCircuit() {
    console.log('\n🧪 Testing Record Sharing Circuit...');

    const wasmPath = path.join(COMPILED_DIR, 'record_sharing', 'record_sharing.wasm');
    const r1csPath = path.join(COMPILED_DIR, 'record_sharing', 'record_sharing.r1cs');
    const zkeyPath = path.join(KEYS_DIR, 'record_sharing.zkey');
    const vkeyPath = path.join(KEYS_DIR, 'record_sharing_verification_key.json');

    try {
        // Check if all required files exist
        const requiredFiles = [wasmPath, r1csPath, zkeyPath, vkeyPath];
        for (const file of requiredFiles) {
            if (!fs.existsSync(file)) {
                throw new Error(`Required file not found: ${file}`);
            }
        }

        // Check file sizes to ensure they're not empty
        const wasmStats = fs.statSync(wasmPath);
        const r1csStats = fs.statSync(r1csPath);

        console.log('📊 Circuit files:');
        console.log(`  - WASM: ${wasmStats.size} bytes`);
        console.log(`  - R1CS: ${r1csStats.size} bytes`);
        console.log(`  - Proving key: ${fs.existsSync(zkeyPath) ? '✅' : '❌'}`);
        console.log(`  - Verification key: ${fs.existsSync(vkeyPath) ? '✅' : '❌'}`);

        if (wasmStats.size === 0 || r1csStats.size === 0) {
            throw new Error('Circuit files are empty');
        }

        console.log('✅ Record sharing circuit test passed');
        return true;
    } catch (error) {
        console.error('❌ Record sharing circuit test failed:', error.message);
        return false;
    }
}

async function main() {
    console.log('🧪 Starting circuit tests...');

    // Check if required files exist
    const requiredFiles = [
        path.join(COMPILED_DIR, 'access_verification', 'access_verification.wasm'),
        path.join(COMPILED_DIR, 'record_sharing', 'record_sharing.wasm'),
        path.join(KEYS_DIR, 'access_verification.zkey'),
        path.join(KEYS_DIR, 'record_sharing.zkey')
    ];

    for (const file of requiredFiles) {
        if (!fs.existsSync(file)) {
            console.error(`❌ Required file not found: ${file}`);
            console.error('Please run "npm run compile" and "npm run generate-keys-dev" first');
            process.exit(1);
        }
    }

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

    const allPassed = results.every(r => r.success);
    if (allPassed) {
        console.log('\n🎉 All circuit tests passed!');
        console.log('\n📝 Next steps:');
        console.log('1. Deploy the verifier contracts to your blockchain');
        console.log('2. Integrate the circuits with your application');
        console.log('3. Test end-to-end ZKP functionality');
    } else {
        console.log('\n⚠️  Some circuit tests failed.');
        process.exit(1);
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { testAccessVerificationCircuit, testRecordSharingCircuit };