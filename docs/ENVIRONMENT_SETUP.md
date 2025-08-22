# Environment Configuration Guide

This guide explains how to configure environment variables for the ZK-enhanced blockchain academic records system.

## Quick Start

1. **Copy the example environment file:**
   ```bash
   cp .env.example .env
   ```

2. **Validate your configuration:**
   ```bash
   npm run env:validate
   ```

3. **Update contract addresses after deployment:**
   ```bash
   npm run env:update-contracts
   ```

## Environment Variables Reference

### Blockchain Configuration

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `PRIVATE_KEY` | Private key for deployment account | Yes | `0x123...` |
| `INFURA_API_KEY` | Infura API key for network access | Optional | `abc123...` |
| `ETHERSCAN_API_KEY` | Etherscan API key for verification | Optional | `ABC123...` |
| `NEXT_PUBLIC_NETWORK_ID` | Target network chain ID | Yes | `31337` (localhost), `11155111` (Sepolia) |
| `RPC_URL` | RPC endpoint URL | Optional | `http://localhost:8545` |
| `NEXT_PUBLIC_RPC_URL` | Client-side RPC URL | Optional | `http://localhost:8545` |

### Contract Addresses

These are automatically updated by deployment scripts:

| Variable | Description | Auto-Updated |
|----------|-------------|--------------|
| `NEXT_PUBLIC_CONTRACT_ADDRESS` | Main Academic Records contract | ✅ |
| `NEXT_PUBLIC_STUDENT_MANAGEMENT_CONTRACT_ADDRESS` | Student Management contract | ✅ |
| `NEXT_PUBLIC_ZK_ACCESS_CONTROL_CONTRACT_ADDRESS` | ZK Access Control contract | ✅ |
| `NEXT_PUBLIC_ZK_VERIFIER_CONTRACT_ADDRESS` | ZK Verifier contract | ✅ |

### ZK Circuit Configuration

| Variable | Description | Default | Notes |
|----------|-------------|---------|-------|
| `ZK_CIRCUIT_PATH` | Path to main circuit file | `./circuits/access-control.circom` | |
| `ZK_WASM_PATH` | Path to compiled WASM file | `./public/circuits/access-control_js/access-control.wasm` | |
| `ZK_PROVING_KEY_PATH` | Path to proving key | `./public/circuits/access-control_0001.zkey` | |
| `ZK_VERIFICATION_KEY_PATH` | Path to verification key | `./circuits/verification_key.json` | |
| `NEXT_PUBLIC_ZK_CIRCUIT_WASM_URL` | Client-side WASM URL | `/circuits/access-control_js/access-control.wasm` | |
| `NEXT_PUBLIC_ZK_PROVING_KEY_URL` | Client-side proving key URL | `/circuits/access-control_0001.zkey` | |

### ZK Build Configuration

| Variable | Description | Default | Range |
|----------|-------------|---------|-------|
| `ZK_CIRCUIT_NAME` | Circuit name | `access-control` | |
| `ZK_PTAU_POWER` | Powers of Tau ceremony power | `14` | 10-20 |
| `ZK_CEREMONY_PARTICIPANTS` | Number of ceremony participants | `3` | 1-10 |
| `ZK_CONSTRAINT_LIMIT` | Maximum circuit constraints | `1000000` | 1000-10000000 |
| `ZK_ENABLE_CIRCUIT_OPTIMIZATION` | Enable circuit optimization | `true` | true/false |
| `ZK_BUILD_PARALLEL` | Enable parallel build | `true` | true/false |
| `ZK_TRUSTED_SETUP_PTAU_PATH` | Path to trusted setup file | `./circuits/pot14_final.ptau` | |

### ZK Performance Configuration

| Variable | Description | Default | Range |
|----------|-------------|---------|-------|
| `ZK_ENABLE_PROOF_CACHING` | Enable proof caching | `true` | true/false |
| `ZK_PROOF_CACHE_TTL` | Cache TTL in seconds | `3600` | 60-86400 |
| `ZK_MAX_PROOF_GENERATION_TIME` | Max proof time (ms) | `30000` | 1000-300000 |
| `ZK_WORKER_THREADS` | Worker threads for proofs | `4` | 1-16 |
| `ZK_BATCH_SIZE` | Batch size for operations | `10` | 1-100 |
| `ZK_TIMEOUT` | Operation timeout (ms) | `60000` | 5000-300000 |

### IPFS/Pinata Configuration

| Variable | Description | Required |
|----------|-------------|----------|
| `PINATA_API_KEY` | Pinata API key | Yes |
| `PINATA_API_SECRET_KEY` | Pinata secret key | Yes |
| `PINATA_JWT_SECRET_ACCESS_TOKEN` | Pinata JWT token | Yes |
| `PINATA_GATEWAY_ACCESS_KEY` | Gateway access key | Optional |
| `NEXT_PUBLIC_PINATA_GATEWAY_URL` | Gateway URL | Yes |

