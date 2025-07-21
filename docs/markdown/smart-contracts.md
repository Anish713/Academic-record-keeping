# Smart Contract Architecture

## Contract Hierarchy

The smart contract architecture follows a modular approach with clear separation of concerns:

```
AcademicRecords (Main Contract)
├── IAcademicRecords (Interface)
├── RoleManager (Abstract)
├── RecordStorage (Library)
└── StudentManagement (Module)
```

## Core Contracts

### AcademicRecords

The main contract that ties everything together. It implements the interface and inherits from RoleManager and Pausable.

**Key Responsibilities:**

- Interface with the frontend application
- Coordinate between different modules
- Implement access control for all functions
- Manage record operations (add, get, verify)
- Handle record sharing functionality
- Manage custom record types

### RoleManager

An abstract contract that handles role-based access control for the system.

**Key Responsibilities:**

- Define and manage roles (UNIVERSITY_ROLE, ADMIN_ROLE, SUPER_ADMIN_ROLE)
- Control access to administrative functions
- Maintain lists of universities and admins
- Provide role verification modifiers

### StudentManagement

A module contract for student-specific functionality.

**Key Responsibilities:**

- Register students with their Ethereum addresses
- Map student IDs to addresses and vice versa
- Verify student identities

## Supporting Components

### RecordStorage Library

A library that handles data storage operations for records.

**Key Responsibilities:**

- Define data structures for records
- Implement CRUD operations for records
- Manage record sharing data structures
- Handle custom record type storage

### IAcademicRecords Interface

Defines the contract interface with enums, structs, and events.

**Key Responsibilities:**

- Define RecordType enum
- Define Record and CustomRecordType structs
- Define all events for the system

## Data Structures

### Record

Represents an academic record on the blockchain:

- id: Unique identifier
- studentId: Student identifier
- studentName: Full name of the student
- studentAddress: Ethereum address of the student
- universityName: Name of the issuing institution
- ipfsHash: IPFS hash of the document
- metadataHash: Hash of the metadata
- recordType: Type of the record (from RecordType enum)
- timestamp: When the record was created
- isVerified: Verification status
- issuer: Address of the issuing university

### RecordType

Enum with various types of academic records:

- Academic Records (TRANSCRIPT, DEGREE, etc.)
- Identity & Personal Verification documents
- Admission & Examination Documents
- Administrative & Financial Records
- Academic Schedules & Communications
- Miscellaneous & Supporting Documents

### CustomRecordType

Represents a custom record type defined by a university:

- id: Unique identifier
- name: Name of the custom type
- description: Description of the custom type
- creator: University that created the type
- timestamp: When the type was created
- isActive: Whether the type is active

## Access Control

The system implements a hierarchical access control system:

1. **Super Admin**: Full system control
2. **Admin**: University management and monitoring
3. **University**: Record management and creation
4. **Student**: Self-registration and record sharing
5. **Public**: Record verification only

Access control is implemented using OpenZeppelin's AccessControl contract with custom roles and modifiers.

## Events

The system emits events for important actions to allow for external monitoring and notifications:

- RecordAdded: When a new record is added
- RecordVerified: When a record is verified
- RecordAccessed: When a record is accessed
- StudentDeleted: When a student is deleted
- RecordShared/Unshared: When record sharing status changes
- CustomRecordTypeCreated/Updated: When custom record types change
