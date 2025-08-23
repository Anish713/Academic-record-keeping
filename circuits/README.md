# ZK Circuits

This directory contains the Zero Knowledge Proof circuits for the academic records access control system.

## Structure

- `src/` - Circuit source files (.circom)
- `compiled/` - Compiled circuit artifacts (.r1cs, .wasm, .sym)
- `keys/` - Proving and verification keys
- `scripts/` - Circuit compilation and key generation scripts
- `tests/` - Circuit tests

## Development Workflow

1. Write circuits in `src/`
2. Compile circuits using `npm run compile-circuits`
3. Generate keys using `npm run generate-keys`
4. Test circuits using `npm run test-circuits`

## Circuits

### AccessVerification Circuit
Verifies that a user has permission to access a specific record.

### RecordSharing Circuit  
Validates record sharing permissions and generates sharing tokens.