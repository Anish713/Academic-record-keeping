# ZK Access Control Circuit

This directory contains the Zero Knowledge Proof circuit for document access control in the blockchain-based academic records system.

## Circuit Overview

The `access-control.circom` circuit implements a privacy-preserving access control mechanism that allows users to prove they have access to a document without revealing their credentials or the document's location.

### Circuit Inputs

**Private Inputs:**
- `userAddress`: The user's wallet address (as field element)
- `recordId`: The ID of the record being accessed
- `accessKey`: A secret key proving access rights
- `timestamp`: Current timestamp for replay protection
- `pathElements[10]`: Merkle proof path elements
- `pathIndices[10]`: Merkle proof path indices

**Public Inputs:**
- `recordHash`: Hash of the record being accessed
- `merkleRoot`: Root of the Merkle tree containing access rights

**Output:**
- `isAuthorized`: Boolean indicating if access is granted (1) or denied (0)

### Circuit Logic

1. **Credential Hashing**: Uses Poseidon hash to combine user address, record ID, access key, and timestamp
2. **Merkle Tree Verification**: Verifies the credential hash exists in the access rights Merkle tree
3. **Record Validation**: Ensures the record hash matches the expected value
4. **Authorization**: Grants access only if both Merkle proof and record hash are valid

### Circuit Statistics

- Template instances: 150
- Non-linear constraints: 2,998
- Linear constraints: 3,452
- Private inputs: 26
- Public inputs: 2
- Public outputs: 1
- Total wires: 6,477

## Build Scripts

### Compilation
```bash
npm run compile:circuits
# or
cd circuits && ./compile.sh
```

### Trusted Setup
```bash
npm run setup:circuits
# or
cd circuits && ./setup.sh
```

### Testing
```bash
npm run test:circuits
# or
cd circuits && ./test-circuit.sh
```

## Generated Files

After running the build process, the following files are generated:

- `public/circuits/access-control.r1cs` - Circuit constraints
- `public/circuits/access-control_js/access-control.wasm` - WebAssembly witness generator
- `public/circuits/access-control_0001.zkey` - Proving key
- `public/circuits/verification_key.json` - Verification key
- `blockchain/contracts/verifier.sol` - Solidity verifier contract

## Security Considerations

1. **Trusted Setup**: The circuit uses a Powers of Tau ceremony (2^14) for security
2. **Poseidon Hash**: Uses Poseidon hash function optimized for ZK circuits
3. **Merkle Tree Depth**: Supports up to 10 levels (1024 leaves) for access control
4. **Timestamp Validation**: Includes timestamp for replay attack prevention

## Usage in Application

The circuit is used by:
1. **Frontend**: Generates proofs when users request document access
2. **Smart Contracts**: Verifies proofs on-chain before revealing encrypted IPFS hashes
3. **Backend**: Validates access rights for API endpoints

## Development Notes

- Circuit is written in Circom 2.0.0
- Uses circomlib for standard components (Poseidon, comparators)
- Optimized for constraint count while maintaining security
- Compatible with Groth16 proving system