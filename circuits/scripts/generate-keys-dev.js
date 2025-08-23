#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const CIRCUITS_DIR = path.join(__dirname, '..');
const COMPILED_DIR = path.join(CIRCUITS_DIR, 'compiled');
const KEYS_DIR = path.join(CIRCUITS_DIR, 'keys');

// Ensure keys directory exists
if (!fs.existsSync(KEYS_DIR)) {
    fs.mkdirSync(KEYS_DIR, { recursive: true });
}

async function generateDevKeys(circuitName) {
    console.log(`\n🔑 Generating development keys for circuit: ${circuitName}`);

    const r1csPath = path.join(COMPILED_DIR, circuitName, `${circuitName}.r1cs`);
    const zkeyPath = path.join(KEYS_DIR, `${circuitName}.zkey`);
    const vkeyPath = path.join(KEYS_DIR, `${circuitName}_verification_key.json`);

    try {
        // Check if R1CS file exists
        if (!fs.existsSync(r1csPath)) {
            throw new Error(`R1CS file not found: ${r1csPath}. Please compile circuits first.`);
        }

        console.log('🔧 Creating development keys (unsafe for production)...');

        // For development, create mock key files
        // In production, you would use proper trusted setup

        // Create a mock zkey file
        const mockZkey = {
            type: "development",
            circuit: circuitName,
            created: new Date().toISOString(),
            warning: "This is a development key - DO NOT USE IN PRODUCTION"
        };

        fs.writeFileSync(zkeyPath, JSON.stringify(mockZkey, null, 2));
        console.log(`✅ Development proving key created: ${zkeyPath}`);

        // Create a mock verification key
        const mockVkey = {
            protocol: "groth16",
            curve: "bn128",
            nPublic: 2,
            vk_alpha_1: ["0", "0", "0"],
            vk_beta_2: [["0", "0"], ["0", "0"], ["0", "0"]],
            vk_gamma_2: [["0", "0"], ["0", "0"], ["0", "0"]],
            vk_delta_2: [["0", "0"], ["0", "0"], ["0", "0"]],
            vk_alphabeta_12: [],
            IC: [["0", "0", "0"], ["0", "0", "0"], ["0", "0", "0"]],
            type: "development",
            circuit: circuitName,
            warning: "This is a development key - DO NOT USE IN PRODUCTION"
        };

        fs.writeFileSync(vkeyPath, JSON.stringify(mockVkey, null, 2));
        console.log(`✅ Development verification key created: ${vkeyPath}`);

        // Generate a mock Solidity verifier contract
        const mockVerifier = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * WARNING: This is a DEVELOPMENT verifier contract
 * DO NOT USE IN PRODUCTION
 * 
 * This contract always returns true for verification
 * It is only for development and testing purposes
 */
contract ${circuitName.charAt(0).toUpperCase() + circuitName.slice(1)}Verifier {
    
    struct VerifyingKey {
        uint256[2] alpha;
        uint256[2][2] beta;
        uint256[2][2] gamma;
        uint256[2][2] delta;
        uint256[][] gamma_abc;
    }
    
    struct Proof {
        uint256[2] a;
        uint256[2] b;
        uint256[2] c;
    }
    
    VerifyingKey verifyingKey;
    
    event ProofVerified(bool result);
    
    constructor() {
        // Mock verifying key - DO NOT USE IN PRODUCTION
        verifyingKey.alpha = [uint256(0), uint256(0)];
        verifyingKey.beta = [[uint256(0), uint256(0)], [uint256(0), uint256(0)]];
        verifyingKey.gamma = [[uint256(0), uint256(0)], [uint256(0), uint256(0)]];
        verifyingKey.delta = [[uint256(0), uint256(0)], [uint256(0), uint256(0)]];
    }
    
    /**
     * WARNING: This function always returns true
     * This is for development purposes only
     */
    function verifyProof(
        uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c,
        uint[2] memory input
    ) public returns (bool) {
        emit ProofVerified(true);
        return true; // Always return true for development
    }
    
    /**
     * View version of verifyProof
     */
    function verifyProofView(
        uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c,
        uint[2] memory input
    ) public view returns (bool) {
        return true; // Always return true for development
    }
}`;

        const verifierPath = path.join(CIRCUITS_DIR, '..', 'blockchain', 'contracts', `${circuitName}_verifier.sol`);

        // Ensure contracts directory exists
        const contractsDir = path.dirname(verifierPath);
        if (!fs.existsSync(contractsDir)) {
            fs.mkdirSync(contractsDir, { recursive: true });
        }

        fs.writeFileSync(verifierPath, mockVerifier);
        console.log(`✅ Development Solidity verifier generated: ${verifierPath}`);

        return true;
    } catch (error) {
        console.error(`❌ Failed to generate development keys for ${circuitName}:`, error.message);
        return false;
    }
}

async function main() {
    console.log('🔑 Starting development key generation...');
    console.log('⚠️  WARNING: These keys are for development only!');
    console.log('⚠️  DO NOT USE IN PRODUCTION!');

    const circuits = ['access_verification', 'record_sharing'];
    const results = [];

    for (const circuit of circuits) {
        const success = await generateDevKeys(circuit);
        results.push({ circuit, success });
    }

    console.log('\n📊 Development Key Generation Results:');
    results.forEach(({ circuit, success }) => {
        console.log(`${success ? '✅' : '❌'} ${circuit}`);
    });

    const allSuccessful = results.every(r => r.success);
    if (allSuccessful) {
        console.log('\n🎉 All development keys generated successfully!');
        console.log('\n⚠️  IMPORTANT REMINDERS:');
        console.log('- These are development keys only');
        console.log('- The verifier contracts always return true');
        console.log('- Generate proper keys with trusted setup for production');
        console.log('\n📝 Next steps:');
        console.log('1. Deploy the generated verifier contracts for testing');
        console.log('2. Update your application to use the new keys');
        console.log('3. Test the circuits with sample inputs');
        console.log('4. Generate production keys before deploying to mainnet');
    } else {
        console.log('\n⚠️  Some development key generation failed.');
        process.exit(1);
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { generateDevKeys };