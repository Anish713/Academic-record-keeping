# Academic Records Blockchain Contracts

This directory contains blockchain project with smart contracts and deployment scripts for the Academic Records blockchain system.

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


# Academic Records System

A comprehensive blockchain-based academic records management system built with Solidity and Hardhat.

## Features

### Core Functionality
- **Immutable Academic Records**: Store transcripts, certificates, degrees, and custom record types
- **Role-based Access Control**: Super Admin, Admins, Universities, and Students with specific permissions
- **Student Record Sharing**: Students can selectively share records with specific addresses
- **University Management**: Add/remove universities and manage their records
- **Custom Record Types**: Universities can create their own document types

### Security Features
- **Pausable Contract**: Emergency pause functionality for admins
- **Access Control**: Multi-level permission system
- **Data Privacy**: Students control who can access their record metadata

## Architecture

### Contract Structure
```
contracts/
├── AcademicRecords.sol           # Main contract
├── interfaces/
│   └── IAcademicRecords.sol      # Interface definitions
├── abstract/
│   └── RoleManager.sol           # Role management logic
├── libraries/
│   └── RecordStorage.sol         # Storage operations
└── modules/
    └── StudentManagement.sol     # Student registration
```

### Roles and Permissions

#### Super Admin (Contract Deployer)
- Only one super admin exists
- Can add/remove regular admins
- Has all admin permissions
- Cannot be removed or changed

#### Admin
- Can add/remove universities
- Can pause/unpause the contract
- Can view all records
- Cannot modify super admin permissions

#### University
- Can add academic records for students
- Can delete students and their records (only their own)
- Can create custom record types
- Can view their own issued records

#### Student
- Can register their address with student ID
- Can share/unshare specific records with specific addresses
- Can view their own records
- Control access to their record metadata

## Usage Examples

### Deployment
```typescript
// Deploy the system
const AcademicRecords = await ethers.getContractFactory("AcademicRecords");
const academicRecords = await AcademicRecords.deploy();
```

### Super Admin Operations
```typescript
// Add a new admin
await academicRecords.addAdmin(adminAddress);

// Remove an admin
await academicRecords.removeAdmin(adminAddress);

// Add a university (super admin can do this)
await academicRecords.addUniversity(universityAddress, "Harvard University");
```

### Admin Operations
```typescript
// Add a university
await academicRecords.addUniversity(universityAddress, "MIT");

// Remove a university
await academicRecords.removeUniversity(universityAddress);

// Pause the contract
await academicRecords.pause();
```

### University Operations
```typescript
// Add a student record
const recordId = await academicRecords.addRecord(
  "STUDENT123",
  "John Doe",
  "Harvard University",
  "QmHash...", // IPFS hash
  "QmMetadata...", // Metadata hash
  0 // RecordType.TRANSCRIPT
);

// Delete a student and all their records issued by this university
await academicRecords.deleteStudent("STUDENT123");

// Create custom record type
const typeId = await academicRecords.addCustomRecordType(
  "Research Certificate",
  "Certificate for completed research work"
);

// View university's records
const records = await academicRecords.getUniversityRecords();
```

### Student Operations
```typescript
// Register as a student
await academicRecords.registerStudent("STUDENT123");

// Share a record with someone
await academicRecords.shareRecord(recordId, recipientAddress);

// Unshare a record
await academicRecords.unshareRecord(recordId, recipientAddress);

// View shared records with specific address
const sharedRecords = await academicRecords.getSharedRecords(recipientAddress);
```

### Viewing Records
```typescript
// Get a record (basic info, no sensitive data unless authorized)
const record = await academicRecords.getRecord(recordId);

// Get record with permission check (includes metadata if authorized)
const recordWithMeta = await academicRecords.getRecordWithPermission(recordId);

// Get all records for a student
const studentRecords = await academicRecords.getStudentRecords("STUDENT123");

// Verify a record
const isVerified = await academicRecords.verifyRecord(recordId);
```

## Data Structures

### Record
```solidity
struct Record {
    uint256 id;
    string studentId;
    string studentName;
    string universityName;
    string ipfsHash;        // Hidden unless authorized
    string metadataHash;    // Hidden unless authorized
    RecordType recordType;
    uint256 timestamp;
    bool isVerified;
    address issuer;
}
```

### Custom Record Type
```solidity
struct CustomRecordType {
    uint256 id;
    string name;
    string description;
    address creator;
    uint256 timestamp;
    bool isActive;
}
```

## Events

- `RecordAdded`: When a new record is created
- `RecordShared`: When a student shares a record
- `RecordUnshared`: When a student unshares a record
- `StudentDeleted`: When a university deletes a student
- `UniversityNameUpdated`: When university name changes
- `AdminAdded`: When super admin adds a new admin
- `AdminRemoved`: When super admin removes an admin
- `CustomRecordTypeCreated`: When university creates custom type

## Security Considerations

1. **Role Separation**: Clear separation between super admin, admin, university, and student roles
2. **Data Privacy**: Students control access to their sensitive record data
3. **Immutable Core**: Records cannot be modified once created, only deleted by issuing university
4. **Emergency Controls**: Pause functionality for emergency situations
5. **Access Logging**: Events track all access attempts and modifications

## Gas Optimization

- Uses libraries for storage operations
- Efficient array operations
- Minimal storage reads in view functions
- Batch operations where possible

## Best Practices Implemented

1. **Separation of Concerns**: Modular architecture with separate contracts for different functionalities
2. **Interface-Driven Design**: Clear interfaces for external interactions
3. **Library Usage**: Reusable code in libraries
4. **Event Logging**: Comprehensive event emission for tracking
5. **Access Control**: Multi-layered permission system
6. **Error Handling**: Descriptive error messages
7. **Gas Efficiency**: Optimized storage and computation patterns

## Development Setup

```bash
# Install dependencies
npm install

# Compile contracts
npx hardhat compile

# Run tests
npx hardhat test

# Deploy to local network
npx hardhat run scripts/deploy.ts --network localhost

# Deploy to testnet
npx hardhat run scripts/deploy.ts --network goerli
```

## Testing

Comprehensive test suite covering:
- Role management
- Record operations
- Student management
- Access control
- Edge cases and error conditions

## License

MIT License