import { expect } from "chai";
import { ethers } from "hardhat";
import { SepoliaDeploymentOrchestrator } from "../scripts/deploy-sepolia";

describe("Sepolia Deployment Orchestrator", function () {
    let orchestrator: SepoliaDeploymentOrchestrator;

    beforeEach(function () {
        // Skip tests if not on localhost/hardhat network
        if (process.env.HARDHAT_NETWORK !== "localhost" && process.env.HARDHAT_NETWORK !== "hardhat") {
            this.skip();
        }
    });

    it("should create orchestrator instance", function () {
        // This test will only run on localhost/hardhat to avoid actual Sepolia calls
        try {
            orchestrator = new SepoliaDeploymentOrchestrator();
            expect(orchestrator).to.be.instanceOf(SepoliaDeploymentOrchestrator);
        } catch (error) {
            // Expected to fail on localhost since it's configured for Sepolia
            expect(error.message).to.include("Missing required environment variables");
        }
    });

    it("should validate contract factories exist", async function () {
        // Test that all required contracts can be compiled
        const contractNames = ['Groth16Verifier', 'ZKAccessControl', 'RecordStorage'];

        for (const contractName of contractNames) {
            const factory = await ethers.getContractFactory(contractName);
            expect(factory).to.not.be.undefined;
        }

        // Test AcademicRecords with library linking
        const RecordStorage = await ethers.getContractFactory("RecordStorage");
        const dummyAddress = "0x0000000000000000000000000000000000000001";

        const AcademicRecords = await ethers.getContractFactory("AcademicRecords", {
            libraries: {
                RecordStorage: dummyAddress,
            },
        });
        expect(AcademicRecords).to.not.be.undefined;
    });

    it("should have proper deployment script structure", function () {
        // Verify the deployment script exports the orchestrator class
        expect(SepoliaDeploymentOrchestrator).to.be.a('function');
        expect(SepoliaDeploymentOrchestrator.prototype.deployToSepolia).to.be.a('function');
    });
});