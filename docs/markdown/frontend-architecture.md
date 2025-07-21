# Frontend Architecture

## Overview

The frontend of the Blockchain Record Keeping System is built using Next.js, a React framework that enables server-side rendering and static site generation. The application follows modern web development practices with TypeScript for type safety and component-based architecture.

## Tech Stack

- **Framework**: Next.js (App Router)
- **Language**: TypeScript
- **Component Library**: Custom components with TailwindCSS
- **Web3 Integration**: ethers.js
- **File Storage**: IPFS via Pinata API

## Application Structure

```
src/
├── app/               # Next.js App Router pages
├── components/        # Reusable UI components
├── contracts/         # Contract ABIs
├── lib/               # Utility functions
├── services/          # Service layer (blockchain interactions)
└── types/             # TypeScript type definitions
```

## Key Components

### Blockchain Service (`src/services/blockchain.ts`)

The blockchain service is the central interface between the frontend and the smart contracts. It provides methods for:

- Initializing wallet connection
- Interacting with smart contracts
- Managing roles and permissions
- Handling record operations
- Student management

### Pages

The application includes the following key pages:

- **Home (`/`)**: Landing page with features overview
- **Login (`/login`)**: Connect wallet page
- **Dashboard (`/dashboard`)**: Role-specific dashboard
- **Records (`/records`)**: View and manage records
- **Add Record (`/records/add`)**: Form to add new records
- **Verify (`/verify`)**: Public record verification
- **Admin (`/admin`)**: Admin control panel

### UI Components

Custom UI components include:

- **Button**: Customizable button component
- **Header**: Navigation and wallet connection
- **Footer**: Site footer with links
- **MainLayout**: Layout wrapper with header and footer

## Authentication & Authorization

The application uses a wallet-based authentication system:

1. **Authentication**: Users connect their Ethereum wallet (e.g., MetaMask)
2. **Authorization**: The system checks the user's role from the smart contract
3. **Access Control**: UI components and pages adapt based on the user's role

## Data Flow

1. **User Interaction**: User interacts with UI components
2. **Service Layer**: Component calls methods in the blockchain service
3. **Web3 Provider**: Service uses ethers.js to interact with the blockchain
4. **Smart Contract**: Contract processes the request and returns data
5. **UI Update**: Service returns data to the component for rendering

## File Upload Process

The application uses IPFS for document storage:

1. User selects a document file
2. Frontend calls the `/api/upload` API route
3. API route uploads the file to Pinata IPFS service
4. Pinata returns an IPFS hash
5. IPFS hash is stored in the smart contract with the record

## Record Verification

The verification flow allows anyone to verify record authenticity:

1. User enters record ID on verification page
2. Frontend retrieves record data from blockchain
3. System checks record validity
4. UI displays verification result with record details

## Security Considerations

- **Public Data**: Record IDs and metadata are public on the blockchain
- **Private Data**: Actual documents are accessible only to the student and issuing university
- **Sharing Model**: Students control who can access their records
- **Role Separation**: Different user roles have separate access permissions
