#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

const CIRCUITS_DIR = path.join(__dirname, '..');
const SRC_DIR = path.join(CIRCUITS_DIR, 'src');
const COMPILED_DIR = path.join(CIRCUITS_DIR, 'compiled');

// Ensure compiled directory exists
if (!fs.existsSync(COMPILED_DIR)) {
    fs.mkdirSync(COMPILED_DIR, { recursive: true });
}

async function compileCircuit(circuitName) {
    console.log(`Compiling circuit: ${circuitName}`);

    const inputPath = path.join(SRC_DIR, `${circuitName}.circom`);
    const outputDir = path.join(COMPILED_DIR, circuitName);

    // Create output directory
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    try {
        // Compile circuit to R1CS and WASM
        const compileCmd = `circom ${inputPath} --r1cs --wasm --sym --c -o ${outputDir}`;
        console.log(`Running: ${compileCmd}`);

        const { stdout, stderr } = await execAsync(compileCmd);

        if (stderr) {
            console.warn(`Warning for ${circuitName}:`, stderr);
        }

        console.log(`✅ Successfully compiled ${circuitName}`);
        console.log(stdout);

        // Move WASM file to expected location
        const wasmSrcPath = path.join(outputDir, `${circuitName}_js`, `${circuitName}.wasm`);
        const wasmDestPath = path.join(outputDir, `${circuitName}.wasm`);

        if (fs.existsSync(wasmSrcPath)) {
            fs.copyFileSync(wasmSrcPath, wasmDestPath);
            console.log(`✅ WASM file copied to ${wasmDestPath}`);
        }

        return true;
    } catch (error) {
        console.error(`❌ Failed to compile ${circuitName}:`, error.message);
        return false;
    }
}

async function main() {
    console.log('🔧 Starting circuit compilation...');

    // Check if circom is installed
    try {
        await execAsync('circom --version');
    } catch (error) {
        console.error('❌ circom is not installed. Please install it first:');
        console.error('npm install -g circom');
        process.exit(1);
    }

    const circuits = ['access_verification', 'record_sharing'];
    const results = [];

    for (const circuit of circuits) {
        const success = await compileCircuit(circuit);
        results.push({ circuit, success });
    }

    console.log('\n📊 Compilation Results:');
    results.forEach(({ circuit, success }) => {
        console.log(`${success ? '✅' : '❌'} ${circuit}`);
    });

    const allSuccessful = results.every(r => r.success);
    if (allSuccessful) {
        console.log('\n🎉 All circuits compiled successfully!');
    } else {
        console.log('\n⚠️  Some circuits failed to compile.');
        process.exit(1);
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { compileCircuit };