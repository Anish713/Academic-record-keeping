# ZK-Protected API Endpoints

This document describes the Zero Knowledge Proof (ZKP) protected API endpoints for secure document access in the blockchain-based academic records system.

## Overview

The ZK-protected endpoints ensure that only authorized users can access academic documents by requiring valid zero-knowledge proofs. This prevents unauthorized access even if someone knows the IPFS hash of a document.

## Authentication

All ZK-protected endpoints require:
- Valid ZK proof generated client-side
- User's Ethereum wallet address
- Proper content-type headers (`application/json`)

## Rate Limiting

- **Window**: 60 seconds
- **Max Requests**: 10 per IP address per window
- **Response**: 429 Too Many Requests when exceeded

## Endpoints

### GET /api/records/[id]

Get basic record information without document access.

**Parameters:**
- `id` (path): Record ID (integer)

**Response:**
```json
{
  "record": {
    "id": 1,
    "studentId": "STU001",
    "studentName": "John Doe",
    "studentAddress": "0x...",
    "universityName": "Test University",
    "recordType": 0,
    "issuer": "0x...",
    "timestamp": 1234567890,
    "verified": true,
    "requiresZKProof": true
  }
}
```

**Status Codes:**
- `200`: Success
- `400`: Invalid record ID
- `404`: Record not found
- `500`: Server error

---

### POST /api/records/[id]

Get complete record information with ZK proof verification.

**Parameters:**
- `id` (path): Record ID (integer)

**Request Body:**
```json
{
  "proof": {
    "pA": ["0x...", "0x..."],
    "pB": [["0x...", "0x..."], ["0x...", "0x..."]],
    "pC": ["0x...", "0x..."],
    "publicSignals": ["1", "0x...", "0x..."]
  },
  "userAddress": "0x..."
}
```

**Response:**
```json
{
  "record": {
    "id": 1,
    "studentId": "STU001",
    "studentName": "John Doe",
    "studentAddress": "0x...",
    "universityName": "Test University",
    "ipfsHash": "QmXXXXXX...",
    "metadataHash": "QmYYYYYY...",
    "recordType": 0,
    "issuer": "0x...",
    "timestamp": 1234567890,
    "verified": true,
    "hasZKAccess": true
  },
  "proof": {
    "verified": true,
    "timestamp": 1234567890
  }
}
```

**Status Codes:**
- `200`: Success
- `400`: Invalid request (missing fields, invalid address, malformed proof)
- `403`: Access denied (no access or invalid proof)
- `404`: Record not found
- `500`: Server error

---

### GET /api/records/accessible

Get all records accessible by a user.

**Query Parameters:**
- `userAddress` (required): User's Ethereum address

**Response:**
```json
{
  "records": [
    {
      "id": 1,
      "studentId": "STU001",
      "studentName": "John Doe",
      "studentAddress": "0x...",
      "universityName": "Test University",
      "recordType": 0,
      "issuer": "0x...",
      "timestamp": 1234567890,
      "verified": true,
      "accessLevel": "owner",
      "hasZKAccess": true,
      "requiresZKProof": true
    }
  ],
  "total": 1,
  "userAddress": "0x..."
}
```

**Status Codes:**
- `200`: Success
- `400`: Missing or invalid userAddress
- `500`: Server error

---

### POST /api/records/accessible

Check access to specific records.

**Request Body:**
```json
{
  "userAddress": "0x...",
  "recordIds": [1, 2, 3]
}
```

**Response:**
```json
{
  "userAddress": "0x...",
  "accessResults": [
    {
      "recordId": 1,
      "hasAccess": true
    },
    {
      "recordId": 2,
      "hasAccess": false
    }
  ],
  "total": 2,
  "accessible": 1
}
```

**Status Codes:**
- `200`: Success
- `400`: Invalid request body
- `500`: Server error

---

### GET /api/records/[id]/document

Check document access without providing the document.

**Parameters:**
- `id` (path): Record ID (integer)

**Query Parameters:**
- `userAddress` (required): User's Ethereum address

**Response:**
```json
{
  "recordId": 1,
  "userAddress": "0x...",
  "hasAccess": true,
  "requiresZKProof": true,
  "message": "User has access to this record. Use POST method with ZK proof to get document URL.",
  "accessCheckTimestamp": "2023-01-01T00:00:00.000Z"
}
```

**Status Codes:**
- `200`: Success
- `400`: Missing or invalid parameters
- `500`: Server error

---

### POST /api/records/[id]/document

Get document URL with ZK proof verification.

**Parameters:**
- `id` (path): Record ID (integer)

