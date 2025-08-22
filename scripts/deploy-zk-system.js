#!/usr/bin/env node

/**
 * ZK System Deployment Script
 * 
 * This script handles the complete deployment of the ZK system including:
 * - Circuit artifact preparation
 * - Verifier contract deployment
 * - ZK Access Control contract deployment
 * - System initialization and configuration
 * - Integration with existing Academic Records system
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
require('dotenv').config();

class ZKSystemDeployer {
    constructor(options = {}) {
        this.network = options.network || process.env.NEXT_PUBLIC_NETWORK_ID || 'localhost';
        this.rootDir = path.join(__dirname, '..');
        this.blockchainDir = path.join(this.rootDir, 'blockchain');
        this.circuitsDir = process.env.ZK_CIRCUIT_PATH ? path.dirname(process.env.ZK_CIRCUIT_PATH) : path.join(this.rootDir, 'public/circuits');
        this.deploymentFile = path.join(this.blockchainDir, 'zk-deployment-info.json');
        this.verbose = options.verbose || false;

        // ZK configuration from environment
        this.zkConfig = {
            circuitPath: process.env.ZK_CIRCUIT_PATH || './circuits/access-control.circom',
            wasmPath: process.env.ZK_WASM_PATH || './public/circuits/access-control_js/access-control.wasm',
            provingKeyPath: process.env.ZK_PROVING_KEY_PATH || './public/circuits/access-control_0001.zkey',
            verificationKeyPath: process.env.ZK_VERIFICATION_KEY_PATH || './circuits/verification_key.json',
            trustedSetupPath: process.env.ZK_TRUSTED_SETUP_PTAU_PATH || './circuits/pot12_final.ptau'
        };
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = {
            info: '🚀',
            success: '✅',
            error: '❌',
            warning: '⚠️',
            deploy: '📦'
        }[type] || 'ℹ️';

        console.log(`${prefix} [${timestamp}] ${message}`);
    }

    async deploy() {
        try {
            this.log('Starting ZK system deployment...', 'deploy');

            // Pre-deployment checks
            await this.preDeploymentChecks();

            // Prepare circuit artifacts
            await this.prepareArtifacts();

            // Deploy verifier contract
            const verifierAddress = await this.deployVerifier();

            // Deploy ZK Access Control contract
            const zkAccessControlAddress = await this.deployZKAccessControl(verifierAddress);

            // Initialize system
            await this.initializeSystem(zkAccessControlAddress);

            // Integrate with existing system
            await this.integrateWithAcademicRecords(zkAccessControlAddress);

            // Post-deployment verification
            await this.verifyDeployment(verifierAddress, zkAccessControlAddress);

            // Save deployment info
            await this.saveDeploymentInfo(verifierAddress, zkAccessControlAddress);

            this.log('ZK system deployment completed successfully!', 'success');

            return {
                verifier: verifierAddress,
                zkAccessControl: zkAccessControlAddress,
                network: this.network
            };

        } catch (error) {
            this.log(`Deployment failed: ${error.message}`, 'error');
            throw error;
        }
    }

    async preDeploymentChecks() {
        this.log('Running pre-deployment checks...');

        // Check if blockchain directory exists
        if (!fs.existsSync(this.blockchainDir)) {
            throw new Error('Blockchain directory not found');
        }

        // Check if circuit artifacts exist
        const requiredArtifacts = [
            this.zkConfig.provingKeyPath,
            this.zkConfig.verificationKeyPath,
            path.join(this.blockchainDir, 'contracts/verifier.sol')
        ];

        for (const artifact of requiredArtifacts) {
            if (!fs.existsSync(artifact)) {
                throw new Error(`Required artifact not found: ${artifact}`);
            }
        }

        // Check Hardhat configuration
        const hardhatConfig = path.join(this.blockchainDir, 'hardhat.config.ts');
        if (!fs.existsSync(hardhatConfig)) {
            throw new Error('Hardhat configuration not found');
        }

        // Verify network configuration
        try {
            execSync(`cd ${this.blockchainDir} && npx hardhat compile`, {
                stdio: this.verbose ? 'inherit' : 'pipe'
            });
        } catch (error) {
            throw new Error('Contract compilation failed');
        }

        this.log('Pre-deployment checks passed', 'success');
    }

    async prepareArtifacts() {
        this.log('Preparing circuit artifacts for deployment...');

        // Ensure verifier contract is up to date
        const zkeyFile = this.zkConfig.provingKeyPath;
        const verifierFile = path.join(this.blockchainDir, 'contracts/verifier.sol');

        // Regenerate verifier if needed
        const zkeyStats = fs.statSync(zkeyFile);
        const verifierStats = fs.existsSync(verifierFile) ? fs.statSync(verifierFile) : null;

        if (!verifierStats || zkeyStats.mtime > verifierStats.mtime) {
            this.log('Regenerating verifier contract...');
            execSync(`npx snarkjs zkey export solidityverifier "${zkeyFile}" "${verifierFile}"`, {
                stdio: this.verbose ? 'inherit' : 'pipe'
            });
        }

        // Copy circuit artifacts to blockchain directory for easy access
        const artifactsDir = path.join(this.blockchainDir, 'circuit-artifacts');
        if (!fs.existsSync(artifactsDir)) {
            fs.mkdirSync(artifactsDir, { recursive: true });
        }

        const artifactsToCopy = [
            { src: this.zkConfig.provingKeyPath, dest: 'proving-key.zkey' },
            { src: this.zkConfig.verificationKeyPath, dest: 'verification-key.json' }
        ];

        for (const { src, dest } of artifactsToCopy) {
            fs.copyFileSync(src, path.join(artifactsDir, dest));
        }

        this.log('Circuit artifacts prepared', 'success');
    }

    async deployVerifier() {
        this.log('Deploying Groth16 verifier contract...');

        try {
            const result = execSync(
                `cd ${this.blockchainDir} && npx hardhat run scripts/deploy-verifier.ts --network ${this.network}`,
                { encoding: 'utf8', stdio: this.verbose ? 'inherit' : 'pipe' }
            );

            // Extract address from output
            const addressMatch = result.match(/Groth16Verifier deployed to: (0x[a-fA-F0-9]{40})/);
            if (!addressMatch) {
                throw new Error('Could not extract verifier address from deployment output');
            }

            const verifierAddress = addressMatch[1];
            this.log(`Verifier deployed at: ${verifierAddress}`, 'success');

            return verifierAddress;

        } catch (error) {
            throw new Error(`Verifier deployment failed: ${error.message}`);
        }
    }

    async deployZKAccessControl(verifierAddress) {
        this.log('Deploying ZK Access Control contract...');

        // Create deployment script for ZK Access Control
        const deployScript = `
import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Deploying ZK Access Control contract...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // Deploy ZK Access Control contract
  const ZKAccessControl = await ethers.getContractFactory("ZKAccessControl");
  const zkAccessControl = await ZKAccessControl.deploy("${verifierAddress}");
  
  await zkAccessControl.waitForDeployment();
  const zkAccessControlAddress = await zkAccessControl.getAddress();

  console.log("✅ ZK Access Control deployed to:", zkAccessControlAddress);

  // Verify deployment
  const verifierAddr = await zkAccessControl.verifier();
  if (verifierAddr.toLowerCase() !== "${verifierAddress}".toLowerCase()) {
    throw new Error("Verifier address mismatch");
  }

  console.log("✅ Deployment verified");

  return zkAccessControlAddress;
}

main()
  .then((address) => {
    console.log("🎉 ZK Access Control deployment completed!");
    console.log("📍 Address:", address);
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Deployment failed:", error);
    process.exit(1);
  });
`;

        const scriptPath = path.join(this.blockchainDir, 'scripts/deploy-zk-access-control-temp.ts');
        fs.writeFileSync(scriptPath, deployScript);

        try {
            const result = execSync(
                `cd ${this.blockchainDir} && npx hardhat run scripts/deploy-zk-access-control-temp.ts --network ${this.network}`,
                { encoding: 'utf8', stdio: this.verbose ? 'inherit' : 'pipe' }
            );

            // Extract address from output
            const addressMatch = result.match(/ZK Access Control deployed to: (0x[a-fA-F0-9]{40})/);
            if (!addressMatch) {
                throw new Error('Could not extract ZK Access Control address from deployment output');
            }

            const zkAccessControlAddress = addressMatch[1];
            this.log(`ZK Access Control deployed at: ${zkAccessControlAddress}`, 'success');

            return zkAccessControlAddress;

        } catch (error) {
            throw new Error(`ZK Access Control deployment failed: ${error.message}`);
        } finally {
            // Clean up temporary script
            if (fs.existsSync(scriptPath)) {
                fs.unlinkSync(scriptPath);
            }
        }
    }

    async initializeSystem(zkAccessControlAddress) {
        this.log('Initializing ZK system...');

        // Create initialization script
        const initScript = `
import { ethers } from "hardhat";

async function main() {
  console.log("🔧 Initializing ZK system...");

  const [deployer] = await ethers.getSigners();
  
  // Get ZK Access Control contract
  const ZKAccessControl = await ethers.getContractFactory("ZKAccessControl");
  const zkAccessControl = ZKAccessControl.attach("${zkAccessControlAddress}");

  // Initialize any required settings
  console.log("✅ ZK system initialized");
  
  // Test basic functionality
  const verifierAddress = await zkAccessControl.verifier();
  console.log("📍 Verifier address:", verifierAddress);
  
  return true;
}

main()
  .then(() => {
    console.log("🎉 ZK system initialization completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Initialization failed:", error);
    process.exit(1);
  });
`;

        const scriptPath = path.join(this.blockchainDir, 'scripts/init-zk-system-temp.ts');
        fs.writeFileSync(scriptPath, initScript);

        try {
            execSync(
                `cd ${this.blockchainDir} && npx hardhat run scripts/init-zk-system-temp.ts --network ${this.network}`,
                { stdio: this.verbose ? 'inherit' : 'pipe' }
            );

            this.log('ZK system initialized', 'success');

        } catch (error) {
            throw new Error(`ZK system initialization failed: ${error.message}`);
        } finally {
            // Clean up temporary script
            if (fs.existsSync(scriptPath)) {
                fs.unlinkSync(scriptPath);
            }
        }
    }

    async integrateWithAcademicRecords(zkAccessControlAddress) {
        this.log('Integrating with Academic Records system...');

        // Check if Academic Records is deployed
        const deploymentInfoFile = path.join(this.blockchainDir, 'deployment-info.json');
        if (!fs.existsSync(deploymentInfoFile)) {
            this.log('Academic Records not deployed yet - skipping integration', 'warning');
            return;
        }

        const deploymentInfo = JSON.parse(fs.readFileSync(deploymentInfoFile, 'utf8'));
        const academicRecordsAddress = deploymentInfo.contracts?.AcademicRecords;

        if (!academicRecordsAddress) {
            this.log('Academic Records address not found - skipping integration', 'warning');
            return;
        }

        // Create integration script
        const integrationScript = `
import { ethers } from "hardhat";

async function main() {
  console.log("🔗 Integrating ZK system with Academic Records...");

  const [deployer] = await ethers.getSigners();
  
  // Get contracts
  const AcademicRecords = await ethers.getContractFactory("AcademicRecords");
  const academicRecords = AcademicRecords.attach("${academicRecordsAddress}");
  
  const ZKAccessControl = await ethers.getContractFactory("ZKAccessControl");
  const zkAccessControl = ZKAccessControl.attach("${zkAccessControlAddress}");

  // Set ZK Access Control address in Academic Records (if method exists)
  try {
    const tx = await academicRecords.setZKAccessControl("${zkAccessControlAddress}");
    await tx.wait();
    console.log("✅ ZK Access Control address set in Academic Records");
  } catch (error) {
    console.log("⚠️ Could not set ZK Access Control address (method may not exist)");
  }

  console.log("✅ Integration completed");
  
  return true;
}

main()
  .then(() => {
    console.log("🎉 Integration completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Integration failed:", error);
    process.exit(1);
  });
`;

        const scriptPath = path.join(this.blockchainDir, 'scripts/integrate-zk-temp.ts');
        fs.writeFileSync(scriptPath, integrationScript);

        try {
            execSync(
                `cd ${this.blockchainDir} && npx hardhat run scripts/integrate-zk-temp.ts --network ${this.network}`,
                { stdio: this.verbose ? 'inherit' : 'pipe' }
            );

            this.log('Integration with Academic Records completed', 'success');

        } catch (error) {
            this.log(`Integration warning: ${error.message}`, 'warning');
        } finally {
            // Clean up temporary script
            if (fs.existsSync(scriptPath)) {
                fs.unlinkSync(scriptPath);
            }
        }
    }

    async verifyDeployment(verifierAddress, zkAccessControlAddress) {
        this.log('Verifying deployment...');

        // Create verification script
        const verifyScript = `
import { ethers } from "hardhat";

async function main() {
  console.log("🔍 Verifying ZK system deployment...");

  // Verify verifier contract
  const verifierCode = await ethers.provider.getCode("${verifierAddress}");
  if (verifierCode === "0x") {
    throw new Error("Verifier contract not deployed");
  }
  console.log("✅ Verifier contract verified");

  // Verify ZK Access Control contract
  const zkCode = await ethers.provider.getCode("${zkAccessControlAddress}");
  if (zkCode === "0x") {
    throw new Error("ZK Access Control contract not deployed");
  }
  console.log("✅ ZK Access Control contract verified");

  // Test contract interaction
  const ZKAccessControl = await ethers.getContractFactory("ZKAccessControl");
  const zkAccessControl = ZKAccessControl.attach("${zkAccessControlAddress}");
  
  const verifierAddr = await zkAccessControl.verifier();
  if (verifierAddr.toLowerCase() !== "${verifierAddress}".toLowerCase()) {
    throw new Error("Verifier address mismatch in ZK Access Control");
  }
  console.log("✅ Contract integration verified");

  console.log("✅ All verifications passed");
  return true;
}

main()
  .then(() => {
    console.log("🎉 Deployment verification completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Verification failed:", error);
    process.exit(1);
  });
`;

        const scriptPath = path.join(this.blockchainDir, 'scripts/verify-zk-deployment-temp.ts');
        fs.writeFileSync(scriptPath, verifyScript);

        try {
            execSync(
                `cd ${this.blockchainDir} && npx hardhat run scripts/verify-zk-deployment-temp.ts --network ${this.network}`,
                { stdio: this.verbose ? 'inherit' : 'pipe' }
            );

            this.log('Deployment verification passed', 'success');

        } catch (error) {
            throw new Error(`Deployment verification failed: ${error.message}`);
        } finally {
            // Clean up temporary script
            if (fs.existsSync(scriptPath)) {
                fs.unlinkSync(scriptPath);
            }
        }
    }

    async saveDeploymentInfo(verifierAddress, zkAccessControlAddress) {
        this.log('Saving deployment information...');

        const deploymentInfo = {
            network: this.network,
            timestamp: new Date().toISOString(),
            contracts: {
                Groth16Verifier: verifierAddress,
                ZKAccessControl: zkAccessControlAddress
            },
            artifacts: {
                provingKey: 'circuit-artifacts/proving-key.zkey',
                verificationKey: 'circuit-artifacts/verification-key.json',
                verifierContract: 'contracts/verifier.sol'
            },
            circuitInfo: {
                name: 'access-control',
                version: this.getCircuitVersion()
            }
        };

        // Merge with existing deployment info if it exists
        let existingInfo = {};
        if (fs.existsSync(this.deploymentFile)) {
            try {
                existingInfo = JSON.parse(fs.readFileSync(this.deploymentFile, 'utf8'));
            } catch (error) {
                this.log('Could not read existing deployment info', 'warning');
            }
        }

        const mergedInfo = { ...existingInfo, zk: deploymentInfo };
        fs.writeFileSync(this.deploymentFile, JSON.stringify(mergedInfo, null, 2));

        // Also update main deployment info
        const mainDeploymentFile = path.join(this.blockchainDir, 'deployment-info.json');
        if (fs.existsSync(mainDeploymentFile)) {
            try {
                const mainInfo = JSON.parse(fs.readFileSync(mainDeploymentFile, 'utf8'));
                mainInfo.zk = deploymentInfo;
                fs.writeFileSync(mainDeploymentFile, JSON.stringify(mainInfo, null, 2));
            } catch (error) {
                this.log('Could not update main deployment info', 'warning');
            }
        }

        this.log(`Deployment info saved to ${this.deploymentFile}`, 'success');
    }

    getCircuitVersion() {
        try {
            const manifestFile = path.join(this.circuitsDir, 'circuit-manifest.json');
            if (fs.existsSync(manifestFile)) {
                const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
                return manifest.currentVersion;
            }
        } catch (error) {
            // Ignore error
        }

        return '1.0.0';
    }
}

// CLI interface
if (require.main === module) {
    const args = process.argv.slice(2);
    const options = {};

    // Parse command line arguments
    for (let i = 0; i < args.length; i += 2) {
        const key = args[i].replace('--', '');
        const value = args[i + 1];

        switch (key) {
            case 'network':
                options.network = value;
                break;
            case 'verbose':
                options.verbose = true;
                i--; // No value for this flag
                break;
        }
    }

    const deployer = new ZKSystemDeployer(options);
    deployer.deploy().catch(error => {
        console.error('Deployment failed:', error);
        process.exit(1);
    });
}

module.exports = ZKSystemDeployer;