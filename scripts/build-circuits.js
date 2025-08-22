#!/usr/bin/env node

/**
 * Automated ZK Circuit Build Script
 * 
 * This script handles the complete ZK circuit build pipeline:
 * - Circuit compilation
 * - Trusted setup ceremony simulation
 * - Artifact management and versioning
 * - Validation and testing
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

class CircuitBuilder {
    constructor() {
        this.circuitsDir = path.join(__dirname, '../circuits');
        this.outputDir = path.join(__dirname, '../public/circuits');
        this.blockchainDir = path.join(__dirname, '../blockchain');
        this.artifactsFile = path.join(this.outputDir, 'circuit-artifacts.json');
        this.version = this.getVersion();
    }

    getVersion() {
        try {
            const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
            return packageJson.version;
        } catch (error) {
            return '1.0.0';
        }
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = {
            info: '🔧',
            success: '✅',
            error: '❌',
            warning: '⚠️'
        }[type] || 'ℹ️';

        console.log(`${prefix} [${timestamp}] ${message}`);
    }

    async build() {
        try {
            this.log('Starting ZK circuit build pipeline...');

            // Create output directories
            this.ensureDirectories();

            // Check prerequisites
            await this.checkPrerequisites();

            // Compile circuits
            await this.compileCircuits();

            // Run trusted setup
            await this.runTrustedSetup();

            // Generate verifier contract
            await this.generateVerifier();

            // Validate build
            await this.validateBuild();

            // Update artifacts
            await this.updateArtifacts();

            this.log('ZK circuit build pipeline completed successfully!', 'success');

        } catch (error) {
            this.log(`Build failed: ${error.message}`, 'error');
            process.exit(1);
        }
    }

    ensureDirectories() {
        const dirs = [
            this.outputDir,
            path.join(this.outputDir, 'access-control_js'),
            path.join(this.circuitsDir, 'build'),
            path.join(this.blockchainDir, 'contracts')
        ];

        dirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                this.log(`Created directory: ${dir}`);
            }
        });
    }

    async checkPrerequisites() {
        this.log('Checking prerequisites...');

        const commands = ['circom', 'snarkjs'];
        for (const cmd of commands) {
            try {
                execSync(`which ${cmd}`, { stdio: 'ignore' });
                this.log(`✓ ${cmd} is available`);
            } catch (error) {
                throw new Error(`${cmd} is not installed or not in PATH`);
            }
        }

        // Check if circuit file exists
        const circuitFile = path.join(this.circuitsDir, 'access-control.circom');
        if (!fs.existsSync(circuitFile)) {
            throw new Error(`Circuit file not found: ${circuitFile}`);
        }

        this.log('Prerequisites check passed', 'success');
    }

    async compileCircuits() {
        this.log('Compiling ZK circuits...');

        const circuitFile = path.join(this.circuitsDir, 'access-control.circom');
        const outputPath = this.outputDir;

        try {
            // Compile circuit
            const compileCmd = `circom "${circuitFile}" --r1cs --wasm --sym --c -o "${outputPath}" -l "${path.join(__dirname, '../node_modules')}"`;
            execSync(compileCmd, {
                stdio: 'inherit',
                cwd: this.circuitsDir
            });

            // Verify compilation outputs
            const requiredFiles = [
                path.join(outputPath, 'access-control.r1cs'),
                path.join(outputPath, 'access-control_js', 'access-control.wasm'),
                path.join(outputPath, 'access-control.sym')
            ];

            for (const file of requiredFiles) {
                if (!fs.existsSync(file)) {
                    throw new Error(`Expected compilation output not found: ${file}`);
                }
            }

            this.log('Circuit compilation completed', 'success');

        } catch (error) {
            throw new Error(`Circuit compilation failed: ${error.message}`);
        }
    }

    async runTrustedSetup() {
        this.log('Running trusted setup ceremony...');

        const ptauFile = path.join(this.circuitsDir, 'pot14_final.ptau');
        const r1csFile = path.join(this.outputDir, 'access-control.r1cs');
        const zkeyFile0 = path.join(this.outputDir, 'access-control_0000.zkey');
        const zkeyFile1 = path.join(this.outputDir, 'access-control_0001.zkey');
        const vkeyFile = path.join(this.outputDir, 'verification_key.json');

        try {
            // Check if ptau file exists, generate if not
            if (!fs.existsSync(ptauFile)) {
                this.log('Generating Powers of Tau file...');
                await this.generatePowerOfTau();
            }

            // Phase 2 setup
            this.log('Running Phase 2 setup...');
            execSync(`snarkjs groth16 setup "${r1csFile}" "${ptauFile}" "${zkeyFile0}"`, {
                stdio: 'inherit'
            });

            // Apply random beacon (development only)
            this.log('Applying random beacon...');
            const beacon = crypto.randomBytes(32).toString('hex');
            execSync(`snarkjs zkey beacon "${zkeyFile0}" "${zkeyFile1}" ${beacon} 10 -n="Development Beacon"`, {
                stdio: 'inherit'
            });

            // Export verification key
            this.log('Exporting verification key...');
            execSync(`snarkjs zkey export verificationkey "${zkeyFile1}" "${vkeyFile}"`, {
                stdio: 'inherit'
            });

            // Verify the final zkey
            this.log('Verifying final zkey...');
            execSync(`snarkjs zkey verify "${r1csFile}" "${ptauFile}" "${zkeyFile1}"`, {
                stdio: 'inherit'
            });

            this.log('Trusted setup completed', 'success');

        } catch (error) {
            throw new Error(`Trusted setup failed: ${error.message}`);
        }
    }

    async generatePowerOfTau() {
        const ptauDir = this.circuitsDir;
        const ptau0 = path.join(ptauDir, 'pot14_0000.ptau');
        const ptau1 = path.join(ptauDir, 'pot14_0001.ptau');
        const ptauFinal = path.join(ptauDir, 'pot14_final.ptau');

        this.log('Generating Powers of Tau ceremony (this may take several minutes)...');

        // New ceremony
        execSync(`snarkjs powersoftau new bn128 14 "${ptau0}" -v`, {
            stdio: 'inherit'
        });

        // Contribute
        execSync(`snarkjs powersoftau contribute "${ptau0}" "${ptau1}" --name="Development Contribution" -v`, {
            stdio: 'inherit'
        });

        // Prepare phase 2
        execSync(`snarkjs powersoftau prepare phase2 "${ptau1}" "${ptauFinal}" -v`, {
            stdio: 'inherit'
        });

        // Clean up intermediate files
        fs.unlinkSync(ptau0);
        fs.unlinkSync(ptau1);
    }

    async generateVerifier() {
        this.log('Generating Solidity verifier contract...');

        const zkeyFile = path.join(this.outputDir, 'access-control_0001.zkey');
        const verifierFile = path.join(this.blockchainDir, 'contracts', 'verifier.sol');

        try {
            execSync(`snarkjs zkey export solidityverifier "${zkeyFile}" "${verifierFile}"`, {
                stdio: 'inherit'
            });

            // Verify verifier file was created
            if (!fs.existsSync(verifierFile)) {
                throw new Error('Verifier contract was not generated');
            }

            this.log('Solidity verifier generated', 'success');

        } catch (error) {
            throw new Error(`Verifier generation failed: ${error.message}`);
        }
    }

    async validateBuild() {
        this.log('Validating build outputs...');

        const requiredFiles = [
            path.join(this.outputDir, 'access-control.r1cs'),
            path.join(this.outputDir, 'access-control_js', 'access-control.wasm'),
            path.join(this.outputDir, 'access-control_0001.zkey'),
            path.join(this.outputDir, 'verification_key.json'),
            path.join(this.blockchainDir, 'contracts', 'verifier.sol')
        ];

        for (const file of requiredFiles) {
            if (!fs.existsSync(file)) {
                throw new Error(`Required build output missing: ${file}`);
            }

            const stats = fs.statSync(file);
            if (stats.size === 0) {
                throw new Error(`Build output is empty: ${file}`);
            }
        }

        // Test circuit with sample input
        await this.testCircuit();

        this.log('Build validation passed', 'success');
    }

    async testCircuit() {
        this.log('Testing circuit with sample input...');

        const testInput = {
            userAddress: "123456789",
            recordId: "1",
            accessKey: "987654321",
            timestamp: "1640995200",
            pathElements: Array(10).fill("0"),
            pathIndices: Array(10).fill("0"),
            recordHash: "456789123",
            merkleRoot: "111111111"
        };

        const inputFile = path.join(this.outputDir, 'test-input.json');
        const witnessFile = path.join(this.outputDir, 'access-control_js', 'witness.wtns');
        const proofFile = path.join(this.outputDir, 'access-control_js', 'proof.json');
        const publicFile = path.join(this.outputDir, 'access-control_js', 'public.json');

        try {
            // Write test input
            fs.writeFileSync(inputFile, JSON.stringify(testInput, null, 2));

            // Generate witness
            const wasmFile = path.join(this.outputDir, 'access-control_js', 'access-control.wasm');
            execSync(`node generate_witness.js "${wasmFile}" "${inputFile}" "${witnessFile}"`, {
                cwd: path.join(this.outputDir, 'access-control_js'),
                stdio: 'inherit'
            });

            // Generate proof
            const zkeyFile = path.join(this.outputDir, 'access-control_0001.zkey');
            execSync(`snarkjs groth16 prove "${zkeyFile}" "${witnessFile}" "${proofFile}" "${publicFile}"`, {
                stdio: 'inherit'
            });

            // Verify proof
            const vkeyFile = path.join(this.outputDir, 'verification_key.json');
            execSync(`snarkjs groth16 verify "${vkeyFile}" "${publicFile}" "${proofFile}"`, {
                stdio: 'inherit'
            });

            // Clean up test files
            [inputFile, witnessFile, proofFile, publicFile].forEach(file => {
                if (fs.existsSync(file)) {
                    fs.unlinkSync(file);
                }
            });

            this.log('Circuit test passed', 'success');

        } catch (error) {
            throw new Error(`Circuit test failed: ${error.message}`);
        }
    }

    async updateArtifacts() {
        this.log('Updating circuit artifacts metadata...');

        const artifacts = {
            version: this.version,
            buildTimestamp: new Date().toISOString(),
            circuitName: 'access-control',
            files: {
                r1cs: 'access-control.r1cs',
                wasm: 'access-control_js/access-control.wasm',
                zkey: 'access-control_0001.zkey',
                vkey: 'verification_key.json',
                verifier: '../blockchain/contracts/verifier.sol'
            },
            checksums: {}
        };

        // Calculate checksums for verification
        for (const [key, relativePath] of Object.entries(artifacts.files)) {
            if (key === 'verifier') continue; // Skip verifier as it's in different directory

            const filePath = path.join(this.outputDir, relativePath);
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath);
                artifacts.checksums[key] = crypto.createHash('sha256').update(content).digest('hex');
            }
        }

        fs.writeFileSync(this.artifactsFile, JSON.stringify(artifacts, null, 2));
        this.log('Circuit artifacts updated', 'success');
    }
}

// Run if called directly
if (require.main === module) {
    const builder = new CircuitBuilder();
    builder.build().catch(error => {
        console.error('Build failed:', error);
        process.exit(1);
    });
}

module.exports = CircuitBuilder;