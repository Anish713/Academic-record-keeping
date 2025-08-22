#!/usr/bin/env node

/**
 * Trusted Setup Ceremony Simulation Script
 * 
 * This script simulates a trusted setup ceremony for development purposes.
 * In production, this would be replaced with a real multi-party ceremony.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

class TrustedSetupCeremony {
    constructor(options = {}) {
        this.circuitName = options.circuitName || 'access-control';
        this.ptauPower = options.ptauPower || 14;
        this.participants = options.participants || 3;
        this.outputDir = options.outputDir || path.join(__dirname, '../public/circuits');
        this.circuitsDir = options.circuitsDir || path.join(__dirname, '../circuits');
        this.ceremonyDir = path.join(this.circuitsDir, 'ceremony');
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = {
            info: '🔐',
            success: '✅',
            error: '❌',
            warning: '⚠️',
            ceremony: '🎭'
        }[type] || 'ℹ️';

        console.log(`${prefix} [${timestamp}] ${message}`);
    }

    async runCeremony() {
        try {
            this.log('Starting trusted setup ceremony simulation...', 'ceremony');

            // Prepare ceremony environment
            this.prepareCeremonyEnvironment();

            // Phase 1: Powers of Tau
            await this.runPhase1();

            // Phase 2: Circuit-specific setup
            await this.runPhase2();

            // Verify ceremony results
            await this.verifyCeremony();

            // Generate final artifacts
            await this.generateFinalArtifacts();

            // Clean up ceremony files
            this.cleanupCeremony();

            this.log('Trusted setup ceremony completed successfully!', 'success');

        } catch (error) {
            this.log(`Ceremony failed: ${error.message}`, 'error');
            throw error;
        }
    }

    prepareCeremonyEnvironment() {
        this.log('Preparing ceremony environment...');

        // Create ceremony directory
        if (!fs.existsSync(this.ceremonyDir)) {
            fs.mkdirSync(this.ceremonyDir, { recursive: true });
        }

        // Ensure output directory exists
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }

        this.log('Ceremony environment prepared');
    }

    async runPhase1() {
        this.log('Phase 1: Powers of Tau ceremony...', 'ceremony');

        const ptauFiles = [];
        let currentPtau = path.join(this.ceremonyDir, `pot${this.ptauPower}_0000.ptau`);

        // Initialize ceremony
        this.log('Initializing Powers of Tau...');
        execSync(`snarkjs powersoftau new bn128 ${this.ptauPower} "${currentPtau}" -v`, {
            stdio: 'inherit'
        });
        ptauFiles.push(currentPtau);

        // Simulate multiple participants
        for (let i = 1; i <= this.participants; i++) {
            const nextPtau = path.join(this.ceremonyDir, `pot${this.ptauPower}_${i.toString().padStart(4, '0')}.ptau`);
            const entropy = crypto.randomBytes(32).toString('hex');

            this.log(`Participant ${i} contributing...`);
            execSync(`snarkjs powersoftau contribute "${currentPtau}" "${nextPtau}" --name="Participant ${i}" --entropy="${entropy}" -v`, {
                stdio: 'inherit'
            });

            ptauFiles.push(nextPtau);
            currentPtau = nextPtau;
        }

        // Apply random beacon
        const finalPtau = path.join(this.circuitsDir, `pot${this.ptauPower}_final.ptau`);
        const beacon = crypto.randomBytes(32).toString('hex');

        this.log('Applying random beacon...');
        execSync(`snarkjs powersoftau beacon "${currentPtau}" "${finalPtau}" ${beacon} 10 -n="Final Beacon" -v`, {
            stdio: 'inherit'
        });

        // Verify Powers of Tau
        this.log('Verifying Powers of Tau...');
        execSync(`snarkjs powersoftau verify "${finalPtau}"`, {
            stdio: 'inherit'
        });

        // Clean up intermediate ptau files
        ptauFiles.forEach(file => {
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
            }
        });

        this.log('Phase 1 completed successfully', 'success');
    }

    async runPhase2() {
        this.log('Phase 2: Circuit-specific setup...', 'ceremony');

        const r1csFile = path.join(this.outputDir, `${this.circuitName}.r1cs`);
        const ptauFile = path.join(this.circuitsDir, `pot${this.ptauPower}_final.ptau`);

        if (!fs.existsSync(r1csFile)) {
            throw new Error(`R1CS file not found: ${r1csFile}. Run circuit compilation first.`);
        }

        if (!fs.existsSync(ptauFile)) {
            throw new Error(`Powers of Tau file not found: ${ptauFile}`);
        }

        // Initial setup
        const zkey0 = path.join(this.ceremonyDir, `${this.circuitName}_0000.zkey`);
        this.log('Running initial setup...');
        execSync(`snarkjs groth16 setup "${r1csFile}" "${ptauFile}" "${zkey0}"`, {
            stdio: 'inherit'
        });

        // Simulate multiple contributions
        let currentZkey = zkey0;
        for (let i = 1; i <= this.participants; i++) {
            const nextZkey = path.join(this.ceremonyDir, `${this.circuitName}_${i.toString().padStart(4, '0')}.zkey`);
            const entropy = crypto.randomBytes(32).toString('hex');

            this.log(`Phase 2 - Participant ${i} contributing...`);
            execSync(`snarkjs zkey contribute "${currentZkey}" "${nextZkey}" --name="Participant ${i}" --entropy="${entropy}" -v`, {
                stdio: 'inherit'
            });

            currentZkey = nextZkey;
        }

        // Apply final beacon
        const finalZkey = path.join(this.outputDir, `${this.circuitName}_0001.zkey`);
        const beacon = crypto.randomBytes(32).toString('hex');

        this.log('Applying final beacon to Phase 2...');
        execSync(`snarkjs zkey beacon "${currentZkey}" "${finalZkey}" ${beacon} 10 -n="Final Phase2 Beacon" -v`, {
            stdio: 'inherit'
        });

        this.log('Phase 2 completed successfully', 'success');
    }

    async verifyCeremony() {
        this.log('Verifying ceremony results...');

        const r1csFile = path.join(this.outputDir, `${this.circuitName}.r1cs`);
        const ptauFile = path.join(this.circuitsDir, `pot${this.ptauPower}_final.ptau`);
        const zkeyFile = path.join(this.outputDir, `${this.circuitName}_0001.zkey`);

        // Verify final zkey
        execSync(`snarkjs zkey verify "${r1csFile}" "${ptauFile}" "${zkeyFile}"`, {
            stdio: 'inherit'
        });

        this.log('Ceremony verification passed', 'success');
    }

    async generateFinalArtifacts() {
        this.log('Generating final ceremony artifacts...');

        const zkeyFile = path.join(this.outputDir, `${this.circuitName}_0001.zkey`);
        const vkeyFile = path.join(this.outputDir, 'verification_key.json');
        const verifierFile = path.join(__dirname, '../blockchain/contracts/verifier.sol');

        // Export verification key
        this.log('Exporting verification key...');
        execSync(`snarkjs zkey export verificationkey "${zkeyFile}" "${vkeyFile}"`, {
            stdio: 'inherit'
        });

        // Generate Solidity verifier
        this.log('Generating Solidity verifier...');
        execSync(`snarkjs zkey export solidityverifier "${zkeyFile}" "${verifierFile}"`, {
            stdio: 'inherit'
        });

        // Generate ceremony info
        const ceremonyInfo = {
            circuitName: this.circuitName,
            ptauPower: this.ptauPower,
            participants: this.participants,
            timestamp: new Date().toISOString(),
            phase1Completed: true,
            phase2Completed: true,
            verified: true,
            artifacts: {
                zkey: `${this.circuitName}_0001.zkey`,
                vkey: 'verification_key.json',
                verifier: 'verifier.sol'
            },
            warning: 'This is a development ceremony. DO NOT use in production!'
        };

        const ceremonyInfoFile = path.join(this.outputDir, 'ceremony-info.json');
        fs.writeFileSync(ceremonyInfoFile, JSON.stringify(ceremonyInfo, null, 2));

        this.log('Final artifacts generated', 'success');
    }

    cleanupCeremony() {
        this.log('Cleaning up ceremony files...');

        if (fs.existsSync(this.ceremonyDir)) {
            fs.rmSync(this.ceremonyDir, { recursive: true, force: true });
        }

        this.log('Ceremony cleanup completed');
    }

    // Static method to run a quick ceremony for development
    static async quickSetup(circuitName = 'access-control') {
        const ceremony = new TrustedSetupCeremony({
            circuitName,
            ptauPower: 12, // Smaller for faster development
            participants: 1
        });

        await ceremony.runCeremony();
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
            case 'circuit':
                options.circuitName = value;
                break;
            case 'power':
                options.ptauPower = parseInt(value);
                break;
            case 'participants':
                options.participants = parseInt(value);
                break;
            case 'quick':
                TrustedSetupCeremony.quickSetup().catch(error => {
                    console.error('Quick setup failed:', error);
                    process.exit(1);
                });
                return;
        }
    }

    const ceremony = new TrustedSetupCeremony(options);
    ceremony.runCeremony().catch(error => {
        console.error('Ceremony failed:', error);
        process.exit(1);
    });
}

module.exports = TrustedSetupCeremony;