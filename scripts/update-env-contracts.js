#!/usr/bin/env node

/**
 * Environment Contract Address Updater
 * 
 * This script updates environment variables with deployed contract addresses
 * based on the current network and deployment information.
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

class EnvContractUpdater {
    constructor() {
        this.rootDir = path.join(__dirname, '..');
        this.envFile = path.join(this.rootDir, '.env');
        this.envExampleFile = path.join(this.rootDir, '.env.example');
        this.deploymentFile = path.join(this.rootDir, 'blockchain/deployment-info.json');
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

    async updateContractAddresses(network = null) {
        try {
            this.log('Updating contract addresses in environment...');

            // Determine network
            const targetNetwork = network || process.env.DEPLOYMENT_NETWORK || 'localhost';
            this.log(`Target network: ${targetNetwork}`);

            // Read deployment info
            const deploymentInfo = this.readDeploymentInfo();
            if (!deploymentInfo) {
                throw new Error('No deployment information found');
            }

            // Extract contract addresses
            const addresses = this.extractAddresses(deploymentInfo, targetNetwork);

            // Update environment file
            await this.updateEnvFile(addresses, targetNetwork);

            this.log('Contract addresses updated successfully!', 'success');

        } catch (error) {
            this.log(`Failed to update contract addresses: ${error.message}`, 'error');
            throw error;
        }
    }

    readDeploymentInfo() {
        if (!fs.existsSync(this.deploymentFile)) {
            this.log('Deployment info file not found', 'warning');
            return null;
        }

        try {
            const content = fs.readFileSync(this.deploymentFile, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            this.log(`Failed to read deployment info: ${error.message}`, 'error');
            return null;
        }
    }

    extractAddresses(deploymentInfo, network) {
        const addresses = {};

        // Extract main contract addresses
        if (deploymentInfo.contracts) {
            addresses.NEXT_PUBLIC_CONTRACT_ADDRESS = deploymentInfo.contracts.AcademicRecords;
            addresses.NEXT_PUBLIC_STUDENT_MANAGEMENT_CONTRACT_ADDRESS = deploymentInfo.contracts.StudentManagement;
            addresses.ACADEMIC_RECORDS_CONTRACT_ADDRESS = deploymentInfo.contracts.AcademicRecords;
        }

        // Extract ZK contract addresses
        if (deploymentInfo.zkAccessControl) {
            addresses.NEXT_PUBLIC_ZK_ACCESS_CONTROL_CONTRACT_ADDRESS = deploymentInfo.zkAccessControl;
            addresses.ZK_CONTRACT_ADDRESS = deploymentInfo.zkAccessControl;
        }

        if (deploymentInfo.verifier) {
            const verifierAddress = typeof deploymentInfo.verifier === 'string'
                ? deploymentInfo.verifier
                : deploymentInfo.verifier.address;
            addresses.NEXT_PUBLIC_ZK_VERIFIER_CONTRACT_ADDRESS = verifierAddress;
            addresses.ZK_VERIFIER_CONTRACT_ADDRESS = verifierAddress;
        }

        // Extract ZK-specific addresses if available
        if (deploymentInfo.zk && deploymentInfo.zk.contracts) {
            addresses.NEXT_PUBLIC_ZK_ACCESS_CONTROL_CONTRACT_ADDRESS = deploymentInfo.zk.contracts.ZKAccessControl;
            addresses.NEXT_PUBLIC_ZK_VERIFIER_CONTRACT_ADDRESS = deploymentInfo.zk.contracts.Groth16Verifier;
            addresses.ZK_CONTRACT_ADDRESS = deploymentInfo.zk.contracts.ZKAccessControl;
            addresses.ZK_VERIFIER_CONTRACT_ADDRESS = deploymentInfo.zk.contracts.Groth16Verifier;
        }

        // Set network-specific addresses
        const networkSuffix = network.toUpperCase();
        Object.keys(addresses).forEach(key => {
            if (addresses[key] && !key.startsWith('NEXT_PUBLIC_')) {
                addresses[`${key}_${networkSuffix}`] = addresses[key];
            }
        });

        // Set RPC URL based on network
        if (network === 'localhost') {
            addresses.RPC_URL = 'http://localhost:8545';
            addresses.NEXT_PUBLIC_RPC_URL = 'http://localhost:8545';
        }

        return addresses;
    }

    async updateEnvFile(addresses, network) {
        // Read current .env file or create from example
        let envContent = '';

        if (fs.existsSync(this.envFile)) {
            envContent = fs.readFileSync(this.envFile, 'utf8');
        } else if (fs.existsSync(this.envExampleFile)) {
            envContent = fs.readFileSync(this.envExampleFile, 'utf8');
            this.log('Created .env from .env.example');
        } else {
            throw new Error('No .env or .env.example file found');
        }

        // Update or add each address
        Object.entries(addresses).forEach(([key, value]) => {
            if (value) {
                const regex = new RegExp(`^${key}=.*$`, 'm');
                const newLine = `${key}=${value}`;

                if (regex.test(envContent)) {
                    envContent = envContent.replace(regex, newLine);
                    this.log(`Updated ${key}=${value}`);
                } else {
                    envContent += `\n${newLine}`;
                    this.log(`Added ${key}=${value}`);
                }
            }
        });

        // Update network ID
        const networkIds = {
            localhost: '31337',
            hardhat: '31337',
            sepolia: '11155111',
            goerli: '5',
            mainnet: '1'
        };

        if (networkIds[network]) {
            const networkIdRegex = /^NEXT_PUBLIC_NETWORK_ID=.*$/m;
            const networkIdLine = `NEXT_PUBLIC_NETWORK_ID=${networkIds[network]}`;

            if (networkIdRegex.test(envContent)) {
                envContent = envContent.replace(networkIdRegex, networkIdLine);
            } else {
                envContent += `\n${networkIdLine}`;
            }
            this.log(`Updated NEXT_PUBLIC_NETWORK_ID=${networkIds[network]}`);
        }

        // Write updated content
        fs.writeFileSync(this.envFile, envContent);
        this.log(`Environment file updated: ${this.envFile}`);
    }

    async validateAddresses() {
        this.log('Validating contract addresses...');

        const requiredVars = [
            'NEXT_PUBLIC_CONTRACT_ADDRESS',
            'NEXT_PUBLIC_ZK_ACCESS_CONTROL_CONTRACT_ADDRESS',
            'NEXT_PUBLIC_ZK_VERIFIER_CONTRACT_ADDRESS'
        ];

        const missing = [];
        requiredVars.forEach(varName => {
            if (!process.env[varName]) {
                missing.push(varName);
            }
        });

        if (missing.length > 0) {
            this.log(`Missing required environment variables: ${missing.join(', ')}`, 'warning');
            return false;
        }

        this.log('All required contract addresses are set', 'success');
        return true;
    }

    async showCurrentAddresses() {
        this.log('Current contract addresses:');

        const addressVars = [
            'NEXT_PUBLIC_CONTRACT_ADDRESS',
            'NEXT_PUBLIC_STUDENT_MANAGEMENT_CONTRACT_ADDRESS',
            'NEXT_PUBLIC_ZK_ACCESS_CONTROL_CONTRACT_ADDRESS',
            'NEXT_PUBLIC_ZK_VERIFIER_CONTRACT_ADDRESS',
            'NEXT_PUBLIC_NETWORK_ID'
        ];

        addressVars.forEach(varName => {
            const value = process.env[varName] || 'Not set';
            console.log(`  ${varName}: ${value}`);
        });
    }
}

// CLI interface
if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0];
    const network = args[1];

    const updater = new EnvContractUpdater();

    switch (command) {
        case 'update':
            updater.updateContractAddresses(network).catch(error => {
                console.error('Update failed:', error);
                process.exit(1);
            });
            break;

        case 'validate':
            updater.validateAddresses().then(valid => {
                process.exit(valid ? 0 : 1);
            });
            break;

        case 'show':
            updater.showCurrentAddresses();
            break;

        default:
            console.log('Usage:');
            console.log('  node update-env-contracts.js update [network]  - Update contract addresses');
            console.log('  node update-env-contracts.js validate         - Validate current addresses');
            console.log('  node update-env-contracts.js show             - Show current addresses');
            console.log('');
            console.log('Networks: localhost, sepolia, goerli, mainnet');
            break;
    }
}

module.exports = EnvContractUpdater;