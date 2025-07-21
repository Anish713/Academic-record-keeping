# User Workflows

This document outlines the key workflows for different user roles in the Blockchain Record Keeping System.

## Super Admin Workflows

### Setting Up the System

1. Deploy smart contracts to the blockchain
2. The deploying address becomes the Super Admin
3. Add initial administrators to the system
4. Configure system parameters

### Managing Administrators

1. Super Admin logs in with their wallet
2. Navigates to the admin panel
3. Adds new admins by providing their Ethereum addresses
4. Can remove existing admins when necessary

## Administrator Workflows

### Managing Universities

1. Admin logs in with their wallet
2. Navigates to the university management section
3. Adds new universities with their Ethereum addresses and names
4. Can update university information or remove universities

### System Monitoring

1. View system statistics and activity
2. Monitor record creation and verification activities
3. Respond to issues or disputes

## University Workflows

### Adding Academic Records

1. University representative logs in with their wallet
2. Navigates to "Add Record" page
3. Enters student details (name, ID, wallet address)
4. Selects record type
5. Uploads document to IPFS
6. Submits the record to blockchain
7. Receives confirmation with record ID

### Managing Custom Record Types

1. University logs in with their wallet
2. Navigates to custom record types section
3. Creates new record types with name and description
4. Can activate/deactivate custom record types

### Viewing University Records

1. University logs in with their wallet
2. Views dashboard with statistics
3. Can access list of all records issued by the university
4. Can search and filter records by student, type, or date

## Student Workflows

### Registration

1. Student navigates to the registration page
2. Connects their Ethereum wallet
3. Enters their student ID
4. Submits registration request
5. Wallet address is now linked to their student ID

### Viewing Personal Records

1. Student logs in with their wallet
2. Views dashboard showing their records
3. Can filter records by type, university, or date
4. Can access detailed view of each record

### Sharing Records

1. Student logs in with their wallet
2. Selects a record to share
3. Enters the Ethereum address of the recipient
4. Confirms the sharing action
5. Record becomes accessible to the recipient

### Unsharing Records

1. Student logs in with their wallet
2. Views list of shared records
3. Selects a record and recipient to unshare with
4. Confirms the unsharing action
5. Recipient loses access to the record

## Public Verification Workflow

### Verifying a Record

1. User navigates to the public verification page
2. Enters the record ID
3. System retrieves record from blockchain
4. Verification result is displayed showing:
   - Record validity status
   - Basic record details (student name, university, record type)
   - Issue date
   - Issuer information

## Record Access Workflow

### Accessing Shared Records

1. User logs in with their wallet
2. Navigates to shared records section
3. Views list of records shared with them
4. Selects a record to view details
5. System checks access permissions
6. Record details and document link are displayed