### API Security Configuration

| Variable | Description | Default | Range |
|----------|-------------|---------|-------|
| `ZK_API_RATE_LIMIT_WINDOW` | Rate limit window (ms) | `60000` | 1000-3600000 |
| `ZK_API_RATE_LIMIT_MAX_REQUESTS` | Max requests per window | `10` | 1-1000 |
| `ZK_API_ENABLE_CORS` | Enable CORS | `true` | true/false |
| `ZK_API_ALLOWED_ORIGINS` | Allowed CORS origins | `http://localhost:3000` | Comma-separated URLs |

### Deployment Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `DEPLOYMENT_NETWORK` | Target deployment network | `localhost` |
| `DEPLOYMENT_GAS_LIMIT` | Gas limit for deployment | `8000000` |
| `DEPLOYMENT_GAS_PRICE` | Gas price in wei | `20000000000` |
| `DEPLOYMENT_CONFIRMATIONS` | Confirmations to wait | `1` |

## Network-Specific Configuration

The system supports network-specific contract addresses:

```bash
# Localhost/Hardhat
ZK_CONTRACT_ADDRESS_LOCALHOST=0x...
ACADEMIC_RECORDS_CONTRACT_ADDRESS_LOCALHOST=0x...

# Sepolia Testnet
ZK_CONTRACT_ADDRESS_SEPOLIA=0x...
ACADEMIC_RECORDS_CONTRACT_ADDRESS_SEPOLIA=0x...

# Mainnet
ZK_CONTRACT_ADDRESS_MAINNET=0x...
ACADEMIC_RECORDS_CONTRACT_ADDRESS_MAINNET=0x...
```

## Available Scripts

### Environment Management

```bash
# Validate current environment configuration
npm run env:validate

# Generate environment template
npm run env:template

# Update contract addresses from deployment info
npm run env:update-contracts

# Show current contract addresses
npm run env:show-contracts

# Validate contract addresses
npm run env:validate-contracts
```

### ZK Circuit Management

```bash
# Build ZK circuits
npm run build:circuits

# Deploy ZK system
npm run deploy:zk

# Test ZK pipeline
npm run test:zk-pipeline

# Validate ZK pipeline
npm run validate:zk-pipeline
```

## Troubleshooting

### Common Issues

1. **Missing NEXT_PUBLIC_NETWORK_ID**
   ```bash
   # Add to .env file
   NEXT_PUBLIC_NETWORK_ID=31337
   ```

2. **Invalid private key format**
   ```bash
   # Ensure 64-character hex string without 0x prefix
   PRIVATE_KEY=da943325fc32667d1352dab8cf20d56118293e1bcab92eaeb3aa1c18943b1739
   ```

3. **Missing contract addresses**
   ```bash
   # Deploy contracts first, then update environment
   npm run deploy:zk
   npm run env:update-contracts
   ```

4. **Circuit files not found**
   ```bash
   # Build circuits first
   npm run build:circuits
   ```

### Validation Errors

Run validation to identify issues:
```bash
npm run env:validate
```

Common validation errors and fixes:

- **Missing required variables**: Add the variable to your `.env` file
- **Invalid address format**: Ensure addresses are 42-character hex strings starting with `0x`
- **Invalid numeric values**: Check ranges in the reference table above
- **File not found**: Ensure circuit files are built and paths are correct

### Environment File Priority

The system loads environment variables in this order:
1. `.env.local` (highest priority, git-ignored)
2. `.env`
3. `.env.example` (template only)

### Security Notes

- Never commit `.env` files with real private keys
- Use `.env.local` for sensitive local development settings
- Rotate API keys regularly
- Use different keys for different networks

## Development Workflow

1. **Initial Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   npm run env:validate
   ```

2. **Build Circuits**
   ```bash
   npm run build:circuits
   npm run env:validate
   ```

3. **Deploy Contracts**
   ```bash
   npm run deploy:zk
   # Contract addresses are automatically updated
   ```

4. **Validate Complete Setup**
   ```bash
   npm run env:validate
   npm run test:zk-pipeline
   ```

## Production Deployment

For production deployment:

1. Use separate environment files for each network
2. Set appropriate gas prices and limits
3. Use secure key management (not plain text files)
4. Enable proper CORS origins
5. Set appropriate rate limits
6. Use production-grade IPFS gateways

Example production variables:
```bash
DEPLOYMENT_NETWORK=mainnet
DEPLOYMENT_GAS_PRICE=50000000000  # 50 gwei
DEPLOYMENT_CONFIRMATIONS=3
ZK_API_ALLOWED_ORIGINS=https://yourdomain.com
ZK_API_RATE_LIMIT_MAX_REQUESTS=100
```