**Request Body:**
```json
{
  "proof": {
    "pA": ["0x...", "0x..."],
    "pB": [["0x...", "0x..."], ["0x...", "0x..."]],
    "pC": ["0x...", "0x..."],
    "publicSignals": ["1", "0x...", "0x..."]
  },
  "userAddress": "0x..."
}
```

**Response:**
```json
{
  "success": true,
  "document": {
    "ipfsHash": "QmXXXXXX...",
    "documentUrl": "https://ipfs.io/ipfs/QmXXXXXX...",
    "accessGranted": true,
    "accessTimestamp": "2023-01-01T00:00:00.000Z"
  },
  "record": {
    "id": 1,
    "studentName": "John Doe",
    "universityName": "Test University",
    "recordType": 0,
    "verified": true
  },
  "proof": {
    "verified": true,
    "userAddress": "0x...",
    "recordId": 1,
    "timestamp": "2023-01-01T00:00:00.000Z"
  }
}
```

**Status Codes:**
- `200`: Success
- `400`: Invalid request (wrong content-type, missing fields, malformed proof)
- `403`: Access denied (no access or invalid proof)
- `404`: Record not found
- `429`: Rate limit exceeded
- `500`: Server error

## Error Responses

All error responses follow this format:

```json
{
  "error": "Error message",
  "type": "ZK_ERROR_TYPE",
  "timestamp": "2023-01-01T00:00:00.000Z"
}
```

### ZK Error Types

- `CIRCUIT_NOT_LOADED`: ZK circuit files not available
- `PROOF_GENERATION_FAILED`: Failed to generate ZK proof
- `PROOF_VERIFICATION_FAILED`: ZK proof verification failed
- `ACCESS_DENIED`: User does not have access to the resource
- `ENCRYPTION_FAILED`: Failed to encrypt data
- `DECRYPTION_FAILED`: Failed to decrypt data
- `INVALID_ACCESS_KEY`: Invalid or expired access key
- `CONTRACT_NOT_INITIALIZED`: Blockchain contract not properly initialized
- `NETWORK_ERROR`: Blockchain network connection error
- `WALLET_NOT_CONNECTED`: User wallet not connected

## Environment Variables

Required environment variables for ZK API endpoints:

```bash
# Blockchain Configuration
RPC_URL=http://localhost:8545
ZK_CONTRACT_ADDRESS=0x...
ACADEMIC_RECORDS_CONTRACT_ADDRESS=0x...

# Client-side Configuration
NEXT_PUBLIC_RPC_URL=http://localhost:8545
NEXT_PUBLIC_ZK_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_ACADEMIC_RECORDS_CONTRACT_ADDRESS=0x...

# API Security
ZK_API_RATE_LIMIT_WINDOW=60000
ZK_API_RATE_LIMIT_MAX_REQUESTS=10
ZK_API_ENABLE_CORS=true
ZK_API_ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com
```

## Security Considerations

1. **ZK Proof Validation**: All proofs are verified on-chain before granting access
2. **Rate Limiting**: Prevents abuse and DoS attacks
3. **Input Validation**: All inputs are validated for type and format
4. **Error Handling**: Sensitive information is not exposed in error messages
5. **CORS Protection**: Only allowed origins can access the API
6. **Content-Type Validation**: Only JSON requests are accepted for ZK operations

## Usage Examples

### Client-side ZK Proof Generation

```typescript
import { zkService } from '../services/zkService';

// Generate proof for document access
const proof = await zkService.generateAccessProof(
  userAddress,
  recordId,
  accessKey
);

// Access document with proof
const response = await fetch(`/api/records/${recordId}/document`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    proof,
    userAddress
  })
});

const data = await response.json();
if (data.success) {
  window.open(data.document.documentUrl, '_blank');
}
```

### Error Handling

```typescript
try {
  const response = await fetch('/api/records/1', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ proof, userAddress })
  });

  if (!response.ok) {
    const error = await response.json();
    
    switch (error.type) {
      case 'ACCESS_DENIED':
        console.log('User does not have access to this record');
        break;
      case 'PROOF_VERIFICATION_FAILED':
        console.log('Invalid ZK proof provided');
        break;
      default:
        console.log('Unexpected error:', error.error);
    }
    return;
  }

  const data = await response.json();
  // Handle successful response
} catch (error) {
  console.error('Network error:', error);
}
```

## Testing

The API endpoints include comprehensive integration tests covering:

- Valid ZK proof verification
- Invalid proof rejection
- Access control enforcement
- Error handling scenarios
- Rate limiting
- Input validation
- Security edge cases

Run tests with:
```bash
npx vitest run --config vitest.unit.config.ts src/app/api/__tests__/
```