# Blockchain Record Keeping System Documentation

Welcome to the documentation for the Blockchain Record Keeping System. This documentation provides comprehensive information about the system architecture, components, workflows, and user guides to help you understand how the system works.

## Documentation Structure

### Markdown Documentation

The `markdown` directory contains detailed textual documentation:

- [Overview](./markdown/overview.md): High-level introduction to the system
- [Smart Contracts](./markdown/smart-contracts.md): Detailed explanation of the blockchain contracts
- [Frontend Architecture](./markdown/frontend-architecture.md): Overview of the web application architecture
- [User Workflows](./markdown/user-workflows.md): Step-by-step guides for different user journeys

### Mermaid Diagrams

The `mermaid` directory contains visual diagrams to illustrate the system:

- [System Architecture](./mermaid/system-architecture.md): Overall system architecture diagram
- [Smart Contract Relationships](./mermaid/smart-contract-relationships.md): Relationships between smart contracts
- [Data Model](./mermaid/data-model.md): Entity-relationship diagram of the data structures
- [User Roles Diagram](./mermaid/user-roles-diagram.md): User roles and their relationships
- [User Flow Diagram](./mermaid/user-flow-diagram.md): Navigation flows for different user types
- [Document Storage Workflow](./mermaid/document-storage-workflow.md): How documents are stored on IPFS
- [Record Lifecycle](./mermaid/record-lifecycle.md): Complete lifecycle of an academic record
- **Sequence Diagrams**:
  - [Record Issuance](./mermaid/record-issuance-sequence.md): Process flow for creating a new record
  - [Record Verification](./mermaid/record-verification-sequence.md): Process flow for verifying a record
  - [Record Sharing](./mermaid/record-sharing-sequence.md): Process flow for sharing records with others

### Images

The `images` directory contains static images used in the documentation.

## How to Use This Documentation

1. **New to the project?** Start with the [Overview](./markdown/overview.md) to understand the big picture.
2. **Want to understand the technical architecture?** Review the [System Architecture diagram](./mermaid/system-architecture.md) and [Smart Contracts documentation](./markdown/smart-contracts.md).
3. **Need to understand how users interact with the system?** Explore the [User Workflows](./markdown/user-workflows.md), [User Flow Diagram](./mermaid/user-flow-diagram.md), and sequence diagrams.
4. **Curious about document storage?** Check out the [Document Storage Workflow](./mermaid/document-storage-workflow.md).
5. **Want to see the complete record lifecycle?** Review the [Record Lifecycle](./mermaid/record-lifecycle.md) diagram.
6. **Developing or extending the system?** Dive deep into the [Frontend Architecture](./markdown/frontend-architecture.md) and [Smart Contract Relationships](./mermaid/smart-contract-relationships.md).

## Key System Capabilities

- **Secure Academic Record Storage**: Immutable storage of academic credentials on the blockchain
- **Decentralized Verification**: Anyone can verify the authenticity of academic records
- **Student-Controlled Sharing**: Students control who can access their records
- **Role-Based Access Control**: Different permissions for different user roles
- **IPFS Document Storage**: Actual documents stored on IPFS with hash references on the blockchain
