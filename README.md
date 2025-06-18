# Blockchain Academic Records Management System

## Overview

This project is a decentralized academic record management system that leverages blockchain technology to securely store and verify student transcripts and certificates. The platform allows universities to upload and manage academic records, while students can access their transcripts using unique credentials.

## Features

- **Immutable Records**: Academic records stored on the blockchain are tamper-proof and permanently preserved
- **Secure Access**: Students receive secure credentials to access their transcripts
- **Verification System**: Easy verification of academic records by authorized parties
- **University Management**: Universities can upload and manage student records
- **Role-based Access Control**: Different permissions for students, universities, and administrators

## Technology Stack

- **Frontend**: Next.js, React, TailwindCSS
- **Blockchain**: Ethereum, Solidity, Hardhat
- **Authentication**: Web3Modal, Ethers.js

## Project Structure

```
├── blockchain/            # Smart contracts and blockchain code
│   ├── contracts/         # Solidity smart contracts
│   ├── scripts/           # Deployment scripts
│   └── test/              # Contract tests
├── public/                # Static assets
├── src/
│   ├── app/               # Next.js app directory
│   ├── components/        # React components
│   ├── contexts/          # React contexts
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Utility functions
│   ├── services/          # Service layer
│   └── types/             # TypeScript type definitions
```

## Getting Started

### Prerequisites

- Node.js (v18 or later)
- npm or yarn
- MetaMask or another Ethereum wallet

### Installation

1. Clone the repository

```bash
git clone https://github.com/yourusername/blockchain-record-keeping.git
cd blockchain-record-keeping
```

2. Install dependencies

```bash
npm install
```

3. Set up environment variables

Copy the `.env.example` file to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

### Smart Contract Deployment

1. Navigate to the blockchain directory

```bash
cd blockchain
```

2. Compile the contracts

```bash
npx hardhat compile
```

3. Run tests

```bash
npx hardhat test
```

4. Deploy to a testnet (e.g., Sepolia)

```bash
npx hardhat run scripts/deploy.ts --network sepolia
```

5. Update the `.env.local` file with the deployed contract address

## Smart Contract Integration

The application integrates with the `AcademicRecords` smart contract deployed on the Ethereum blockchain. The contract ABI is stored in `src/contracts/AcademicRecords.json` and is used by the blockchain service to interact with the contract.

### Blockchain Service

The `BlockchainService` class in `src/services/blockchain.ts` provides methods for interacting with the smart contract, including:

- Connecting to MetaMask wallet
- Adding academic records
- Retrieving records by ID, student, or university
- Verifying record authenticity

### Environment Configuration

The contract address is configured in the `.env.local` file:

```
NEXT_PUBLIC_CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
```

Replace this with the actual deployed contract address when deploying to a testnet or mainnet.

### Running the Application

```bash
npm run dev
```

The application will be available at http://localhost:3000

## Usage

### For Universities

1. Connect your Ethereum wallet
2. Register as a university (requires approval from an admin)
3. Upload student records with appropriate metadata
4. Manage existing records

### For Students

1. Connect your Ethereum wallet or use your unique access credentials
2. View your academic records
3. Share verification links with third parties

### For Verifiers

1. Use the verification page to check the authenticity of academic records
2. Enter the record ID to view and verify the document

## Security Considerations

- All sensitive operations require appropriate role-based permissions
- Student data privacy is maintained through access controls
- Smart contracts are designed with security best practices

## License

This project is licensed under the MIT License - see the LICENSE file for details.
