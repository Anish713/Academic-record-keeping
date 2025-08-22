# ZK Circuit Build and Deployment Pipeline

This document describes the Zero Knowledge (ZK) circuit build and deployment pipeline for the blockchain-based academic records system.

## Overview

The ZK pipeline provides automated tools for:
- Circuit compilation and validation
- Trusted setup ceremony simulation
- Artifact management and versioning
- Contract deployment and integration
- Continuous integration and testing

## Pipeline Components

### 1. Circuit Build System (`scripts/build-circuits.js`)

Automated circuit compilation with the following features:
- Circuit syntax validation
- Constraint analysis and optimization
- Artifact generation and verification
- Performance benchmarking

**Usage:**
```bash
npm run build:circuits
# or
node scripts/build-circuits.js
```

**Outputs:**
- `public/circuits/access-control.r1cs` - Circuit constraints
- `public/circuits/access-control_js/access-control.wasm` - WebAssembly witness generator
- `public/circuits/access-control.sym` - Symbol table
- `public/circuits/circuit-artifacts.json` - Build metadata

### 2. Trusted Setup Ceremony (`scripts/trusted-setup.js`)

Simulates a multi-party trusted setup ceremony for development:
- Phase 1: Powers of Tau ceremony
- Phase 2: Circuit-specific setup
- Verification and validation
- Artifact generation

**Usage:**
```bash
npm run trusted-setup
# or for quick development setup
npm run trusted-setup:quick
```

**Outputs:**
- `public/circuits/access-control_0001.zkey` - Proving key
- `public/circuits/verification_key.json` - Verification key
- `blockchain/contracts/verifier.sol` - Solidity verifier contract
- `public/circuits/ceremony-info.json` - Ceremony metadata

### 3. Artifact Management (`scripts/circuit-manager.js`)

Manages circuit artifacts with versioning and integrity verification:
- Version tracking and compatibility checking
- Checksum verification
- Migration support
- Deployment preparation

**Usage:**
```bash
# Version current artifacts
npm run circuit:version

# Verify artifacts
npm run circuit:verify

# List all versions
npm run circuit:list

# Clean up old versions
npm run circuit:cleanup
```

### 4. ZK System Deployment (`scripts/deploy-zk-system.js`)

Complete ZK system deployment with proper initialization:
- Verifier contract deployment
- ZK Access Control contract deployment
- System integration
- Deployment verification

**Usage:**
```bash
# Deploy to local network
npm run deploy:zk:local

# Deploy with verbose output
npm run deploy:zk:verbose

# Deploy to specific network
node scripts/deploy-zk-system.js --network sepolia
```

### 5. Pipeline Testing (`scripts/test-zk-pipeline.js`)

End-to-end testing of the complete pipeline:
- Circuit compilation testing
- Trusted setup validation
- Artifact management verification
- Contract deployment testing
- Functionality validation

**Usage:**
```bash
# Run complete pipeline tests
npm run test:zk-pipeline

# Run with verbose output
npm run test:zk-pipeline:verbose
```

## CI/CD Integration

The pipeline includes GitHub Actions workflow (`.github/workflows/zk-circuit-ci.yml`) that:

1. **Circuit Validation**
   - Validates circuit syntax
   - Analyzes constraint count
   - Uploads circuit artifacts

2. **Trusted Setup Test**
   - Runs trusted setup ceremony
   - Verifies setup outputs
   - Uploads setup artifacts

3. **Circuit Testing**
   - Tests circuit functionality
   - Validates multiple inputs
   - Ensures proof generation/verification

4. **Contract Integration**
   - Compiles smart contracts
   - Tests verifier contract
   - Validates ZK integration

5. **Artifact Management**
   - Versions circuit artifacts
   - Verifies artifact integrity
   - Uploads versioned artifacts

6. **Performance Analysis**
   - Analyzes circuit metrics
   - Benchmarks proof generation
   - Generates performance reports

## Directory Structure

```
├── scripts/
│   ├── build-circuits.js          # Main build script
│   ├── trusted-setup.js           # Trusted setup ceremony
│   ├── circuit-manager.js         # Artifact management
│   ├── deploy-zk-system.js        # ZK system deployment
│   └── test-zk-pipeline.js        # Pipeline testing
├── circuits/
│   ├── access-control.circom      # Main circuit
│   ├── compile.sh                 # Legacy compile script
│   ├── setup.sh                   # Legacy setup script
│   └── test-circuit.sh            # Legacy test script
├── public/circuits/
│   ├── access-control.r1cs        # Circuit constraints
│   ├── access-control_js/         # WASM witness generator
│   ├── access-control_0001.zkey   # Proving key
│   ├── verification_key.json     # Verification key
│   ├── circuit-artifacts.json    # Build metadata
│   ├── circuit-manifest.json     # Version manifest
│   └── versions/                  # Versioned artifacts
├── blockchain/contracts/
│   └── verifier.sol               # Generated verifier contract
└── .github/workflows/
    └── zk-circuit-ci.yml          # CI/CD pipeline
```

