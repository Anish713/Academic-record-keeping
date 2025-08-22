#!/usr/bin/env node

/**
 * ZK Pipeline Testing Script
 * 
 * This script tests the complete ZK circuit build and deployment pipeline:
 * - Circuit compilation and validation
 * - Trusted setup ceremony
 * - Artifact management and versioning
 * - Contract deployment and integration
 * - End-to-end functionality testing
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class ZKPipelineTester {
    constructor(options = {}) {
        this.rootDir = path.join(__dirname, '..');
        this.testDir = path.join(this.rootDir, 'test-zk-pipeline');
        this.verbose = options.verbose || false;
        this.cleanup = options.cleanup !== false;
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = {
            info: '🧪',
            success: '✅',
            error: '❌',
            warning: '⚠️',
            test: '🔬'
        }[type] || 'ℹ️';

        console.log(`${prefix} [${timestamp}] ${message}`);
    }

    async runTests() {
        try {
            this.log('Starting ZK pipeline tests...', 'test');

            // Setup test environment
            await this.setupTestEnvironment();

            // Test circuit compilation
            await this.testCircuitCompilation();

            // Test trusted setup
            await this.testTrustedSetup();

            // Test artifact management
            await this.testArtifactManagement();

            // Test contract deployment
            await this.testContractDeployment();

            // Test end-to-end functionality
            await this.testEndToEndFunctionality();

            // Cleanup
            if (this.cleanup) {
                await this.cleanupTestEnvironment();
            }

            this.log('All ZK pipeline tests passed!', 'success');

        } catch (error) {
            this.log(`Pipeline test failed: ${error.message}`, 'error');
            throw error;
        }
    }

    async setupTestEnvironment() {
        this.log('Setting up test environment...');

        // Create test directory
        if (fs.existsSync(this.testDir)) {
            fs.rmSync(this.testDir, { recursive: true, force: true });
        }
        fs.mkdirSync(this.testDir, { recursive: true });

        // Check prerequisites
        const commands = ['node', 'npm', 'circom', 'npx'];
        for (const cmd of commands) {
            try {
                execSync(`which ${cmd}`, { stdio: 'ignore' });
                this.log(`✓ ${cmd} is available`);
            } catch (error) {
                throw new Error(`${cmd} is not installed or not in PATH`);
            }
        }

        this.log('Test environment setup complete', 'success');
    }

    async testCircuitCompilation() {
        this.log('Testing circuit compilation...', 'test');

        try {
            // Run circuit build script
            execSync('node scripts/build-circuits.js', {
                cwd: this.rootDir,
                stdio: this.verbose ? 'inherit' : 'pipe'
            });

            // Verify outputs
            const requiredFiles = [
                'public/circuits/access-control.r1cs',
                'public/circuits/access-control_js/access-control.wasm',
                'public/circuits/access-control.sym'
            ];

            for (const file of requiredFiles) {
                const filePath = path.join(this.rootDir, file);
                if (!fs.existsSync(filePath)) {
                    throw new Error(`Expected compilation output not found: ${file}`);
                }

                const stats = fs.statSync(filePath);
                if (stats.size === 0) {
                    throw new Error(`Compilation output is empty: ${file}`);
                }
            }

            this.log('Circuit compilation test passed', 'success');

        } catch (error) {
            throw new Error(`Circuit compilation test failed: ${error.message}`);
        }
    }

    async testTrustedSetup() {
        this.log('Testing trusted setup ceremony...', 'test');

        try {
            // Run quick trusted setup
            execSync('node scripts/trusted-setup.js --quick', {
                cwd: this.rootDir,
                stdio: this.verbose ? 'inherit' : 'pipe'
            });

            // Verify setup outputs
            const requiredFiles = [
                'public/circuits/access-control_0001.zkey',
                'public/circuits/verification_key.json',
                'public/circuits/ceremony-info.json',
                'blockchain/contracts/verifier.sol'
            ];

            for (const file of requiredFiles) {
                const filePath = path.join(this.rootDir, file);
                if (!fs.existsSync(filePath)) {
                    throw new Error(`Expected setup output not found: ${file}`);
                }
            }

            // Verify ceremony info
            const ceremonyInfoPath = path.join(this.rootDir, 'public/circuits/ceremony-info.json');
            const ceremonyInfo = JSON.parse(fs.readFileSync(ceremonyInfoPath, 'utf8'));

            if (!ceremonyInfo.phase1Completed || !ceremonyInfo.phase2Completed || !ceremonyInfo.verified) {
                throw new Error('Ceremony not completed properly');
            }

            this.log('Trusted setup test passed', 'success');

        } catch (error) {
            throw new Error(`Trusted setup test failed: ${error.message}`);
        }
    }

    async testArtifactManagement() {
        this.log('Testing artifact management...', 'test');

        try {
            // Test versioning
            execSync('node scripts/circuit-manager.js version access-control', {
                cwd: this.rootDir,
                stdio: this.verbose ? 'inherit' : 'pipe'
            });

            // Test verification
            execSync('node scripts/circuit-manager.js verify', {
                cwd: this.rootDir,
                stdio: this.verbose ? 'inherit' : 'pipe'
            });

            // Test listing
            const listOutput = execSync('node scripts/circuit-manager.js list', {
                cwd: this.rootDir,
                encoding: 'utf8'
            });

            if (!listOutput.includes('Available circuit versions')) {
                throw new Error('Version listing failed');
            }

            // Verify manifest file
            const manifestPath = path.join(this.rootDir, 'public/circuits/circuit-manifest.json');
            if (!fs.existsSync(manifestPath)) {
                throw new Error('Circuit manifest not created');
            }

            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            if (!manifest.versions || Object.keys(manifest.versions).length === 0) {
                throw new Error('No versions in manifest');
            }

            this.log('Artifact management test passed', 'success');

        } catch (error) {
            throw new Error(`Artifact management test failed: ${error.message}`);
        }
    }

    async testContractDeployment() {
        this.log('Testing contract deployment...', 'test');

        try {
            // Start local Hardhat network in background
            this.log('Starting local Hardhat network...');
            const hardhatProcess = execSync('cd blockchain && npx hardhat node --port 8545 > /dev/null 2>&1 &', {
                cwd: this.rootDir,
                stdio: 'ignore'
            });

            // Wait for network to start
            await new Promise(resolve => setTimeout(resolve, 5000));

            // Test ZK system deployment
            execSync('node scripts/deploy-zk-system.js --network localhost', {
                cwd: this.rootDir,
                stdio: this.verbose ? 'inherit' : 'pipe'
            });

            // Verify deployment info
            const deploymentInfoPath = path.join(this.rootDir, 'blockchain/zk-deployment-info.json');
            if (!fs.existsSync(deploymentInfoPath)) {
                throw new Error('ZK deployment info not created');
            }

            const deploymentInfo = JSON.parse(fs.readFileSync(deploymentInfoPath, 'utf8'));
            if (!deploymentInfo.zk || !deploymentInfo.zk.contracts) {
                throw new Error('Invalid deployment info structure');
            }

            const { Groth16Verifier, ZKAccessControl } = deploymentInfo.zk.contracts;
            if (!Groth16Verifier || !ZKAccessControl) {
                throw new Error('Contract addresses not found in deployment info');
            }

            this.log('Contract deployment test passed', 'success');

        } catch (error) {
            throw new Error(`Contract deployment test failed: ${error.message}`);
        } finally {
            // Stop Hardhat network
            try {
                execSync('pkill -f "hardhat node"', { stdio: 'ignore' });
            } catch (error) {
                // Ignore error if process not found
            }
        }
    }

    async testEndToEndFunctionality() {
        this.log('Testing end-to-end functionality...', 'test');

        try {
            // Test proof generation and verification
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

            const inputFile = path.join(this.testDir, 'test-input.json');
            fs.writeFileSync(inputFile, JSON.stringify(testInput, null, 2));

            const circuitDir = path.join(this.rootDir, 'public/circuits/access-control_js');
            const witnessFile = path.join(this.testDir, 'witness.wtns');
            const proofFile = path.join(this.testDir, 'proof.json');
            const publicFile = path.join(this.testDir, 'public.json');

            // Generate witness
            execSync(`node generate_witness.js access-control.wasm "${inputFile}" "${witnessFile}"`, {
                cwd: circuitDir,
                stdio: this.verbose ? 'inherit' : 'pipe'
            });

            // Generate proof
            const zkeyFile = path.join(this.rootDir, 'public/circuits/access-control_0001.zkey');
            execSync(`npx snarkjs groth16 prove "${zkeyFile}" "${witnessFile}" "${proofFile}" "${publicFile}"`, {
                stdio: this.verbose ? 'inherit' : 'pipe'
            });

            // Verify proof
            const vkeyFile = path.join(this.rootDir, 'public/circuits/verification_key.json');
            execSync(`npx snarkjs groth16 verify "${vkeyFile}" "${publicFile}" "${proofFile}"`, {
                stdio: this.verbose ? 'inherit' : 'pipe'
            });

            // Verify proof files exist and are valid
            const proofData = JSON.parse(fs.readFileSync(proofFile, 'utf8'));
            const publicData = JSON.parse(fs.readFileSync(publicFile, 'utf8'));

            if (!proofData.pi_a || !proofData.pi_b || !proofData.pi_c) {
                throw new Error('Invalid proof structure');
            }

            if (!Array.isArray(publicData) || publicData.length === 0) {
                throw new Error('Invalid public signals');
            }

            this.log('End-to-end functionality test passed', 'success');

        } catch (error) {
            throw new Error(`End-to-end functionality test failed: ${error.message}`);
        }
    }

    async cleanupTestEnvironment() {
        this.log('Cleaning up test environment...');

        // Remove test directory
        if (fs.existsSync(this.testDir)) {
            fs.rmSync(this.testDir, { recursive: true, force: true });
        }

        // Stop any remaining processes
        try {
            execSync('pkill -f "hardhat node"', { stdio: 'ignore' });
        } catch (error) {
            // Ignore error if process not found
        }

        this.log('Test environment cleanup complete', 'success');
    }
}

// CLI interface
if (require.main === module) {
    const args = process.argv.slice(2);
    const options = {};

    // Parse command line arguments
    args.forEach(arg => {
        switch (arg) {
            case '--verbose':
                options.verbose = true;
                break;
            case '--no-cleanup':
                options.cleanup = false;
                break;
        }
    });

    const tester = new ZKPipelineTester(options);
    tester.runTests().catch(error => {
        console.error('Pipeline tests failed:', error);
        process.exit(1);
    });
}

module.exports = ZKPipelineTester;