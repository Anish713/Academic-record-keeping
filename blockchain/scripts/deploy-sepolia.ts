import { ethers } from "hardhat";
import fs from "fs";
import path from "path";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: "../../.env" });

interface DeploymentConfig {
    network: 'sepolia';
    rpcUrl: string;
    privateKey: string;
    infuraApiKey: string;
    etherscanApiKey: string;
    gasLimit: number;
    gasPrice: number;
    confirmations: number;
}

interface ContractDeployment {
    contractName: string;
    address: string;
    transactionHash: string;
    blockNumber: number;
    gasUsed: number;
    deployedAt: string;
    verified: boolean;
}

interface DeploymentReport {
    network: string;
    chainId: number;
    timestamp: string;
    deployer: string;
    totalGasUsed: number;
    contracts: {
        verifier: ContractDeployment;
        zkAccessControl: ContractDeployment;
        recordStorage: ContractDeployment;
        academicRecords: ContractDeployment;
        studentManagement: {
            address: string;
            retrievedFrom: string;
        };
    };
    environmentUpdates: {
        [key: string]: string;
    };
    verificationResults: {
        [contractName: string]: boolean;
    };
}

class SepoliaDeploymentOrchestrator {
    private config: DeploymentConfig;
    private deployer: any;
    private deploymentReport: Partial<DeploymentReport> = {};
    private totalGasUsed = 0;

    constructor() {
        this.config = this.loadConfiguration();
    }

    /**
     * Load and validate deployment configuration
     */
    private loadConfiguration(): DeploymentConfig {
        const requiredEnvVars = [
            'PRIVATE_KEY',
            'INFURA_API_KEY',
            'ETHERSCAN_API_KEY'
        ];

        const missing = requiredEnvVars.filter(varName => !process.env[varName]);
        if (missing.length > 0) {
            throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
        }

        return {
            network: 'sepolia',
            rpcUrl: `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`,
            privateKey: process.env.PRIVATE_KEY!,
            infuraApiKey: process.env.INFURA_API_KEY!,
            etherscanApiKey: process.env.ETHERSCAN_API_KEY!,
            gasLimit: parseInt(process.env.DEPLOYMENT_GAS_LIMIT || '8000000'),
            gasPrice: parseInt(process.env.DEPLOYMENT_GAS_PRICE || '20000000000'),
            confirmations: parseInt(process.env.DEPLOYMENT_CONFIRMATIONS || '2')
        };
    }

    /**
     * Validate prerequisites before deployment
     */
    private async validatePrerequisites(): Promise<void> {
        this.log('🔍 Validating deployment prerequisites...', 'info');

        // Check network connectivity
        try {
            const network = await ethers.provider.getNetwork();
            if (network.chainId !== 11155111n) {
                throw new Error(`Expected Sepolia network (11155111), got ${network.chainId}`);
            }
            this.log(`✅ Connected to Sepolia network (Chain ID: ${network.chainId})`, 'success');
        } catch (error) {
            throw new Error(`Network connectivity check failed: ${error.message}`);
        }

        // Validate deployer account
        const [deployer] = await ethers.getSigners();
        this.deployer = deployer;

        if (!deployer.address) {
            throw new Error('No deployer account available');
        }

        // Check account balance
        const balance = await ethers.provider.getBalance(deployer.address);
        const balanceEth = ethers.formatEther(balance);
        const minBalance = 0.1; // Minimum 0.1 ETH required

        if (parseFloat(balanceEth) < minBalance) {
            throw new Error(`Insufficient balance: ${balanceEth} ETH (minimum ${minBalance} ETH required)`);
        }

        this.log(`✅ Deployer account: ${deployer.address}`, 'success');
        this.log(`✅ Account balance: ${balanceEth} ETH`, 'success');

        // Test Infura API key
        try {
            await ethers.provider.getBlockNumber();
            this.log('✅ Infura API key validated', 'success');
        } catch (error) {
            throw new Error(`Infura API key validation failed: ${error.message}`);
        }

        this.log('✅ All prerequisites validated successfully', 'success');
    }

