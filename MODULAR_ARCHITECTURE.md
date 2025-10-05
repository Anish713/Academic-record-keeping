# Modular Blockchain Architecture with ZKP Integration

This document outlines the refactored modular architecture of the CertiChain academic records system, including the integration of Zero-Knowledge Proof (ZKP) functionality for secure record access.

## 🏗️ Architecture Overview

The system has been redesigned from a monolithic `blockchain.ts` service into a modular, service-oriented architecture with the following benefits:

- **Separation of Concerns**: Each service handles a specific domain
- **Maintainability**: Easier to test, debug, and extend individual components
- **Reusability**: Services can be used independently or combined
- **Scalability**: Better performance through focused optimizations
- **Security**: ZKP integration provides privacy-preserving access control

## 📁 Directory Structure

```
src/services/
├── blockchain/
│   ├── wallet.service.ts              # Wallet connection & provider management
│   ├── base-contract.service.ts       # Base class for contract services
│   ├── role-management.service.ts     # User roles & permissions
│   ├── university-management.service.ts # University operations
│   ├── student-management.service.ts  # Student registration & management
│   └── records-management.service.ts  # Academic records operations
├── zkp/
│   ├── zkp.service.ts                 # ZK proof generation & verification
│   └── encrypted-ipfs.service.ts      # Encrypted document storage
├── blockchain.ts                      # Unified service orchestrator
├── blockchain-legacy.ts               # Backward compatibility wrapper
└── index.ts                          # Export barrel

types/
├── records.ts                         # Academic record types
└── zkp.ts                            # ZKP-related types

blockchain/contracts/
├── ZKPManager.sol                     # Main ZKP verification contract
├── KeyStorage.sol                     # User encryption key management
├── AccessManager.sol                  # Encrypted record access control
└── interfaces/
    └── IZKPInterfaces.sol            # ZKP contract interfaces
```

## 🔧 Core Services

### 1. Wallet Service (`wallet.service.ts`)

Handles MetaMask connection and provider management.

```typescript
import { walletService } from "./services/blockchain/wallet.service";

// Connect to wallet
const connected = await walletService.connect();

// Get current address
const address = await walletService.getCurrentAddress();

// Check connection status
const isConnected = walletService.isConnected();
```

### 2. Role Management Service (`role-management.service.ts`)

Manages user roles and permissions using OpenZeppelin's AccessControl.

```typescript
import {
  roleManagementService,
  UserRole,
} from "./services/blockchain/role-management.service";

// Check if user has admin role
const isAdmin = await roleManagementService.hasRole(
  UserRole.ADMIN_ROLE,
  userAddress
);

// Add university role
await roleManagementService.addUniversity(universityAddress);

// Get all admins
const admins = await roleManagementService.getAllAdmins();
```

### 3. University Management Service (`university-management.service.ts`)

Handles university registration and management.

```typescript
import { universityManagementService } from './services/blockchain/university-management.service';

// Add new university
await universityManagementService.addUniversity(address, \"University Name\");

// Get all universities
const universities = await universityManagementService.getAllUniversities();

// Get university records
const records = await universityManagementService.getUniversityRecords();
```

### 4. Student Management Service (`student-management.service.ts`)

Manages student registration and ID mapping.

```typescript
import { studentManagementService } from './services/blockchain/student-management.service';

// Register student
await studentManagementService.registerStudent(\"STU001\", studentAddress);

// Get student ID by address
const studentId = await studentManagementService.getStudentId(address);

// Check if student is registered
const isRegistered = await studentManagementService.isStudentRegistered(\"STU001\");
```

### 5. Records Management Service (`records-management.service.ts`)

Handles academic record operations.

```typescript
import { recordsManagementService } from './services/blockchain/records-management.service';

// Add new record
const recordId = await recordsManagementService.addRecord(
  \"STU001\", \"John Doe\", studentAddress, \"University\",
  \"ipfsHash\", \"metadataHash\", 0
);

// Get record
const record = await recordsManagementService.getRecord(recordId);

// Share record
await recordsManagementService.shareRecord(recordId, sharedWithAddress);

// Search records
const results = await recordsManagementService.searchRecords(\"searchTerm\");
```

## 🔐 ZKP Integration

### ZKP Service (`zkp.service.ts`)

Handles zero-knowledge proof generation and verification.

```typescript
import { zkpService, ZKAccessType } from "./services/zkp/zkp.service";

// Generate user keys
const keys = await zkpService.generateUserKeys();

// Generate access proof
const { proof, publicSignals } = await zkpService.generateAccessProof(
  recordId,
  ZKAccessType.STUDENT_ACCESS,
  userAddress
);

// Request record access
const accessGranted = await zkpService.requestRecordAccess(
  recordId,
  ZKAccessType.STUDENT_ACCESS
);

// Share record with ZKP
const shared = await zkpService.shareRecord(recordId, sharedWithAddress);
```

### Encrypted IPFS Service (`encrypted-ipfs.service.ts`)

Handles secure document storage with encryption.

```typescript
import { encryptedIPFSService } from "./services/zkp/encrypted-ipfs.service";

// Upload encrypted file
const encryptedData = await encryptedIPFSService.uploadEncryptedFile(
  file,
  recordId,
  ownerAddress
);

// Retrieve and decrypt file
const decryptedHash = await encryptedIPFSService.retrieveDecryptedFile(
  encryptedData,
  userAddress
);

// Share encrypted access
const sharedData = await encryptedIPFSService.shareEncryptedAccess(
  recordId,
  encryptedData,
  sharedWithAddress,
  sharedUserPublicKey
);
```

