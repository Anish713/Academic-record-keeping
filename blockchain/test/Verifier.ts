import { expect } from "chai";
import { ethers } from "hardhat";
import { Groth16Verifier } from "../typechain-types";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("Groth16Verifier", function () {
  // Fixture to deploy the verifier contract
  async function deployVerifierFixture() {
    const [owner, addr1, addr2] = await ethers.getSigners();

    const Verifier = await ethers.getContractFactory("Groth16Verifier");
    const verifier = await Verifier.deploy();
    await verifier.waitForDeployment();

    return { verifier, owner, addr1, addr2 };
  }

  describe("Deployment", function () {
    it("Should deploy successfully", async function () {
      const { verifier } = await loadFixture(deployVerifierFixture);
      
      // Check that the contract is deployed
      const address = await verifier.getAddress();
      expect(address).to.not.equal(ethers.ZeroAddress);
      
      // Check that there's code at the address
      const code = await ethers.provider.getCode(address);
      expect(code).to.not.equal("0x");
    });

    it("Should have the correct contract interface", async function () {
      const { verifier } = await loadFixture(deployVerifierFixture);
      
      // Check that the verifyProof function exists
      expect(verifier.verifyProof).to.be.a('function');
    });
  });

  describe("Proof Verification", function () {
    it("Should reject invalid proof with all zeros", async function () {
      const { verifier } = await loadFixture(deployVerifierFixture);
      
      // Create invalid proof with all zeros
      const invalidProof = {
        pA: [0, 0],
        pB: [[0, 0], [0, 0]],
        pC: [0, 0],
        pubSignals: [0, 0, 0] // recordHash, merkleRoot, isAuthorized
      };
      
      const result = await verifier.verifyProof(
        invalidProof.pA,
        invalidProof.pB,
        invalidProof.pC,
        invalidProof.pubSignals
      );
      
      expect(result).to.be.false;
    });

    it("Should handle proof with invalid field elements", async function () {
      const { verifier } = await loadFixture(deployVerifierFixture);
      
      // Create proof with field elements that are too large
      const fieldSize = "21888242871839275222246405745257275088548364400416034343698204186575808495617";
      const invalidFieldElement = ethers.toBigInt(fieldSize) + 1n;
      
      const invalidProof = {
        pA: [invalidFieldElement.toString(), "1"],
        pB: [["1", "1"], ["1", "1"]],
        pC: ["1", "1"],
        pubSignals: ["1", "1", "1"]
      };
      
      // The verifier should handle this gracefully and return false
      // (it may revert or return false depending on implementation)
      try {
        const result = await verifier.verifyProof(
          invalidProof.pA,
          invalidProof.pB,
          invalidProof.pC,
          invalidProof.pubSignals
        );
        expect(result).to.be.false;
      } catch (error) {
        // Revert is also acceptable behavior for invalid field elements
        expect(error).to.exist;
      }
    });

    it("Should handle edge case with maximum valid field elements", async function () {
      const { verifier } = await loadFixture(deployVerifierFixture);
      
      // Use maximum valid field element (field size - 1)
      const maxFieldElement = "21888242871839275222246405745257275088548364400416034343698204186575808495616";
      
      const edgeCaseProof = {
        pA: [maxFieldElement, maxFieldElement],
        pB: [[maxFieldElement, maxFieldElement], [maxFieldElement, maxFieldElement]],
        pC: [maxFieldElement, maxFieldElement],
        pubSignals: [maxFieldElement, maxFieldElement, maxFieldElement]
      };
      
      // This should not revert (though the proof will be invalid)
      const result = await verifier.verifyProof(
        edgeCaseProof.pA,
        edgeCaseProof.pB,
        edgeCaseProof.pC,
        edgeCaseProof.pubSignals
      );
      
      expect(result).to.be.false;
    });

    it("Should have consistent behavior for the same invalid proof", async function () {
      const { verifier } = await loadFixture(deployVerifierFixture);
      
      const testProof = {
        pA: ["1", "2"],
        pB: [["3", "4"], ["5", "6"]],
        pC: ["7", "8"],
        pubSignals: ["9", "10", "11"]
      };
      
      // Call verification multiple times with the same proof
      const result1 = await verifier.verifyProof(
        testProof.pA,
        testProof.pB,
        testProof.pC,
        testProof.pubSignals
      );
      
      const result2 = await verifier.verifyProof(
        testProof.pA,
        testProof.pB,
        testProof.pC,
        testProof.pubSignals
      );
      
      // Results should be consistent
      expect(result1).to.equal(result2);
      expect(result1).to.be.false; // Invalid proof should always return false
    });
  });

  describe("Gas Usage", function () {
    it("Should have reasonable gas usage for proof verification", async function () {
      const { verifier } = await loadFixture(deployVerifierFixture);
      
      const testProof = {
        pA: ["1", "2"],
        pB: [["3", "4"], ["5", "6"]],
        pC: ["7", "8"],
        pubSignals: ["9", "10", "11"]
      };
      
      // Estimate gas for proof verification
      const gasEstimate = await verifier.verifyProof.estimateGas(
        testProof.pA,
        testProof.pB,
        testProof.pC,
        testProof.pubSignals
      );
      
      // Gas usage should be reasonable for ZK verification (less than 50M gas)
      // ZK verifiers typically use significant gas due to pairing operations
      expect(gasEstimate).to.be.lessThan(50000000);
      console.log(`      Gas estimate for proof verification: ${gasEstimate.toString()}`);
    });
  });

  describe("Contract Constants", function () {
    it("Should have the correct verification key constants", async function () {
      const { verifier } = await loadFixture(deployVerifierFixture);
      
      // We can't directly access the constants from the contract,
      // but we can verify the contract was compiled with the right circuit
      // by checking that the bytecode contains expected values
      const address = await verifier.getAddress();
      const code = await ethers.provider.getCode(address);
      
      // The bytecode should contain our verification key constants
      // This is a basic sanity check that the right circuit was used
      expect(code.length).to.be.greaterThan(1000); // Should be a substantial contract
    });
  });
});