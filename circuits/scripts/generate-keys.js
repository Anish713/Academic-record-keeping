#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const snarkjs = require('snarkjs');

const CIRCUITS_DIR = path.join(__dirname, '..');
const COMPILED_DIR = path.join(CIRCUITS_DIR, 'compiled');
const KEYS_DIR = path.join(CIRCUITS_DIR, 'keys');

// Ensure keys directory exists
if (!fs.existsSync(KEYS_DIR)) {
    fs.mkdirSync(KEYS_DIR, { recursive: true });
}

async function generateKeys(circuitName) {
    console.log(`\n🔑 Generating keys for circuit: ${circuitName}`);

    const r1csPath = path.join(COMPILED_DIR, circuitName, `${circuitName}.r1cs`);
    const ptauPath = path.join(KEYS_DIR, 'powersOfTau28_hez_final_10.ptau');
    const zkeyPath = path.join(KEYS_DIR, `${circuitName}.zkey`);
    const vkeyPath = path.join(KEYS_DIR, `${circuitName}_verification_key.json`);

    try {
        // Check if R1CS file exists
        if (!fs.existsSync(r1csPath)) {
            throw new Error(`R1CS file not found: ${r1csPath}. Please compile circuits first.`);
        }

        // Download powers of tau file if it doesn't exist
        if (!fs.existsSync(ptauPath)) {
            console.log('📥 Downloading powers of tau file...');
            const https = require('https');
            const file = fs.createWriteStream(ptauPath);

            await new Promise((resolve, reject) => {
                https.get('https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_10.ptau', (response) => {
                    response.pipe(file);
                    file.on('finish', () => {
                        file.close();
                        console.log('✅ Powers of tau file downloaded');
                        resolve();
                    });
                }).on('error', reject);
            });
        }

        console.log('🔧 Generating proving key...');

        // Generate proving key (zkey)
        await snarkjs.zKey.newZKey(r1csPath, ptauPath, zkeyPath);
        console.log(`✅ Proving key generated: ${zkeyPath}`);

        // Export verification key
        const vKey = await snarkjs.zKey.exportVerificationKey(zkeyPath);
        fs.writeFileSync(vkeyPath, JSON.stringify(vKey, null, 2));
        console.log(`✅ Verification key exported: ${vkeyPath}`);

        // Generate Solidity verifier contract
        const solidityVerifier = await snarkjs.zKey.exportSolidityVerifier(zkeyPath);
        const verifierPath = path.join(CIRCUITS_DIR, '..', 'blockchain', 'contracts', `${circuitName}_verifier.sol`);

        // Ensure contracts directory exists
        const contractsDir = path.dirname(verifierPath);
        if (!fs.existsSync(contractsDir)) {
            fs.mkdirSync(contractsDir, { recursive: true });
        }

        fs.writeFileSync(verifierPath, solidityVerifier);
        console.log(`✅ Solidity verifier generated: ${verifierPath}`);

        return true;
    } catch (error) {
        console.error(`❌ Failed to generate keys for ${circuitName}:`, error.message);
        return false;
    }
}

async function main() {
    console.log('🔑 Starting key generation...');

    const circuits = ['access_verification', 'record_sharing'];
    const results = [];

    for (const circuit of circuits) {
        const success = await generateKeys(circuit);
        results.push({ circuit, success });
    }

    console.log('\n📊 Key Generation Results:');
    results.forEach(({ circuit, success }) => {
        console.log(`${success ? '✅' : '❌'} ${circuit}`);
    });

    const allSuccessful = results.every(r => r.success);
    if (allSuccessful) {
        console.log('\n🎉 All keys generated successfully!');
        console.log('\n📝 Next steps:');
        console.log('1. Deploy the generated verifier contracts');
        console.log('2. Update your application to use the new keys');
        console.log('3. Test the circuits with sample inputs');
    } else {
        console.log('\n⚠️  Some key generation failed.');
        process.exit(1);
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { generateKeys };