## 🚀 Unified Service

For applications that prefer a single service interface, use the unified `BlockchainService`:

```typescript
import { blockchainService } from "./services/blockchain";
// or
import { blockchainService } from "./services";

// Initialize all services
const initialized = await blockchainService.init();

// Use any functionality
const isAdmin = await blockchainService.isCurrentUserAdmin();
const universities = await blockchainService.getAllUniversities();
const recordId = await blockchainService.addRecord(/* params */);
```

## 🔧 ZKP Smart Contracts

### ZKPManager Contract

Main contract for ZK proof verification and access control.

**Key Functions:**

- `verifyAccess()` - Verify access to a record using ZK proof
- `shareRecordWithZKP()` - Share record with ZKP verification
- `batchVerifyAccess()` - Batch verify multiple access requests
- `hasVerifiedAccess()` - Check if user has verified access

### KeyStorage Contract

Manages user encryption keys for ZKP operations.

**Key Functions:**

- `generateKeys()` - Store user's public key and ZKP identity
- `getPublicKey()` - Retrieve user's public encryption key
- `getZKPIdentity()` - Get user's ZKP identity commitment
- `hasKeys()` - Check if user has registered keys

### AccessManager Contract

Handles encrypted record access with ZKP verification.

**Key Functions:**

- `storeEncryptedRecord()` - Store encrypted record data
- `grantAccess()` - Grant access using ZKP verification
- `revokeAccess()` - Revoke record access
- `getEncryptedKey()` - Get encryption key for authorized users

## 🏃‍♂️ Migration Guide

### From Legacy Service

**Old Usage:**

```typescript
import { blockchainService } from "./services/blockchain";
```

**New Usage (Unified):**

```typescript
import { blockchainService } from "./services/blockchain";
// Same interface, enhanced with ZKP functionality
```

**New Usage (Modular):**

```typescript
import {
  walletService,
  roleManagementService,
  universityManagementService,
  recordsManagementService,
  zkpService,
} from "./services";
```

### Key Changes

1. **Initialization**: Services must be initialized before use
2. **Error Handling**: Each service has specific error handling
3. **ZKP Integration**: New ZKP-based access control available
4. **Encrypted Storage**: IPFS documents are now encrypted by default
5. **Modular Imports**: Import only the services you need

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run modular services tests
npx hardhat test tests/modular-services.test.ts

# Run ZKP integration tests
npx hardhat test tests/zkp-integration.test.ts
```

### Test Coverage

- ✅ Wallet connection and provider management
- ✅ Role-based access control
- ✅ University management operations
- ✅ Student registration and management
- ✅ Academic record operations
- ✅ ZKP proof generation and verification
- ✅ Encrypted IPFS document storage
- ✅ End-to-end ZKP workflow
- ✅ Security and error handling
- ✅ Performance and scalability

## 🚀 Deployment

### Deploy Contracts

```bash
cd blockchain
npx hardhat compile
npx hardhat run scripts/deploy.ts --network localhost
```

The deployment script will:

1. Deploy all core contracts (RecordStorage, AcademicRecords, StudentManagement)
2. Deploy ZKP contracts (KeyStorage, ZKPManager, AccessManager)
3. Set up contract interconnections
4. Generate environment variables file
5. Copy ABI files to frontend

### Environment Configuration

Add these variables to your `.env.local`:

```env
# Core contracts
NEXT_PUBLIC_ACADEMIC_RECORDS_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_STUDENT_MANAGEMENT_CONTRACT_ADDRESS=0x...

# ZKP contracts
NEXT_PUBLIC_KEY_STORAGE_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_ZKP_MANAGER_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_ACCESS_MANAGER_CONTRACT_ADDRESS=0x...

# IPFS configuration
PINATA_API_KEY=your_pinata_api_key
PINATA_API_SECRET_KEY=your_pinata_secret_key
NEXT_PUBLIC_PINATA_GATEWAY_URL=https://gateway.pinata.cloud
```

## 🔐 Security Considerations

### ZKP Security

1. **Proof Freshness**: Proofs have timestamp validation to prevent replay attacks
2. **Key Management**: User private keys are never stored on-chain
3. **Access Control**: Multi-layered access verification (traditional + ZKP)
4. **Encryption**: IPFS documents are encrypted with user-specific keys

### Best Practices

1. Always validate user permissions before operations
2. Use ZKP for sensitive record access
3. Regularly rotate encryption keys
4. Monitor access patterns for anomalies
5. Implement proper error handling

## 🛠️ Development

### Adding New Services

1. Extend `BaseContractService` for contract interactions
2. Implement proper error handling
3. Add comprehensive tests
4. Update the unified service if needed
5. Document the new functionality

### ZKP Circuit Development

For production deployment:

1. Implement actual ZKP circuits using circom
2. Generate proper verification keys
3. Replace mock verification with real cryptographic verification
4. Add circuit parameter validation

## 📚 Resources

- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)
- [Hardhat Documentation](https://hardhat.org/docs)
- [ethers.js Documentation](https://docs.ethers.org/)
- [IPFS Documentation](https://docs.ipfs.tech/)
- [circom Documentation](https://docs.circom.io/)

## 🤝 Contributing

1. Follow the modular architecture patterns
2. Maintain backward compatibility where possible
3. Add comprehensive tests for new features
4. Update documentation for changes
5. Consider security implications of modifications

---

**Note**: This modular architecture maintains full backward compatibility while providing enhanced functionality through ZKP integration. Existing applications can continue using the unified service interface while new development can leverage the modular services for better maintainability and performance."
