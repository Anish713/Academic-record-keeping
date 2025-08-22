# Sepolia Deployment Guide

This guide explains how to deploy the Academic Records blockchain system to the Sepolia Ethereum testnet.

## Prerequisites

Before deploying to Sepolia, ensure you have:

1. **Environment Variables**: Set up the following in your `.env` file:
   ```
   PRIVATE_KEY=your_private_key_here
   INFURA_API_KEY=your_infura_api_key
   ETHERSCAN_API_KEY=your_etherscan_api_key
   ```

2. **Sepolia ETH**: Ensure your deployer account has at least 0.1 ETH on Sepolia testnet
   - Get Sepolia ETH from faucets like: https://sepoliafaucet.com/

3. **Node.js Dependencies**: Install all dependencies:
   ```bash
   npm install
   ```

## Deployment Process

### Step 1: Validate Prerequisites

Before deploying, run the validation script to check all prerequisites:

```bash
npm run validate:sepolia
```

This will check:
- Environment variables are set
- Private key format is valid
- Network connectivity to Sepolia
- Account balance is sufficient
- Infura API key is working
- All contracts compile successfully

### Step 2: Deploy to Sepolia

Once validation passes, deploy the complete system:

```bash
npm run deploy:sepolia
```

This will:
1. Deploy Groth16Verifier contract
2. Deploy ZKAccessControl contract (linked to verifier)
3. Deploy RecordStorage library
4. Deploy AcademicRecords contract (linked to library)
5. Retrieve StudentManagement contract address
6. Verify all deployments
7. Update environment variables
8. Generate deployment report

## Deployment Order

The contracts are deployed in the following dependency order:

```
1. Groth16Verifier
   ↓
2. ZKAccessControl (requires verifier address)
   
3. RecordStorage Library
   ↓
4. AcademicRecords (requires library linking)
   ↓
5. StudentManagement (retrieved from AcademicRecords)
```

## Output Files

After successful deployment, the following files are created/updated:

1. **deployment-info.json**: Contains all contract addresses and deployment details
2. **sepolia-deployment-report.json**: Comprehensive deployment report
3. **.env**: Updated with new contract addresses for Sepolia network

## Environment Variables Updated

The deployment automatically updates these environment variables:

```
NEXT_PUBLIC_CONTRACT_ADDRESS=<AcademicRecords address>
NEXT_PUBLIC_STUDENT_MANAGEMENT_CONTRACT_ADDRESS=<StudentManagement address>
NEXT_PUBLIC_ZK_ACCESS_CONTROL_CONTRACT_ADDRESS=<ZKAccessControl address>
NEXT_PUBLIC_ZK_VERIFIER_CONTRACT_ADDRESS=<Groth16Verifier address>
NEXT_PUBLIC_NETWORK_ID=11155111
NEXT_PUBLIC_RPC_URL=https://sepolia.infura.io/v3/<your_infura_key>
DEPLOYMENT_NETWORK=sepolia
```

## Verification

The deployment script automatically verifies:

- Contract code exists at deployed addresses
- Basic contract functionality works
- Contract integrations are correct
- All environment variables are updated

## Troubleshooting

### Common Issues

1. **Insufficient Balance**
   - Solution: Add more Sepolia ETH to your account

2. **Invalid Private Key**
   - Solution: Ensure private key is 64 hex characters (with or without 0x prefix)

3. **Network Connectivity Issues**
   - Solution: Check your Infura API key and internet connection

4. **Contract Compilation Errors**
   - Solution: Run `npm run compile` to check for compilation issues

5. **Gas Estimation Errors**
   - Solution: Increase gas limit in environment variables:
     ```
     DEPLOYMENT_GAS_LIMIT=10000000
     DEPLOYMENT_GAS_PRICE=25000000000
     ```

### Manual Recovery

If deployment fails partway through:

1. Check the deployment-info.json file to see which contracts were deployed
2. The script will attempt to use existing deployments where possible
3. You can manually update environment variables using:
   ```bash
   node ../scripts/update-env-contracts.js update sepolia
   ```

## Gas Costs

Typical gas costs for deployment (at 20 gwei):

- Groth16Verifier: ~1,200,000 gas (~0.024 ETH)
- ZKAccessControl: ~2,800,000 gas (~0.056 ETH)
- RecordStorage: ~400,000 gas (~0.008 ETH)
- AcademicRecords: ~3,500,000 gas (~0.070 ETH)

**Total estimated cost: ~0.16 ETH**

## Security Notes

- Never commit your private key to version control
- Use a dedicated deployment account with minimal funds
- Verify all contract addresses after deployment
- Test the deployed contracts before using in production

## Support

If you encounter issues:

1. Run the validation script first: `npm run validate:sepolia`
2. Check the deployment logs for specific error messages
3. Ensure all prerequisites are met
4. Contact the development team with the deployment report if issues persist