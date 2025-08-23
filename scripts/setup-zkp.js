#!/usr/bin/env node

/**
 * ZKP Infrastructure Setup Script
 * 
 * This script sets up the complete ZKP infrastructure including:
 * - Circuit compilation
 * - Key generation
 * - Public directory setup for browser access
 * - Environment configuration
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

const PROJECT_ROOT = path.join(__dirname, '..');
const CIRCUITS_DIR = path.join(PROJECT_ROOT, 'circuits');
const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public');
const CIRCUITS_PUBLIC_DIR = path.join(PUBLIC_DIR, 'circuits');

async function ensureDirectories() {
    console.log('📁 Creating necessary directories...');

    const dirs = [
        CIRCUITS_PUBLIC_DIR,
        path.join(CIRCUITS_DIR, 'compiled'),
        path.join(CIRCUITS_DIR, 'keys')
    ];

    for (const dir of dirs) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`✅ Created directory: ${dir}`);
        }
    }
}

async function compileCircuits() {
    console.log('\n🔧 Compiling ZK circuits...');

    try {
        const { stdout, stderr } = await execAsync('npm run compile', {
            cwd: CIRCUITS_DIR
        });

        if (stderr) {
            console.warn('⚠️ Compilation warnings:', stderr);
        }

        console.log('✅ Circuits compiled successfully');
        console.log(stdout);
    } catch (error) {
        console.error('❌ Circuit compilation failed:', error.message);
        throw error;
    }
}

async function generateKeys() {
    console.log('\n🔑 Generating proving and verification keys...');

    try {
        const { stdout, stderr } = await execAsync('npm run generate-keys-dev', {
            cwd: CIRCUITS_DIR
        });

        if (stderr) {
            console.warn('⚠️ Key generation warnings:', stderr);
        }

        console.log('✅ Keys generated successfully');
        console.log(stdout);
    } catch (error) {
        console.error('❌ Key generation failed:', error.message);
        throw error;
    }
}

async function copyFilesToPublic() {
    console.log('\n📋 Copying circuit files to public directory...');

    const circuits = ['access_verification', 'record_sharing'];

    for (const circuit of circuits) {
        try {
            // Copy WASM files
            const wasmSrc = path.join(CIRCUITS_DIR, 'compiled', circuit, `${circuit}.wasm`);
            const wasmDest = path.join(CIRCUITS_PUBLIC_DIR, `${circuit}.wasm`);

            if (fs.existsSync(wasmSrc)) {
                fs.copyFileSync(wasmSrc, wasmDest);
                console.log(`✅ Copied ${circuit}.wasm`);
            } else {
                console.warn(`⚠️ WASM file not found: ${wasmSrc}`);
            }

            // Copy zkey files
            const zkeySrc = path.join(CIRCUITS_DIR, 'keys', `${circuit}.zkey`);
            const zkeyDest = path.join(CIRCUITS_PUBLIC_DIR, `${circuit}.zkey`);

            if (fs.existsSync(zkeySrc)) {
                fs.copyFileSync(zkeySrc, zkeyDest);
                console.log(`✅ Copied ${circuit}.zkey`);
            } else {
                console.warn(`⚠️ zkey file not found: ${zkeySrc}`);
            }

            // Copy verification key files
            const vkeySrc = path.join(CIRCUITS_DIR, 'keys', `${circuit}_verification_key.json`);
            const vkeyDest = path.join(CIRCUITS_PUBLIC_DIR, `${circuit}_verification_key.json`);

            if (fs.existsSync(vkeySrc)) {
                fs.copyFileSync(vkeySrc, vkeyDest);
                console.log(`✅ Copied ${circuit}_verification_key.json`);
            } else {
                console.warn(`⚠️ Verification key file not found: ${vkeySrc}`);
            }

        } catch (error) {
            console.error(`❌ Failed to copy files for ${circuit}:`, error.message);
        }
    }
}

async function updateEnvironmentConfig() {
    console.log('\n⚙️ Updating environment configuration...');

    const envPath = path.join(PROJECT_ROOT, '.env');
    const exampleEnvPath = path.join(PROJECT_ROOT, 'example.env');

    // Read existing .env or create from example
    let envContent = '';
    if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
    } else if (fs.existsSync(exampleEnvPath)) {
        envContent = fs.readFileSync(exampleEnvPath, 'utf8');
    }

    // Add ZKP configuration if not present
    const zkpConfig = `
# ZKP Configuration
ZKP_CIRCUIT_PATH=/circuits
ZKP_PROVING_KEY_PATH=/circuits/keys
ZKP_VERIFICATION_KEY_PATH=/circuits/keys
ZKP_WASM_PATH=/circuits
ZKP_ENABLED=true
`;

    if (!envContent.includes('ZKP_CIRCUIT_PATH')) {
        envContent += zkpConfig;
        fs.writeFileSync(envPath, envContent);
        console.log('✅ Updated .env with ZKP configuration');
    } else {
        console.log('✅ ZKP configuration already present in .env');
    }
}

async function testCircuits() {
    console.log('\n🧪 Running circuit tests...');

    try {
        const { stdout, stderr } = await execAsync('npm test', {
            cwd: CIRCUITS_DIR
        });

        if (stderr) {
            console.warn('⚠️ Test warnings:', stderr);
        }

        console.log('✅ Circuit tests passed');
        console.log(stdout);
    } catch (error) {
        console.error('❌ Circuit tests failed:', error.message);
        console.log('⚠️ Continuing setup despite test failures...');
    }
}

async function createNextConfigUpdates() {
    console.log('\n⚙️ Checking Next.js configuration for WASM support...');

    const nextConfigPath = path.join(PROJECT_ROOT, 'next.config.ts');

    if (fs.existsSync(nextConfigPath)) {
        const configContent = fs.readFileSync(nextConfigPath, 'utf8');

        if (!configContent.includes('webpack')) {
            console.log('📝 Next.js config may need WASM support. Consider adding:');
            console.log(`
webpack: (config) => {
  config.experiments = {
    ...config.experiments,
    asyncWebAssembly: true,
  };
  return config;
},
`);
        } else {
            console.log('✅ Next.js config appears to have webpack configuration');
        }
    }
}

async function main() {
    console.log('🚀 Setting up ZKP infrastructure...\n');

    try {
        await ensureDirectories();
        await compileCircuits();
        await generateKeys();
        await copyFilesToPublic();
        await updateEnvironmentConfig();
        await testCircuits();
        await createNextConfigUpdates();

        console.log('\n🎉 ZKP infrastructure setup completed successfully!');
        console.log('\n📝 Next steps:');
        console.log('1. Review the generated .env file and update as needed');
        console.log('2. Ensure your Next.js config supports WASM if needed');
        console.log('3. Test the ZKP service in your application');
        console.log('4. Deploy the verifier contracts to your blockchain');

    } catch (error) {
        console.error('\n❌ ZKP infrastructure setup failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = {
    ensureDirectories,
    compileCircuits,
    generateKeys,
    copyFilesToPublic,
    updateEnvironmentConfig
};