    /**
     * Deploy Groth16Verifier contract
     */
    private async deployVerifier(): Promise<ContractDeployment> {
        this.log('🚀 Deploying Groth16Verifier contract...', 'info');

        try {
            const VerifierFactory = await ethers.getContractFactory("Groth16Verifier");

            const verifier = await VerifierFactory.deploy({
                gasLimit: this.config.gasLimit,
                gasPrice: this.config.gasPrice
            });

            const receipt = await verifier.deploymentTransaction()?.wait(this.config.confirmations);
            if (!receipt) {
                throw new Error('Failed to get deployment receipt');
            }

            const address = await verifier.getAddress();

            // Verify contract code exists
            const code = await ethers.provider.getCode(address);
            if (code === "0x") {
                throw new Error('Contract deployment failed - no code at address');
            }

            const deployment: ContractDeployment = {
                contractName: 'Groth16Verifier',
                address,
                transactionHash: receipt.hash,
                blockNumber: receipt.blockNumber,
                gasUsed: Number(receipt.gasUsed),
                deployedAt: new Date().toISOString(),
                verified: true
            };

            this.totalGasUsed += deployment.gasUsed;
            this.log(`✅ Groth16Verifier deployed to: ${address}`, 'success');
            this.log(`   Gas used: ${deployment.gasUsed.toLocaleString()}`, 'info');

            return deployment;
        } catch (error) {
            this.log(`❌ Verifier deployment failed: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Deploy ZKAccessControl contract
     */
    private async deployZKAccessControl(verifierAddress: string): Promise<ContractDeployment> {
        this.log('🚀 Deploying ZKAccessControl contract...', 'info');

        try {
            const ZKAccessControlFactory = await ethers.getContractFactory("ZKAccessControl");

            const zkAccessControl = await ZKAccessControlFactory.deploy(verifierAddress, {
                gasLimit: this.config.gasLimit,
                gasPrice: this.config.gasPrice
            });

            const receipt = await zkAccessControl.deploymentTransaction()?.wait(this.config.confirmations);
            if (!receipt) {
                throw new Error('Failed to get deployment receipt');
            }

            const address = await zkAccessControl.getAddress();

            // Verify deployment
            const storedVerifierAddress = await zkAccessControl.verifier();
            if (storedVerifierAddress.toLowerCase() !== verifierAddress.toLowerCase()) {
                throw new Error(`Verifier address mismatch: expected ${verifierAddress}, got ${storedVerifierAddress}`);
            }

            const deployment: ContractDeployment = {
                contractName: 'ZKAccessControl',
                address,
                transactionHash: receipt.hash,
                blockNumber: receipt.blockNumber,
                gasUsed: Number(receipt.gasUsed),
                deployedAt: new Date().toISOString(),
                verified: true
            };

            this.totalGasUsed += deployment.gasUsed;
            this.log(`✅ ZKAccessControl deployed to: ${address}`, 'success');
            this.log(`   Verifier address: ${storedVerifierAddress}`, 'info');
            this.log(`   Gas used: ${deployment.gasUsed.toLocaleString()}`, 'info');

            return deployment;
        } catch (error) {
            this.log(`❌ ZKAccessControl deployment failed: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Deploy RecordStorage library
     */
    private async deployRecordStorage(): Promise<ContractDeployment> {
        this.log('🚀 Deploying RecordStorage library...', 'info');

        try {
            const RecordStorageFactory = await ethers.getContractFactory("RecordStorage");

            const recordStorage = await RecordStorageFactory.deploy({
                gasLimit: this.config.gasLimit,
                gasPrice: this.config.gasPrice
            });

            const receipt = await recordStorage.deploymentTransaction()?.wait(this.config.confirmations);
            if (!receipt) {
                throw new Error('Failed to get deployment receipt');
            }

            const address = await recordStorage.getAddress();

            // Verify contract code exists
            const code = await ethers.provider.getCode(address);
            if (code === "0x") {
                throw new Error('Library deployment failed - no code at address');
            }

            const deployment: ContractDeployment = {
                contractName: 'RecordStorage',
                address,
                transactionHash: receipt.hash,
                blockNumber: receipt.blockNumber,
                gasUsed: Number(receipt.gasUsed),
                deployedAt: new Date().toISOString(),
                verified: true
            };

            this.totalGasUsed += deployment.gasUsed;
            this.log(`✅ RecordStorage library deployed to: ${address}`, 'success');
            this.log(`   Gas used: ${deployment.gasUsed.toLocaleString()}`, 'info');

            return deployment;
        } catch (error) {
            this.log(`❌ RecordStorage deployment failed: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Deploy AcademicRecords contract with library linking
     */
    private async deployAcademicRecords(recordStorageAddress: string): Promise<ContractDeployment> {
        this.log('🚀 Deploying AcademicRecords contract...', 'info');

        try {
            const AcademicRecordsFactory = await ethers.getContractFactory("AcademicRecords", {
                libraries: {
                    RecordStorage: recordStorageAddress,
                },
            });

            const academicRecords = await AcademicRecordsFactory.deploy({
                gasLimit: this.config.gasLimit,
                gasPrice: this.config.gasPrice
            });

            const receipt = await academicRecords.deploymentTransaction()?.wait(this.config.confirmations);
            if (!receipt) {
                throw new Error('Failed to get deployment receipt');
            }

            const address = await academicRecords.getAddress();

            // Verify basic functionality
            const totalRecords = await academicRecords.getTotalRecords();
            const totalCustomTypes = await academicRecords.getTotalCustomTypes();

            this.log(`   Initial total records: ${totalRecords.toString()}`, 'info');
            this.log(`   Initial total custom types: ${totalCustomTypes.toString()}`, 'info');

            const deployment: ContractDeployment = {
                contractName: 'AcademicRecords',
                address,
                transactionHash: receipt.hash,
                blockNumber: receipt.blockNumber,
                gasUsed: Number(receipt.gasUsed),
                deployedAt: new Date().toISOString(),
                verified: true
            };

            this.totalGasUsed += deployment.gasUsed;
            this.log(`✅ AcademicRecords deployed to: ${address}`, 'success');
            this.log(`   Gas used: ${deployment.gasUsed.toLocaleString()}`, 'info');

            return deployment;
        } catch (error) {
            this.log(`❌ AcademicRecords deployment failed: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Retrieve StudentManagement contract address
     */
    private async getStudentManagementAddress(academicRecordsAddress: string): Promise<{ address: string; retrievedFrom: string }> {
        this.log('🔍 Retrieving StudentManagement contract address...', 'info');

        try {
            const academicRecords = await ethers.getContractAt("AcademicRecords", academicRecordsAddress);
            const studentManagementAddress = await academicRecords.studentManagement();

            // Verify the address is valid
            const code = await ethers.provider.getCode(studentManagementAddress);
            if (code === "0x") {
                throw new Error('StudentManagement contract not found at retrieved address');
            }

            this.log(`✅ StudentManagement address: ${studentManagementAddress}`, 'success');

            return {
                address: studentManagementAddress,
                retrievedFrom: academicRecordsAddress
            };
        } catch (error) {
            this.log(`❌ Failed to retrieve StudentManagement address: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Perform comprehensive deployment verification
     */
    private async verifyDeployments(contracts: any): Promise<{ [contractName: string]: boolean }> {
        this.log('🔍 Performing comprehensive deployment verification...', 'info');

        const verificationResults: { [contractName: string]: boolean } = {};

        try {
            // Verify Groth16Verifier
            const verifierCode = await ethers.provider.getCode(contracts.verifier.address);
            verificationResults['Groth16Verifier'] = verifierCode !== "0x";

            // Verify ZKAccessControl
            const zkAccessControl = await ethers.getContractAt("ZKAccessControl", contracts.zkAccessControl.address);
            const verifierAddress = await zkAccessControl.verifier();
            const isPaused = await zkAccessControl.paused();
            verificationResults['ZKAccessControl'] =
                verifierAddress.toLowerCase() === contracts.verifier.address.toLowerCase() &&
                typeof isPaused === 'boolean';

            // Verify RecordStorage
            const recordStorageCode = await ethers.provider.getCode(contracts.recordStorage.address);
            verificationResults['RecordStorage'] = recordStorageCode !== "0x";

            // Verify AcademicRecords
            const academicRecords = await ethers.getContractAt("AcademicRecords", contracts.academicRecords.address);
            const totalRecords = await academicRecords.getTotalRecords();
            const superAdmin = await academicRecords.SUPER_ADMIN();
            verificationResults['AcademicRecords'] =
                typeof totalRecords === 'bigint' &&
                superAdmin === this.deployer.address;

            // Verify StudentManagement
            const studentManagementCode = await ethers.provider.getCode(contracts.studentManagement.address);
            verificationResults['StudentManagement'] = studentManagementCode !== "0x";

            const allVerified = Object.values(verificationResults).every(result => result === true);

            if (allVerified) {
                this.log('✅ All contracts verified successfully', 'success');
            } else {
                this.log('⚠️ Some contract verifications failed', 'warning');
                Object.entries(verificationResults).forEach(([name, result]) => {
                    this.log(`   ${name}: ${result ? '✅' : '❌'}`, result ? 'success' : 'error');
                });
            }

            return verificationResults;
        } catch (error) {
            this.log(`❌ Verification failed: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Update environment variables with deployed contract addresses
     */
    private async updateEnvironmentVariables(contracts: any): Promise<{ [key: string]: string }> {
        this.log('🔧 Updating environment variables...', 'info');

        const environmentUpdates = {
            'NEXT_PUBLIC_CONTRACT_ADDRESS': contracts.academicRecords.address,
            'NEXT_PUBLIC_STUDENT_MANAGEMENT_CONTRACT_ADDRESS': contracts.studentManagement.address,
            'NEXT_PUBLIC_ZK_ACCESS_CONTROL_CONTRACT_ADDRESS': contracts.zkAccessControl.address,
            'NEXT_PUBLIC_ZK_VERIFIER_CONTRACT_ADDRESS': contracts.verifier.address,
            'NEXT_PUBLIC_NETWORK_ID': '11155111',
            'NEXT_PUBLIC_RPC_URL': `https://sepolia.infura.io/v3/${this.config.infuraApiKey}`,
            'DEPLOYMENT_NETWORK': 'sepolia'
        };

        try {
            // Create deployment info for the update script
            const deploymentInfo = {
                network: 'sepolia',
                timestamp: new Date().toISOString(),
                superAdmin: this.deployer.address,
                contracts: {
                    RecordStorage: contracts.recordStorage.address,
                    AcademicRecords: contracts.academicRecords.address,
                    StudentManagement: contracts.studentManagement.address,
                },
                zkAccessControl: contracts.zkAccessControl.address,
                verifier: contracts.verifier.address
            };

            // Save deployment info
            const deploymentInfoPath = path.join(__dirname, '../deployment-info.json');
            fs.writeFileSync(deploymentInfoPath, JSON.stringify(deploymentInfo, null, 2));

            // Use existing environment update script
            const { execSync } = require('child_process');
            execSync(`node ../../scripts/update-env-contracts.js update sepolia`, {
                stdio: 'inherit',
                cwd: __dirname
            });

            this.log('✅ Environment variables updated successfully', 'success');
            return environmentUpdates;
        } catch (error) {
            this.log(`❌ Failed to update environment variables: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Generate comprehensive deployment report
     */
    private generateDeploymentReport(
        contracts: any,
        environmentUpdates: { [key: string]: string },
        verificationResults: { [contractName: string]: boolean }
    ): DeploymentReport {
        const report: DeploymentReport = {
            network: 'sepolia',
            chainId: 11155111,
            timestamp: new Date().toISOString(),
            deployer: this.deployer.address,
            totalGasUsed: this.totalGasUsed,
            contracts,
            environmentUpdates,
            verificationResults
        };

        // Save report to file
        const reportPath = path.join(__dirname, '../sepolia-deployment-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

        this.log(`📋 Deployment report saved to: ${reportPath}`, 'success');
        return report;
    }

    /**
     * Main deployment orchestration method
     */
    async deployToSepolia(): Promise<DeploymentReport> {
        const startTime = Date.now();

        try {
            this.log('🚀 Starting Sepolia deployment orchestration...', 'info');

            // Step 1: Validate prerequisites
            await this.validatePrerequisites();

            // Step 2: Deploy contracts in dependency order
            this.log('📋 Deploying contracts in dependency order...', 'info');

            // Deploy Groth16Verifier
            const verifierDeployment = await this.deployVerifier();

            // Deploy ZKAccessControl with verifier address
            const zkAccessControlDeployment = await this.deployZKAccessControl(verifierDeployment.address);

            // Deploy RecordStorage library
            const recordStorageDeployment = await this.deployRecordStorage();

            // Deploy AcademicRecords with library linking
            const academicRecordsDeployment = await this.deployAcademicRecords(recordStorageDeployment.address);

            // Retrieve StudentManagement address
            const studentManagement = await this.getStudentManagementAddress(academicRecordsDeployment.address);

            const contracts = {
                verifier: verifierDeployment,
                zkAccessControl: zkAccessControlDeployment,
                recordStorage: recordStorageDeployment,
                academicRecords: academicRecordsDeployment,
                studentManagement
            };

            // Step 3: Verify all deployments
            const verificationResults = await this.verifyDeployments(contracts);

            // Step 4: Update environment variables
            const environmentUpdates = await this.updateEnvironmentVariables(contracts);

            // Step 5: Generate deployment report
            const report = this.generateDeploymentReport(contracts, environmentUpdates, verificationResults);

            const duration = (Date.now() - startTime) / 1000;
            this.log(`🎉 Sepolia deployment completed successfully in ${duration.toFixed(2)}s`, 'success');
            this.log(`💰 Total gas used: ${this.totalGasUsed.toLocaleString()}`, 'info');

            return report;

        } catch (error) {
            const duration = (Date.now() - startTime) / 1000;
            this.log(`💥 Deployment failed after ${duration.toFixed(2)}s: ${error.message}`, 'error');
            this.log('🔄 Please check the error above and retry deployment', 'info');
            throw error;
        }
    }

    /**
     * Logging utility with timestamps and formatting
     */
    private log(message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info'): void {
        const timestamp = new Date().toISOString();
        const prefix = {
            info: '🔧',
            success: '✅',
            error: '❌',
            warning: '⚠️'
        }[type];

        console.log(`${prefix} [${timestamp}] ${message}`);
    }
}

/**
 * Main execution function
 */
async function main() {
    const orchestrator = new SepoliaDeploymentOrchestrator();

    try {
        const report = await orchestrator.deployToSepolia();

        console.log('\n📋 DEPLOYMENT SUMMARY:');
        console.log('='.repeat(50));
        console.log(`Network: ${report.network} (Chain ID: ${report.chainId})`);
        console.log(`Deployer: ${report.deployer}`);
        console.log(`Total Gas Used: ${report.totalGasUsed.toLocaleString()}`);
        console.log('\n📍 Contract Addresses:');
        console.log(`  Groth16Verifier: ${report.contracts.verifier.address}`);
        console.log(`  ZKAccessControl: ${report.contracts.zkAccessControl.address}`);
        console.log(`  RecordStorage: ${report.contracts.recordStorage.address}`);
        console.log(`  AcademicRecords: ${report.contracts.academicRecords.address}`);
        console.log(`  StudentManagement: ${report.contracts.studentManagement.address}`);
        console.log('\n🔍 Verification Results:');
        Object.entries(report.verificationResults).forEach(([name, result]) => {
            console.log(`  ${name}: ${result ? '✅ Verified' : '❌ Failed'}`);
        });
        console.log('='.repeat(50));

        process.exit(0);
    } catch (error) {
        console.error('\n💥 DEPLOYMENT FAILED:');
        console.error('='.repeat(50));
        console.error(error.message);
        console.error('='.repeat(50));
        process.exit(1);
    }
}

// Execute if run directly
if (require.main === module) {
    main();
}

export { SepoliaDeploymentOrchestrator };