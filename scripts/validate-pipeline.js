#!/usr/bin/env node

/**
 * ZK Pipeline Validation Script
 * 
 * This script validates that the ZK pipeline is properly set up without
 * requiring all dependencies to be installed.
 */

const fs = require('fs');
const path = require('path');

class PipelineValidator {
    constructor() {
        this.rootDir = path.join(__dirname, '..');
        this.errors = [];
        this.warnings = [];
    }

    log(message, type = 'info') {
        const prefix = {
            info: '🔍',
            success: '✅',
            error: '❌',
            warning: '⚠️'
        }[type] || 'ℹ️';

        console.log(`${prefix} ${message}`);
    }

    validate() {
        this.log('Validating ZK pipeline setup...');

        this.validateScripts();
        this.validateDirectories();
        this.validateConfiguration();
        this.validateWorkflows();
        this.validateDocumentation();

        this.printSummary();

        return this.errors.length === 0;
    }

    validateScripts() {
        this.log('Checking pipeline scripts...');

        const requiredScripts = [
            'scripts/build-circuits.js',
            'scripts/trusted-setup.js',
            'scripts/circuit-manager.js',
            'scripts/deploy-zk-system.js',
            'scripts/test-zk-pipeline.js'
        ];

        for (const script of requiredScripts) {
            const scriptPath = path.join(this.rootDir, script);
            if (!fs.existsSync(scriptPath)) {
                this.errors.push(`Missing script: ${script}`);
            } else {
                // Check if script is executable
                try {
                    fs.accessSync(scriptPath, fs.constants.X_OK);
                    this.log(`✓ ${script}`);
                } catch (error) {
                    this.warnings.push(`Script not executable: ${script}`);
                }
            }
        }
    }

    validateDirectories() {
        this.log('Checking directory structure...');

        const requiredDirs = [
            'circuits',
            'public/circuits',
            'blockchain/contracts',
            'scripts',
            '.github/workflows'
        ];

        for (const dir of requiredDirs) {
            const dirPath = path.join(this.rootDir, dir);
            if (!fs.existsSync(dirPath)) {
                this.errors.push(`Missing directory: ${dir}`);
            } else {
                this.log(`✓ ${dir}/`);
            }
        }
    }

    validateConfiguration() {
        this.log('Checking configuration files...');

        // Check package.json scripts
        const packageJsonPath = path.join(this.rootDir, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            const requiredScripts = [
                'build:circuits',
                'trusted-setup',
                'circuit:version',
                'deploy:zk',
                'test:zk-pipeline'
            ];

            for (const script of requiredScripts) {
                if (!packageJson.scripts[script]) {
                    this.errors.push(`Missing npm script: ${script}`);
                } else {
                    this.log(`✓ npm script: ${script}`);
                }
            }
        } else {
            this.errors.push('Missing package.json');
        }

        // Check .env.example
        const envExamplePath = path.join(this.rootDir, '.env.example');
        if (fs.existsSync(envExamplePath)) {
            const envContent = fs.readFileSync(envExamplePath, 'utf8');
            const requiredVars = [
                'ZK_CIRCUIT_NAME',
                'ZK_PTAU_POWER',
                'NEXT_PUBLIC_ZK_CIRCUIT_WASM_URL',
                'NEXT_PUBLIC_ZK_PROVING_KEY_URL'
            ];

            for (const varName of requiredVars) {
                if (!envContent.includes(varName)) {
                    this.warnings.push(`Missing environment variable in .env.example: ${varName}`);
                } else {
                    this.log(`✓ env var: ${varName}`);
                }
            }
        } else {
            this.warnings.push('Missing .env.example');
        }
    }

    validateWorkflows() {
        this.log('Checking CI/CD workflows...');

        const workflowPath = path.join(this.rootDir, '.github/workflows/zk-circuit-ci.yml');
        if (fs.existsSync(workflowPath)) {
            const workflowContent = fs.readFileSync(workflowPath, 'utf8');

            const requiredJobs = [
                'circuit-validation',
                'trusted-setup',
                'circuit-testing',
                'contract-integration',
                'artifact-management'
            ];

            for (const job of requiredJobs) {
                if (!workflowContent.includes(job)) {
                    this.warnings.push(`Missing CI job: ${job}`);
                } else {
                    this.log(`✓ CI job: ${job}`);
                }
            }
        } else {
            this.warnings.push('Missing CI/CD workflow');
        }
    }

    validateDocumentation() {
        this.log('Checking documentation...');

        const docPath = path.join(this.rootDir, 'docs/ZK_PIPELINE.md');
        if (fs.existsSync(docPath)) {
            this.log('✓ ZK Pipeline documentation');
        } else {
            this.warnings.push('Missing ZK Pipeline documentation');
        }
    }

    printSummary() {
        console.log('\n' + '='.repeat(50));
        console.log('ZK PIPELINE VALIDATION SUMMARY');
        console.log('='.repeat(50));

        if (this.errors.length === 0 && this.warnings.length === 0) {
            this.log('All validations passed! ZK pipeline is properly configured.', 'success');
        } else {
            if (this.errors.length > 0) {
                console.log('\n❌ ERRORS:');
                this.errors.forEach(error => console.log(`  - ${error}`));
            }

            if (this.warnings.length > 0) {
                console.log('\n⚠️  WARNINGS:');
                this.warnings.forEach(warning => console.log(`  - ${warning}`));
            }

            if (this.errors.length === 0) {
                this.log('Validation completed with warnings only.', 'warning');
            } else {
                this.log('Validation failed. Please fix the errors above.', 'error');
            }
        }

        console.log('\nNext steps:');
        console.log('1. Install dependencies: npm install');
        console.log('2. Install ZK tools: circom, snarkjs');
        console.log('3. Run pipeline test: npm run test:zk-pipeline');
        console.log('4. Build circuits: npm run build:circuits');
    }
}

// Run validation if called directly
if (require.main === module) {
    const validator = new PipelineValidator();
    const isValid = validator.validate();
    process.exit(isValid ? 0 : 1);
}

module.exports = PipelineValidator;