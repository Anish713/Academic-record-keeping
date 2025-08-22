#!/usr/bin/env node

/**
 * Environment Configuration Validator
 * 
 * This script validates that all required environment variables are set
 * and have valid values for ZK integration.
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

class EnvValidator {
    constructor() {
        this.errors = [];
        this.warnings = [];
        this.rootDir = path.join(__dirname, '..');
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = {
            info: 'ℹ️',
            success: '✅',
            error: '❌',
            warning: '⚠️'
        }[type] || 'ℹ️';

        console.log(`${prefix} [${timestamp}] ${message}`);
    }

    validate() {
        this.log('Validating environment configuration...');

        // Validate blockchain configuration
        this.validateBlockchainConfig();

        // Validate ZK configuration
        this.validateZKConfig();

        // Validate contract addresses
        this.validateContractAddresses();

        // Validate file paths
        this.validateFilePaths();

        // Validate API configuration
        this.validateAPIConfig();

        // Report results
        this.reportResults();

        return this.errors.length === 0;
    }

    validateBlockchainConfig() {
        this.log('Validating blockchain configuration...');

        const required = [
            'PRIVATE_KEY',
            'NEXT_PUBLIC_NETWORK_ID'
        ];

        const optional = [
            'INFURA_API_KEY',
            'ETHERSCAN_API_KEY',
            'RPC_URL',
            'NEXT_PUBLIC_RPC_URL'
        ];

        required.forEach(varName => {
            if (!process.env[varName]) {
                this.errors.push(`Missing required variable: ${varName}`);
            } else if (varName === 'PRIVATE_KEY' && !this.isValidPrivateKey(process.env[varName])) {
                this.errors.push(`Invalid private key format: ${varName}`);
            }
        });

        optional.forEach(varName => {
            if (!process.env[varName]) {
                this.warnings.push(`Optional variable not set: ${varName}`);
            }
        });

        // Validate network ID
        const networkId = process.env.NEXT_PUBLIC_NETWORK_ID;
        if (networkId && !['1', '5', '11155111', '31337'].includes(networkId)) {
            this.warnings.push(`Unusual network ID: ${networkId}`);
        }
    }

    validateZKConfig() {
        this.log('Validating ZK configuration...');

        const zkVars = [
            'ZK_CIRCUIT_PATH',
            'ZK_WASM_PATH',
            'ZK_PROVING_KEY_PATH',
            'ZK_VERIFICATION_KEY_PATH',
            'NEXT_PUBLIC_ZK_CIRCUIT_WASM_URL',
            'NEXT_PUBLIC_ZK_PROVING_KEY_URL'
        ];

        zkVars.forEach(varName => {
            if (!process.env[varName]) {
                this.warnings.push(`ZK variable not set: ${varName}`);
            }
        });

        // Validate ZK build configuration
        const buildVars = [
            'ZK_CIRCUIT_NAME',
            'ZK_PTAU_POWER',
            'ZK_CEREMONY_PARTICIPANTS'
        ];

        buildVars.forEach(varName => {
            if (!process.env[varName]) {
                this.warnings.push(`ZK build variable not set: ${varName}`);
            }
        });

        // Validate numeric values
        const numericVars = {
            'ZK_PTAU_POWER': { min: 10, max: 20 },
            'ZK_CEREMONY_PARTICIPANTS': { min: 1, max: 10 },
            'ZK_CONSTRAINT_LIMIT': { min: 1000, max: 10000000 },
            'ZK_PROOF_CACHE_TTL': { min: 60, max: 86400 },
            'ZK_MAX_PROOF_GENERATION_TIME': { min: 1000, max: 300000 }
        };

        Object.entries(numericVars).forEach(([varName, { min, max }]) => {
            const value = parseInt(process.env[varName]);
            if (process.env[varName] && (isNaN(value) || value < min || value > max)) {
                this.errors.push(`Invalid ${varName}: must be between ${min} and ${max}`);
            }
        });

        // Validate boolean values
        const booleanVars = [
            'ZK_ENABLE_PROOF_CACHING',
            'ZK_ENABLE_CIRCUIT_OPTIMIZATION',
            'ZK_BUILD_PARALLEL'
        ];

        booleanVars.forEach(varName => {
            const value = process.env[varName];
            if (value && !['true', 'false'].includes(value.toLowerCase())) {
                this.errors.push(`Invalid ${varName}: must be 'true' or 'false'`);
            }
        });
    }

    validateContractAddresses() {
        this.log('Validating contract addresses...');

        const contractVars = [
            'NEXT_PUBLIC_CONTRACT_ADDRESS',
            'NEXT_PUBLIC_STUDENT_MANAGEMENT_CONTRACT_ADDRESS',
            'NEXT_PUBLIC_ZK_ACCESS_CONTROL_CONTRACT_ADDRESS',
            'NEXT_PUBLIC_ZK_VERIFIER_CONTRACT_ADDRESS'
        ];

        contractVars.forEach(varName => {
            const address = process.env[varName];
            if (address && !this.isValidAddress(address)) {
                this.errors.push(`Invalid contract address: ${varName}`);
            } else if (!address) {
                this.warnings.push(`Contract address not set: ${varName}`);
            }
        });
    }

    validateFilePaths() {
        this.log('Validating file paths...');

        const pathVars = [
            'ZK_CIRCUIT_PATH',
            'ZK_TRUSTED_SETUP_PTAU_PATH'
        ];

        pathVars.forEach(varName => {
            const filePath = process.env[varName];
            if (filePath) {
                const fullPath = path.resolve(this.rootDir, filePath);
                if (!fs.existsSync(fullPath)) {
                    this.warnings.push(`File not found: ${varName} -> ${fullPath}`);
                }
            }
        });

        // Check if public circuit files exist
        const publicPaths = [
            'NEXT_PUBLIC_ZK_CIRCUIT_WASM_URL',
            'NEXT_PUBLIC_ZK_PROVING_KEY_URL'
        ];

        publicPaths.forEach(varName => {
            const urlPath = process.env[varName];
            if (urlPath) {
                const filePath = path.join(this.rootDir, 'public', urlPath.replace(/^\//, ''));
                if (!fs.existsSync(filePath)) {
                    this.warnings.push(`Public file not found: ${varName} -> ${filePath}`);
                }
            }
        });
    }

    validateAPIConfig() {
        this.log('Validating API configuration...');

        // Validate Pinata configuration
        const pinataVars = [
            'PINATA_API_KEY',
            'PINATA_API_SECRET_KEY',
            'PINATA_JWT_SECRET_ACCESS_TOKEN',
            'NEXT_PUBLIC_PINATA_GATEWAY_URL'
        ];

        const missingPinata = pinataVars.filter(varName => !process.env[varName]);
        if (missingPinata.length > 0 && missingPinata.length < pinataVars.length) {
            this.warnings.push(`Incomplete Pinata configuration: missing ${missingPinata.join(', ')}`);
        }

        // Validate API security settings
        const securityVars = {
            'ZK_API_RATE_LIMIT_WINDOW': { min: 1000, max: 3600000 },
            'ZK_API_RATE_LIMIT_MAX_REQUESTS': { min: 1, max: 1000 }
        };

        Object.entries(securityVars).forEach(([varName, { min, max }]) => {
            const value = parseInt(process.env[varName]);
            if (process.env[varName] && (isNaN(value) || value < min || value > max)) {
                this.errors.push(`Invalid ${varName}: must be between ${min} and ${max}`);
            }
        });

        // Validate CORS origins
        const corsOrigins = process.env.ZK_API_ALLOWED_ORIGINS;
        if (corsOrigins) {
            const origins = corsOrigins.split(',');
            origins.forEach(origin => {
                if (!this.isValidURL(origin.trim())) {
                    this.warnings.push(`Invalid CORS origin: ${origin}`);
                }
            });
        }
    }

    isValidPrivateKey(key) {
        return /^[0-9a-fA-F]{64}$/.test(key);
    }

    isValidAddress(address) {
        return /^0x[0-9a-fA-F]{40}$/.test(address);
    }

    isValidURL(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    reportResults() {
        console.log('\n' + '='.repeat(60));
        console.log('ENVIRONMENT VALIDATION RESULTS');
        console.log('='.repeat(60));

        if (this.errors.length === 0 && this.warnings.length === 0) {
            this.log('All environment variables are properly configured!', 'success');
        } else {
            if (this.errors.length > 0) {
                console.log('\n❌ ERRORS:');
                this.errors.forEach(error => console.log(`  - ${error}`));
            }

            if (this.warnings.length > 0) {
                console.log('\n⚠️  WARNINGS:');
                this.warnings.forEach(warning => console.log(`  - ${warning}`));
            }

            console.log('\n📋 SUMMARY:');
            console.log(`  Errors: ${this.errors.length}`);
            console.log(`  Warnings: ${this.warnings.length}`);

            if (this.errors.length === 0) {
                this.log('Environment validation passed with warnings', 'warning');
            } else {
                this.log('Environment validation failed', 'error');
            }
        }

        console.log('='.repeat(60));
    }

    generateEnvTemplate() {
        this.log('Generating environment template...');

        const template = `# Environment Configuration Template
# Generated on ${new Date().toISOString()}

# Blockchain Configuration
PRIVATE_KEY=your_private_key_here
INFURA_API_KEY=your_infura_api_key_here
ETHERSCAN_API_KEY=your_etherscan_api_key_here
NEXT_PUBLIC_NETWORK_ID=31337

# Contract Addresses (will be updated by deployment scripts)
NEXT_PUBLIC_CONTRACT_ADDRESS=
NEXT_PUBLIC_STUDENT_MANAGEMENT_CONTRACT_ADDRESS=
NEXT_PUBLIC_ZK_ACCESS_CONTROL_CONTRACT_ADDRESS=
NEXT_PUBLIC_ZK_VERIFIER_CONTRACT_ADDRESS=

# ZK Configuration
ZK_CIRCUIT_PATH=./circuits/access-control.circom
ZK_WASM_PATH=./public/circuits/access-control_js/access-control.wasm
ZK_PROVING_KEY_PATH=./public/circuits/access-control_0001.zkey
ZK_VERIFICATION_KEY_PATH=./circuits/verification_key.json
NEXT_PUBLIC_ZK_CIRCUIT_WASM_URL=/circuits/access-control_js/access-control.wasm
NEXT_PUBLIC_ZK_PROVING_KEY_URL=/circuits/access-control_0001.zkey

# ZK Build Configuration
ZK_CIRCUIT_NAME=access-control
ZK_PTAU_POWER=14
ZK_CEREMONY_PARTICIPANTS=3
ZK_CONSTRAINT_LIMIT=1000000
ZK_ENABLE_CIRCUIT_OPTIMIZATION=true
ZK_BUILD_PARALLEL=true
ZK_TRUSTED_SETUP_PTAU_PATH=./circuits/pot14_final.ptau

# ZK Performance
ZK_ENABLE_PROOF_CACHING=true
ZK_PROOF_CACHE_TTL=3600
ZK_MAX_PROOF_GENERATION_TIME=30000

# API Configuration
RPC_URL=http://localhost:8545
NEXT_PUBLIC_RPC_URL=http://localhost:8545

# Pinata Configuration
PINATA_API_KEY=
PINATA_API_SECRET_KEY=
PINATA_JWT_SECRET_ACCESS_TOKEN=
PINATA_GATEWAY_ACCESS_KEY=
NEXT_PUBLIC_PINATA_GATEWAY_URL=

# API Security
ZK_API_RATE_LIMIT_WINDOW=60000
ZK_API_RATE_LIMIT_MAX_REQUESTS=10
ZK_API_ENABLE_CORS=true
ZK_API_ALLOWED_ORIGINS=http://localhost:3000
`;

        const templatePath = path.join(this.rootDir, '.env.template');
        fs.writeFileSync(templatePath, template);
        this.log(`Environment template saved to: ${templatePath}`, 'success');
    }
}

// CLI interface
if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0];

    const validator = new EnvValidator();

    switch (command) {
        case 'validate':
            const isValid = validator.validate();
            process.exit(isValid ? 0 : 1);
            break;

        case 'template':
            validator.generateEnvTemplate();
            break;

        default:
            console.log('Usage:');
            console.log('  node validate-env.js validate  - Validate current environment');
            console.log('  node validate-env.js template  - Generate environment template');
            break;
    }
}

module.exports = EnvValidator;