#!/usr/bin/env node

/**
 * ZK Circuit Artifact Management and Versioning System
 * 
 * This script manages ZK circuit artifacts including:
 * - Version tracking and compatibility
 * - Artifact integrity verification
 * - Migration between circuit versions
 * - Deployment artifact preparation
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

class CircuitManager {
    constructor() {
        this.rootDir = path.join(__dirname, '..');
        this.circuitsDir = path.join(this.rootDir, 'circuits');
        this.outputDir = path.join(this.rootDir, 'public/circuits');
        this.versionsDir = path.join(this.outputDir, 'versions');
        this.manifestFile = path.join(this.outputDir, 'circuit-manifest.json');
        this.currentVersion = this.getCurrentVersion();
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = {
            info: '📦',
            success: '✅',
            error: '❌',
            warning: '⚠️',
            version: '🏷️'
        }[type] || 'ℹ️';

        console.log(`${prefix} [${timestamp}] ${message}`);
    }

    getCurrentVersion() {
        try {
            const packageJson = JSON.parse(fs.readFileSync(path.join(this.rootDir, 'package.json'), 'utf8'));
            return packageJson.version || '1.0.0';
        } catch (error) {
            return '1.0.0';
        }
    }

    async initializeManager() {
        this.log('Initializing circuit artifact manager...');

        // Create necessary directories
        [this.versionsDir].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });

        // Initialize manifest if it doesn't exist
        if (!fs.existsSync(this.manifestFile)) {
            const initialManifest = {
                currentVersion: this.currentVersion,
                versions: {},
                circuits: {},
                created: new Date().toISOString(),
                lastUpdated: new Date().toISOString()
            };

            fs.writeFileSync(this.manifestFile, JSON.stringify(initialManifest, null, 2));
            this.log('Circuit manifest initialized');
        }

        this.log('Circuit manager initialized', 'success');
    }

    async versionArtifacts(circuitName = 'access-control') {
        this.log(`Versioning artifacts for circuit: ${circuitName}`, 'version');

        const manifest = this.loadManifest();
        const versionDir = path.join(this.versionsDir, this.currentVersion);

        // Create version directory
        if (!fs.existsSync(versionDir)) {
            fs.mkdirSync(versionDir, { recursive: true });
        }

        // Define artifact files
        const artifacts = {
            r1cs: path.join(this.outputDir, `${circuitName}.r1cs`),
            wasm: path.join(this.outputDir, `${circuitName}_js`, `${circuitName}.wasm`),
            zkey: path.join(this.outputDir, `${circuitName}_0001.zkey`),
            vkey: path.join(this.outputDir, 'verification_key.json'),
            sym: path.join(this.outputDir, `${circuitName}.sym`)
        };

        const versionInfo = {
            version: this.currentVersion,
            circuitName,
            timestamp: new Date().toISOString(),
            artifacts: {},
            checksums: {},
            metadata: {}
        };

        // Copy and verify artifacts
        for (const [type, sourcePath] of Object.entries(artifacts)) {
            if (fs.existsSync(sourcePath)) {
                const fileName = path.basename(sourcePath);
                const destPath = path.join(versionDir, fileName);

                // Copy file
                fs.copyFileSync(sourcePath, destPath);

                // Calculate checksum
                const content = fs.readFileSync(sourcePath);
                const checksum = crypto.createHash('sha256').update(content).digest('hex');

                versionInfo.artifacts[type] = fileName;
                versionInfo.checksums[type] = checksum;
                versionInfo.metadata[type] = {
                    size: content.length,
                    created: fs.statSync(sourcePath).mtime.toISOString()
                };

                this.log(`✓ Versioned ${type}: ${fileName}`);
            } else {
                this.log(`⚠️ Artifact not found: ${sourcePath}`, 'warning');
            }
        }

        // Save version info
        const versionInfoFile = path.join(versionDir, 'version-info.json');
        fs.writeFileSync(versionInfoFile, JSON.stringify(versionInfo, null, 2));

        // Update manifest
        manifest.versions[this.currentVersion] = versionInfo;
        manifest.circuits[circuitName] = {
            currentVersion: this.currentVersion,
            versions: Object.keys(manifest.versions).filter(v =>
                manifest.versions[v].circuitName === circuitName
            )
        };
        manifest.currentVersion = this.currentVersion;
        manifest.lastUpdated = new Date().toISOString();

        this.saveManifest(manifest);

        this.log(`Circuit artifacts versioned as ${this.currentVersion}`, 'success');
        return versionInfo;
    }

    async verifyArtifacts(version = this.currentVersion) {
        this.log(`Verifying artifacts for version: ${version}`);

        const manifest = this.loadManifest();
        const versionInfo = manifest.versions[version];

        if (!versionInfo) {
            throw new Error(`Version ${version} not found in manifest`);
        }

        const versionDir = path.join(this.versionsDir, version);
        let allValid = true;

        for (const [type, fileName] of Object.entries(versionInfo.artifacts)) {
            const filePath = path.join(versionDir, fileName);

            if (!fs.existsSync(filePath)) {
                this.log(`❌ Missing artifact: ${fileName}`, 'error');
                allValid = false;
                continue;
            }

            // Verify checksum
            const content = fs.readFileSync(filePath);
            const checksum = crypto.createHash('sha256').update(content).digest('hex');

            if (checksum !== versionInfo.checksums[type]) {
                this.log(`❌ Checksum mismatch for ${fileName}`, 'error');
                allValid = false;
            } else {
                this.log(`✓ Verified ${type}: ${fileName}`);
            }
        }

        if (allValid) {
            this.log(`All artifacts verified for version ${version}`, 'success');
        } else {
            throw new Error(`Artifact verification failed for version ${version}`);
        }

        return allValid;
    }

    async listVersions() {
        const manifest = this.loadManifest();

        this.log('Available circuit versions:');
        console.log('');

        for (const [version, info] of Object.entries(manifest.versions)) {
            const isCurrent = version === manifest.currentVersion;
            const status = isCurrent ? '(current)' : '';

            console.log(`  ${isCurrent ? '→' : ' '} ${version} ${status}`);
            console.log(`    Circuit: ${info.circuitName}`);
            console.log(`    Created: ${info.timestamp}`);
            console.log(`    Artifacts: ${Object.keys(info.artifacts).length}`);
            console.log('');
        }
    }

    async deployVersion(version, targetDir) {
        this.log(`Deploying version ${version} to ${targetDir}`);

        await this.verifyArtifacts(version);

        const manifest = this.loadManifest();
        const versionInfo = manifest.versions[version];
        const versionDir = path.join(this.versionsDir, version);

        // Create target directory
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        // Copy artifacts to target
        for (const [type, fileName] of Object.entries(versionInfo.artifacts)) {
            const sourcePath = path.join(versionDir, fileName);
            const targetPath = path.join(targetDir, fileName);

            fs.copyFileSync(sourcePath, targetPath);
            this.log(`✓ Deployed ${type}: ${fileName}`);
        }

        // Create deployment manifest
        const deploymentManifest = {
            version,
            circuitName: versionInfo.circuitName,
            deployedAt: new Date().toISOString(),
            deployedTo: targetDir,
            artifacts: versionInfo.artifacts,
            checksums: versionInfo.checksums
        };

        fs.writeFileSync(
            path.join(targetDir, 'deployment-manifest.json'),
            JSON.stringify(deploymentManifest, null, 2)
        );

        this.log(`Version ${version} deployed successfully`, 'success');
        return deploymentManifest;
    }

    async migrateVersion(fromVersion, toVersion) {
        this.log(`Migrating from version ${fromVersion} to ${toVersion}`);

        const manifest = this.loadManifest();

        if (!manifest.versions[fromVersion]) {
            throw new Error(`Source version ${fromVersion} not found`);
        }

        if (!manifest.versions[toVersion]) {
            throw new Error(`Target version ${toVersion} not found`);
        }

        // Verify both versions
        await this.verifyArtifacts(fromVersion);
        await this.verifyArtifacts(toVersion);

        // Check compatibility
        const fromInfo = manifest.versions[fromVersion];
        const toInfo = manifest.versions[toVersion];

        if (fromInfo.circuitName !== toInfo.circuitName) {
            this.log('⚠️ Circuit names differ - this may require additional migration steps', 'warning');
        }

        // Create migration report
        const migrationReport = {
            from: fromVersion,
            to: toVersion,
            timestamp: new Date().toISOString(),
            changes: this.compareVersions(fromInfo, toInfo),
            compatible: this.checkCompatibility(fromInfo, toInfo)
        };

        const migrationFile = path.join(this.outputDir, `migration-${fromVersion}-to-${toVersion}.json`);
        fs.writeFileSync(migrationFile, JSON.stringify(migrationReport, null, 2));

        this.log(`Migration report saved: ${migrationFile}`, 'success');
        return migrationReport;
    }

    compareVersions(fromInfo, toInfo) {
        const changes = {
            artifacts: {},
            checksums: {}
        };

        // Compare artifacts
        for (const type of new Set([...Object.keys(fromInfo.artifacts), ...Object.keys(toInfo.artifacts)])) {
            if (!fromInfo.artifacts[type]) {
                changes.artifacts[type] = 'added';
            } else if (!toInfo.artifacts[type]) {
                changes.artifacts[type] = 'removed';
            } else if (fromInfo.checksums[type] !== toInfo.checksums[type]) {
                changes.artifacts[type] = 'modified';
                changes.checksums[type] = {
                    from: fromInfo.checksums[type],
                    to: toInfo.checksums[type]
                };
            }
        }

        return changes;
    }

    checkCompatibility(fromInfo, toInfo) {
        // Basic compatibility checks
        const compatible = {
            circuitName: fromInfo.circuitName === toInfo.circuitName,
            hasRequiredArtifacts: ['r1cs', 'wasm', 'zkey', 'vkey'].every(type =>
                toInfo.artifacts[type]
            )
        };

        compatible.overall = Object.values(compatible).every(Boolean);
        return compatible;
    }

    async cleanupOldVersions(keepCount = 5) {
        this.log(`Cleaning up old versions (keeping ${keepCount} most recent)...`);

        const manifest = this.loadManifest();
        const versions = Object.keys(manifest.versions).sort((a, b) => {
            return new Date(manifest.versions[b].timestamp) - new Date(manifest.versions[a].timestamp);
        });

        const versionsToDelete = versions.slice(keepCount);

        for (const version of versionsToDelete) {
            const versionDir = path.join(this.versionsDir, version);

            if (fs.existsSync(versionDir)) {
                fs.rmSync(versionDir, { recursive: true, force: true });
                this.log(`Deleted version directory: ${version}`);
            }

            delete manifest.versions[version];
        }

        // Update circuit version lists
        for (const circuitName of Object.keys(manifest.circuits)) {
            manifest.circuits[circuitName].versions = manifest.circuits[circuitName].versions
                .filter(v => !versionsToDelete.includes(v));
        }

        manifest.lastUpdated = new Date().toISOString();
        this.saveManifest(manifest);

        this.log(`Cleaned up ${versionsToDelete.length} old versions`, 'success');
    }

    loadManifest() {
        try {
            return JSON.parse(fs.readFileSync(this.manifestFile, 'utf8'));
        } catch (error) {
            throw new Error(`Failed to load circuit manifest: ${error.message}`);
        }
    }

    saveManifest(manifest) {
        fs.writeFileSync(this.manifestFile, JSON.stringify(manifest, null, 2));
    }
}

// CLI interface
if (require.main === module) {
    const manager = new CircuitManager();
    const command = process.argv[2];
    const args = process.argv.slice(3);

    async function runCommand() {
        await manager.initializeManager();

        switch (command) {
            case 'version':
                const circuitName = args[0] || 'access-control';
                await manager.versionArtifacts(circuitName);
                break;

            case 'verify':
                const version = args[0] || manager.currentVersion;
                await manager.verifyArtifacts(version);
                break;

            case 'list':
                await manager.listVersions();
                break;

            case 'deploy':
                const deployVersion = args[0];
                const targetDir = args[1];
                if (!deployVersion || !targetDir) {
                    console.error('Usage: circuit-manager.js deploy <version> <target-dir>');
                    process.exit(1);
                }
                await manager.deployVersion(deployVersion, targetDir);
                break;

            case 'migrate':
                const fromVersion = args[0];
                const toVersion = args[1];
                if (!fromVersion || !toVersion) {
                    console.error('Usage: circuit-manager.js migrate <from-version> <to-version>');
                    process.exit(1);
                }
                await manager.migrateVersion(fromVersion, toVersion);
                break;

            case 'cleanup':
                const keepCount = parseInt(args[0]) || 5;
                await manager.cleanupOldVersions(keepCount);
                break;

            default:
                console.log('Available commands:');
                console.log('  version [circuit-name]     - Version current artifacts');
                console.log('  verify [version]           - Verify artifacts for version');
                console.log('  list                       - List all versions');
                console.log('  deploy <version> <dir>     - Deploy version to directory');
                console.log('  migrate <from> <to>        - Create migration report');
                console.log('  cleanup [keep-count]       - Clean up old versions');
                break;
        }
    }

    runCommand().catch(error => {
        console.error('Command failed:', error.message);
        process.exit(1);
    });
}

module.exports = CircuitManager;