# Blockchain Record Keeping - Deployment Guide

This guide outlines the steps needed to complete the TODOs in the project and deploy the application to production.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Completing TODOs](#completing-todos)
3. [Local Development](#local-development)
4. [Smart Contract Deployment](#smart-contract-deployment)
5. [Frontend Deployment](#frontend-deployment)
6. [Testing](#testing)
7. [Production Checklist](#production-checklist)

## Prerequisites

Before proceeding, ensure you have the following:

- Node.js (v16+)
- npm or yarn
- MetaMask wallet extension installed in your browser
- Infura API key (for deploying to test networks and mainnet)
- Etherscan API key (for contract verification)
- IPFS account (for storing academic record documents)

## Completing TODOs

The project has several TODOs that need to be completed before deployment:

### TODO 1 & 3: Implement Wallet Connection Logic

In `src/app/dashboard/page.tsx` and `src/app/login/page.tsx`, replace the placeholder wallet connection logic with actual implementation using ethers.js and the blockchain service:

```typescript
// In src/app/login/page.tsx
const connectWallet = async () => {
  setIsConnecting(true);
  setError('');
  
  try {
    // Initialize blockchain service
    const success = await blockchainService.init();
    if (!success) {
      throw new Error('Failed to initialize blockchain service');
    }
    
    // Get connected address
    const address = await blockchainService.getAddress();
    
    // Check if the user has university role
    const isUniversity = await blockchainService.hasRole('UNIVERSITY_ROLE', address);
    
    // Redirect based on role
    if (isUniversity) {
      window.location.href = '/dashboard';
    } else {
      window.location.href = '/records';
    }
  } catch (err: any) {
    console.error('Error connecting wallet:', err);
    if (err.message.includes('MetaMask is not installed')) {
      setError('MetaMask is not installed. Please install MetaMask to continue.');
    } else if (err.message.includes('User rejected')) {
      setError('You denied wallet connection. Please try again.');
    } else {
      setError('Failed to connect wallet. Please try again.');
    }
  } finally {
    setIsConnecting(false);
  }
};
```

```typescript
// In src/app/dashboard/page.tsx
const [connectedAddress, setConnectedAddress] = useState('');
const [universityName, setUniversityName] = useState('');

useEffect(() => {
  const initWallet = async () => {
    try {
      // Initialize blockchain service
      const success = await blockchainService.init();
      if (!success) {
        window.location.href = '/login';
        return;
      }
      
      // Get connected address
      const address = await blockchainService.getAddress();
      setConnectedAddress(address);
      
      // Check if the user has university role
      const isUniversity = await blockchainService.hasRole('UNIVERSITY_ROLE', address);
      if (!isUniversity) {
        window.location.href = '/records';
      }
      
      // For demo purposes, set a placeholder university name
      // In a real app, this would come from a database or user profile
      setUniversityName('Example University');
    } catch (err) {
      console.error('Error initializing wallet:', err);
      window.location.href = '/login';
    }
  };
  
  initWallet();
}, []);
```

### TODO 2 & 4: Fetch Real Data from Blockchain

In `src/app/dashboard/page.tsx` and `src/app/records/page.tsx`, replace the sample data with actual data from the blockchain:

```typescript
// In src/app/dashboard/page.tsx
const [records, setRecords] = useState<any[]>([]);

useEffect(() => {
  const fetchRecords = async () => {
    try {
      // Get record IDs issued by the university
      const recordIds = await blockchainService.getUniversityRecords();
      
      // Fetch details for each record
      const recordsData = await Promise.all(
        recordIds.map(async (id: number) => {
          const record = await blockchainService.getRecord(id);
          return {
            id: id.toString(),
            studentName: record.studentName,
            type: record.recordType === 0 ? 'Transcript' : 
                  record.recordType === 1 ? 'Certificate' : 
                  record.recordType === 2 ? 'Degree' : 'Other',
            dateIssued: new Date(record.timestamp * 1000).toLocaleDateString()
          };
        })
      );
      
      setRecords(recordsData);
    } catch (err) {
      console.error('Error fetching records:', err);
    }
  };
  
  if (connectedAddress) {
    fetchRecords();
  }
}, [connectedAddress]);
```

```typescript
// In src/app/records/page.tsx
const [records, setRecords] = useState<any[]>([]);

useEffect(() => {
  const fetchRecords = async () => {
    try {
      // Initialize blockchain service
      await blockchainService.init();
      
      // Get connected address
      const address = await blockchainService.getAddress();
      
      // For demo purposes, use a fixed student ID
      // In a real app, this would come from a database mapping addresses to student IDs
      const studentId = "S12345";
      
      // Get record IDs for the student
      const recordIds = await blockchainService.getStudentRecords(studentId);
      
      // Fetch details for each record
      const recordsData = await Promise.all(
        recordIds.map(async (id: number) => {
          const record = await blockchainService.getRecord(id);
          return {
            studentName: record.studentName,
            type: record.recordType === 0 ? 'Transcript' : 
                  record.recordType === 1 ? 'Certificate' : 
                  record.recordType === 2 ? 'Degree' : 'Other',
            dateOfBirth: 'January 1, 2000', // This would come from additional metadata
            lastUpdated: new Date(record.timestamp * 1000).toLocaleDateString()
          };
        })
      );
      
      setRecords(recordsData);
    } catch (err) {
      console.error('Error fetching records:', err);
    }
  };
  
  fetchRecords();
}, []);
```

### TODO 5: Implement Actual Verification Logic

In `src/app/verify/page.tsx`, replace the placeholder verification logic with actual blockchain verification:

```typescript
const handleVerify = async (e: React.FormEvent) => {
  e.preventDefault();
  setVerificationStatus('loading');
  
  try {
    // Initialize blockchain service
    await blockchainService.init();
    
    // Convert string ID to number
    const recordIdNumber = parseInt(recordId);
    if (isNaN(recordIdNumber)) {
      throw new Error('Invalid record ID');
    }
    
    // Get record details
    const record = await blockchainService.getRecord(recordIdNumber);
    
    // Record access on the blockchain
    await blockchainService.recordAccess(recordIdNumber);
    
    // Format record details for display
    setRecordDetails({
      id: recordId,
      studentName: record.studentName,
      universityName: record.universityName,
      recordType: record.recordType === 0 ? 'Transcript' : 
                record.recordType === 1 ? 'Certificate' : 
                record.recordType === 2 ? 'Degree' : 'Other',
      issueDate: new Date(record.timestamp * 1000).toLocaleDateString(),
      verified: record.isVerified,
      issuer: record.issuer,
    });
    
    setVerificationStatus('success');
  } catch (err) {
    console.error('Error verifying record:', err);
    setVerificationStatus('error');
    setRecordDetails(null);
  }
};
```

### TODO 6: Implement Actual Search Logic

In `src/components/home/SearchSection.tsx`, implement the search functionality:

```typescript
const handleSearch = (e: React.FormEvent) => {
  e.preventDefault();
  
  // Redirect to the verify page with the record ID
  if (recordId.trim()) {
    window.location.href = `/verify?id=${recordId.trim()}`;
  }
};
```

## Local Development

1. Install dependencies:

```bash
# Install root dependencies
npm install

# Install blockchain dependencies
cd blockchain
npm install
cd ..
```

2. Create a `.env` file in the root directory with the following variables:

```
# Blockchain
INFURA_API_KEY=your_infura_api_key
ETHERSCAN_API_KEY=your_etherscan_api_key
PRIVATE_KEY=your_wallet_private_key

# Frontend
NEXT_PUBLIC_CONTRACT_ADDRESS=your_contract_address_after_deployment
```

3. Compile and test the smart contract:

```bash
cd blockchain
npx hardhat compile
npx hardhat test
```

4. Start a local blockchain node:

```bash
npx hardhat node
```

5. Deploy the contract to the local node (in a new terminal):

```bash
cd blockchain
npx hardhat run scripts/deploy.ts --network localhost
```

6. Update the `.env` file with the deployed contract address.

7. Start the Next.js development server:

```bash
npm run dev
```

## Smart Contract Deployment

### Deploying to a Test Network (Sepolia)

1. Make sure your `.env` file has the required variables.

2. Deploy the contract:

```bash
cd blockchain
npx hardhat run scripts/deploy.ts --network sepolia
```

3. Verify the contract on Etherscan:

```bash
npx hardhat verify --network sepolia <DEPLOYED_CONTRACT_ADDRESS>
```

4. Update the `.env` file with the deployed contract address.

### Deploying to Mainnet

1. Update the `.env` file with mainnet configuration.

2. Deploy the contract:

```bash
cd blockchain
npx hardhat run scripts/deploy.ts --network mainnet
```

3. Verify the contract on Etherscan:

```bash
npx hardhat verify --network mainnet <DEPLOYED_CONTRACT_ADDRESS>
```

4. Update the `.env` file with the deployed contract address.

## Frontend Deployment

### Deploying to Vercel

1. Push your code to a GitHub repository.

2. Create a new project on Vercel and connect it to your GitHub repository.

3. Add the environment variables from your `.env` file to the Vercel project settings.

4. Deploy the project.

### Deploying to Other Platforms

1. Build the Next.js application:

```bash
npm run build
```

2. Start the production server:

```bash
npm run start
```

3. Deploy the `.next` directory and necessary files to your hosting provider.

## Testing

### Smart Contract Testing

The smart contract tests are located in `blockchain/test/AcademicRecords.ts`. Run the tests with:

```bash
cd blockchain
npx hardhat test
```

### Frontend Testing

Manually test the application by:

1. Connecting with MetaMask
2. Adding records (if you have university role)
3. Viewing records
4. Verifying records

## Production Checklist

Before going to production, ensure the following:

1. **Security**:
   - Smart contract has been audited
   - Frontend has no security vulnerabilities
   - Environment variables are properly secured

2. **Performance**:
   - Frontend is optimized for production
   - Smart contract gas usage is optimized

3. **User Experience**:
   - Error handling is implemented for all blockchain interactions
   - Loading states are shown during blockchain operations
   - Clear instructions are provided for users

4. **Monitoring**:
   - Set up monitoring for the smart contract
   - Set up monitoring for the frontend

5. **Backup and Recovery**:
   - Ensure wallet private keys are securely backed up
   - Document recovery procedures

6. **Documentation**:
   - Document the system architecture
   - Create user guides
   - Document maintenance procedures

7. **Legal and Compliance**:
   - Ensure compliance with relevant regulations
   - Implement necessary privacy policies

## Next Steps

After deployment, consider implementing the following features:

1. **IPFS Integration**: Store actual academic record documents on IPFS
2. **Multi-signature Verification**: Require multiple authorities to verify records
3. **Advanced Search**: Implement more sophisticated search functionality
4. **User Profiles**: Allow students and universities to create profiles
5. **Notifications**: Implement notifications for record updates
6. **Mobile App**: Develop a mobile application for easier access
7. **Analytics**: Add analytics to track system usage