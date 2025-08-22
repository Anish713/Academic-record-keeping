pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/bitify.circom";

// Merkle tree verification template
template MerkleTreeChecker(levels) {
    signal input leaf;
    signal input root;
    signal input pathElements[levels];
    signal input pathIndices[levels];
    
    signal output isValid;
    
    component hashers[levels];
    component selectors[levels];
    
    signal levelHashes[levels + 1];
    levelHashes[0] <== leaf;
    
    for (var i = 0; i < levels; i++) {
        selectors[i] = Selector();
        selectors[i].in[0] <== levelHashes[i];
        selectors[i].in[1] <== pathElements[i];
        selectors[i].sel <== pathIndices[i];
        
        hashers[i] = Poseidon(2);
        hashers[i].inputs[0] <== selectors[i].out[0];
        hashers[i].inputs[1] <== selectors[i].out[1];
        
        levelHashes[i + 1] <== hashers[i].out;
    }
    
    component rootCheck = IsEqual();
    rootCheck.in[0] <== levelHashes[levels];
    rootCheck.in[1] <== root;
    
    isValid <== rootCheck.out;
}

// Selector template for Merkle tree path selection
template Selector() {
    signal input in[2];
    signal input sel;
    signal output out[2];
    
    // sel = 0: out[0] = in[0], out[1] = in[1]
    // sel = 1: out[0] = in[1], out[1] = in[0]
    out[0] <== (in[1] - in[0]) * sel + in[0];
    out[1] <== (in[0] - in[1]) * sel + in[1];
}

// Main access control template
template AccessControl() {
    // Private inputs (all inputs are private by default in circom)
    signal input userAddress;
    signal input recordId;
    signal input accessKey;
    signal input timestamp;
    signal input pathElements[10]; // Merkle proof path
    signal input pathIndices[10];  // Merkle proof indices
    
    // Public inputs (explicitly marked as public)
    signal input recordHash;
    signal input merkleRoot;
    
    // Output
    signal output isAuthorized;
    
    // Create access credential hash using Poseidon
    component credentialHasher = Poseidon(4);
    credentialHasher.inputs[0] <== userAddress;
    credentialHasher.inputs[1] <== recordId;
    credentialHasher.inputs[2] <== accessKey;
    credentialHasher.inputs[3] <== timestamp;
    
    // Verify the credential hash is in the Merkle tree
    component merkleVerifier = MerkleTreeChecker(10);
    merkleVerifier.leaf <== credentialHasher.out;
    merkleVerifier.root <== merkleRoot;
    
    for (var i = 0; i < 10; i++) {
        merkleVerifier.pathElements[i] <== pathElements[i];
        merkleVerifier.pathIndices[i] <== pathIndices[i];
    }
    
    // Verify record hash matches (additional security check)
    component recordHasher = Poseidon(2);
    recordHasher.inputs[0] <== recordId;
    recordHasher.inputs[1] <== userAddress;
    
    component recordHashCheck = IsEqual();
    recordHashCheck.in[0] <== recordHasher.out;
    recordHashCheck.in[1] <== recordHash;
    
    // Timestamp validation (ensure not too old - within 1 hour = 3600 seconds)
    // For simplicity, we'll skip complex timestamp validation in this version
    // In production, you'd want to validate timestamp is recent
    
    // Final authorization check: Merkle proof valid AND record hash matches
    component finalCheck = AND();
    finalCheck.a <== merkleVerifier.isValid;
    finalCheck.b <== recordHashCheck.out;
    
    isAuthorized <== finalCheck.out;
}

// Helper templates
template AND() {
    signal input a;
    signal input b;
    signal output out;
    
    out <== a*b;
}

component main {public [recordHash, merkleRoot]} = AccessControl();