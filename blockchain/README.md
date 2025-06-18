# Academic Records Blockchain Contracts

This directory contains the smart contracts and deployment scripts for the Academic Records blockchain system.

## Overview

The system uses Ethereum smart contracts to securely store and verify academic records. The main contract, `AcademicRecords.sol`, implements the following features:

- Role-based access control for universities and administrators
- Secure storage of academic records with verification
- Support for different types of academic documents (transcripts, certificates, degrees)
- Event logging for auditing purposes

## Contract Architecture

### AcademicRecords.sol

The main contract that handles the storage and verification of academic records. It uses OpenZeppelin's AccessControl and Pausable contracts for security and access management.

## Development

### Prerequisites

- Node.js and npm
- Hardhat

### Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Create a `.env` file in the root directory with the following variables:
   ```
   PRIVATE_KEY=your_private_key_here
   INFURA_API_KEY=your_infura_api_key_here
   ETHERSCAN_API_KEY=your_etherscan_api_key_here
   ```

### Testing

Run the test suite:

```
npx hardhat test
```

### Deployment

To deploy to a testnet (e.g., Sepolia):

```
npx hardhat run scripts/deploy.ts --network sepolia
```

## Security Considerations

- The contract uses role-based access control to restrict sensitive operations
- Only verified universities can add academic records
- The contract can be paused in case of emergencies
- All operations are logged with events for auditing