## Environment Variables

Add these variables to your `.env` file:

```bash
# ZK Circuit Configuration
ZK_CIRCUIT_NAME=access-control
ZK_PTAU_POWER=14
ZK_CEREMONY_PARTICIPANTS=3

# Deployment Configuration
INFURA_API_KEY=your_infura_key
PRIVATE_KEY=your_private_key
ETHERSCAN_API_KEY=your_etherscan_key
```

## Development Workflow

### 1. Circuit Development
```bash
# Edit circuits/access-control.circom
# Build and test
npm run build:circuits
npm run test:circuits
```

### 2. Testing Changes
```bash
# Run complete pipeline test
npm run test:zk-pipeline

# Test specific components
npm run circuit:verify
```

### 3. Deployment
```bash
# Deploy to local network for testing
npm run deploy:zk:local

# Deploy to testnet
node scripts/deploy-zk-system.js --network sepolia
```

### 4. Version Management
```bash
# Version current artifacts
npm run circuit:version

# List versions
npm run circuit:list

# Clean up old versions
npm run circuit:cleanup 5  # Keep 5 most recent
```

## Security Considerations

### Development vs Production

**Development:**
- Uses simulated trusted setup ceremony
- Single-party contributions
- Deterministic randomness for testing

**Production:**
- Requires real multi-party ceremony
- Multiple independent participants
- Secure randomness sources
- Formal verification of circuits

### Best Practices

1. **Circuit Security**
   - Formal verification of circuit logic
   - Constraint optimization
   - Input validation
   - Range checks

2. **Trusted Setup**
   - Multi-party ceremony with independent participants
   - Secure deletion of toxic waste
   - Verification of ceremony integrity
   - Public auditability

3. **Deployment Security**
   - Contract verification on Etherscan
   - Multi-signature deployment
   - Gradual rollout
   - Emergency pause mechanisms

## Troubleshooting

### Common Issues

1. **Circuit Compilation Fails**
   ```bash
   # Check circom installation
   circom --version
   
   # Verify circuit syntax
   circom circuits/access-control.circom --dry-run
   ```

2. **Trusted Setup Fails**
   ```bash
   # Check available memory (setup requires significant RAM)
   free -h
   
   # Use smaller ptau for development
   node scripts/trusted-setup.js --power 12
   ```

3. **Deployment Fails**
   ```bash
   # Check network configuration
   cd blockchain && npx hardhat compile
   
   # Verify contract artifacts exist
   ls -la blockchain/contracts/verifier.sol
   ```

4. **Performance Issues**
   ```bash
   # Analyze circuit constraints
   npx snarkjs r1cs info public/circuits/access-control.r1cs
   
   # Profile proof generation
   time npm run test:circuits
   ```

### Getting Help

1. Check the [circuit documentation](../circuits/README.md)
2. Review the [blockchain documentation](../blockchain/README.md)
3. Run pipeline tests: `npm run test:zk-pipeline:verbose`
4. Check CI/CD logs in GitHub Actions

## Performance Metrics

### Circuit Metrics
- **Constraints**: ~50,000 (target: <100,000)
- **Variables**: ~25,000
- **Public Inputs**: 2

### Timing Benchmarks
- **Circuit Compilation**: ~30 seconds
- **Trusted Setup**: ~2 minutes (development)
- **Witness Generation**: ~100ms
- **Proof Generation**: ~2 seconds
- **Proof Verification**: ~10ms

### Gas Costs
- **Verifier Deployment**: ~2,500,000 gas
- **Proof Verification**: ~300,000 gas per proof

## Future Improvements

1. **Circuit Optimizations**
   - Reduce constraint count
   - Optimize hash functions
   - Batch verification support

2. **Pipeline Enhancements**
   - Parallel circuit compilation
   - Incremental builds
   - Advanced caching

3. **Security Improvements**
   - Formal verification integration
   - Security audit automation
   - Vulnerability scanning

4. **Performance Optimizations**
   - WebAssembly optimization
   - GPU acceleration
   - Proof caching