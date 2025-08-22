import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { ZKError, ZKErrorType, FormattedZKProof } from "../../../../types/zkTypes";

// ZK Contract ABI for server-side verification
const ZK_CONTRACT_ABI = [
    'function verifyAccess(uint256 recordId, uint[2] memory _pA, uint[2][2] memory _pB, uint[2] memory _pC, uint[3] memory publicSignals) external view returns (bool)',
    'function getEncryptedHash(uint256 recordId, uint[2] memory _pA, uint[2][2] memory _pB, uint[2] memory _pC, uint[3] memory publicSignals) external returns (bytes32)',
    'function hasAccess(uint256 recordId, address user) external view returns (bool)',
    'function getEncryptedRecord(uint256 recordId) external view returns (tuple(bytes32 encryptedIPFSHash, bytes32 encryptedMetadataHash, bytes32 merkleRoot, uint256 timestamp, address owner, bool exists))'
];

// Academic Records Contract ABI for record retrieval
const ACADEMIC_RECORDS_ABI = [
    'function getRecord(uint256 recordId) external view returns (tuple(uint256 id, string studentId, string studentName, address studentAddress, string universityName, string ipfsHash, string metadataHash, uint8 recordType, address issuer, uint256 timestamp, bool verified))',
    'function recordExists(uint256 recordId) external view returns (bool)'
];

interface ZKProofRequest {
    proof: FormattedZKProof;
    userAddress: string;
}

/**
 * Validate ZK proof structure
 */
function validateZKProof(proof: any): proof is FormattedZKProof {
    return (
        proof &&
        Array.isArray(proof.pA) && proof.pA.length === 2 &&
        Array.isArray(proof.pB) && proof.pB.length === 2 &&
        Array.isArray(proof.pB[0]) && proof.pB[0].length === 2 &&
        Array.isArray(proof.pB[1]) && proof.pB[1].length === 2 &&
        Array.isArray(proof.pC) && proof.pC.length === 2 &&
        Array.isArray(proof.publicSignals) && proof.publicSignals.length === 3
    );
}

/**
 * Initialize blockchain provider and contracts
 */
async function initializeContracts() {
    const rpcUrl = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL;
    const zkContractAddress = process.env.ZK_CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_ZK_CONTRACT_ADDRESS;
    const academicRecordsAddress = process.env.ACADEMIC_RECORDS_CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_ACADEMIC_RECORDS_CONTRACT_ADDRESS;

    if (!rpcUrl) {
        throw new Error('RPC_URL not configured');
    }

    if (!zkContractAddress) {
        throw new Error('ZK_CONTRACT_ADDRESS not configured');
    }

    if (!academicRecordsAddress) {
        throw new Error('ACADEMIC_RECORDS_CONTRACT_ADDRESS not configured');
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const zkContract = new ethers.Contract(zkContractAddress, ZK_CONTRACT_ABI, provider);
    const academicRecordsContract = new ethers.Contract(academicRecordsAddress, ACADEMIC_RECORDS_ABI, provider);

    return { provider, zkContract, academicRecordsContract };
}

/**
 * Verify ZK proof on-chain
 */
async function verifyZKProofOnChain(
    zkContract: ethers.Contract,
    recordId: number,
    proof: FormattedZKProof
): Promise<boolean> {
    try {
        const isValid = await zkContract.verifyAccess(
            recordId,
            proof.pA,
            proof.pB,
            proof.pC,
            proof.publicSignals
        );
        return isValid;
    } catch (error) {
        console.error('On-chain proof verification failed:', error);
        return false;
    }
}

/**
 * Get encrypted IPFS hash with ZK proof
 */
async function getEncryptedIPFSHash(
    zkContract: ethers.Contract,
    recordId: number,
    proof: FormattedZKProof
): Promise<string> {
    try {
        const encryptedHash = await zkContract.getEncryptedHash(
            recordId,
            proof.pA,
            proof.pB,
            proof.pC,
            proof.publicSignals
        );
        return encryptedHash;
    } catch (error) {
        throw new ZKError(
            ZKErrorType.PROOF_VERIFICATION_FAILED,
            'Failed to retrieve encrypted IPFS hash',
            error
        );
    }
}

/**
 * Decrypt IPFS hash (simplified implementation)
 */
function decryptIPFSHash(encryptedHash: string, userAddress: string): string {
    // Simplified decryption - in production, use proper encryption/decryption
    // This should match the encryption logic used when storing the hash
    try {
        const hashBytes = ethers.getBytes(encryptedHash);
        const keyBytes = ethers.getBytes(ethers.keccak256(ethers.toUtf8Bytes(userAddress + '_decrypt_key')));

        const decryptedBytes = new Uint8Array(hashBytes.length);
        for (let i = 0; i < hashBytes.length; i++) {
            decryptedBytes[i] = hashBytes[i] ^ keyBytes[i % keyBytes.length];
        }

        // Convert back to IPFS hash format
        const decryptedHex = ethers.hexlify(decryptedBytes);
        // Extract the actual IPFS hash (this is a simplified approach)
        return decryptedHex.slice(2); // Remove 0x prefix
    } catch (error) {
        throw new ZKError(
            ZKErrorType.DECRYPTION_FAILED,
            'Failed to decrypt IPFS hash',
            error
        );
    }
}

/**
 * GET /api/records/[id] - Get record with ZK verification
 */
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const recordId = parseInt(params.id);

        if (isNaN(recordId) || recordId <= 0) {
            return NextResponse.json(
                { error: 'Invalid record ID' },
                { status: 400 }
            );
        }

        // Initialize contracts
        const { zkContract, academicRecordsContract } = await initializeContracts();

        // Check if record exists
        const recordExists = await academicRecordsContract.recordExists(recordId);
        if (!recordExists) {
            return NextResponse.json(
                { error: 'Record not found' },
                { status: 404 }
            );
        }

        // Get basic record information (without IPFS hash)
        const record = await academicRecordsContract.getRecord(recordId);

        // Return record without document access (requires ZK proof)
        return NextResponse.json({
            record: {
                id: Number(record.id),
                studentId: record.studentId,
                studentName: record.studentName,
                studentAddress: record.studentAddress,
                universityName: record.universityName,
                recordType: Number(record.recordType),
                issuer: record.issuer,
                timestamp: Number(record.timestamp),
                verified: record.verified,
                // IPFS hash is not included - requires ZK proof
                requiresZKProof: true
            }
        });

    } catch (error) {
        console.error('Error retrieving record:', error);

        if (error instanceof ZKError) {
            return NextResponse.json(
                {
                    error: error.message,
                    type: error.type,
                    requiresZKProof: true
                },
                { status: 403 }
            );
        }

        // Check if it's a configuration error
        if (error instanceof Error && (
            error.message.includes('not configured') ||
            error.message.includes('RPC_URL') ||
            error.message.includes('CONTRACT_ADDRESS')
        )) {
            return NextResponse.json(
                { error: 'Server configuration error' },
                { status: 500 }
            );
        }

        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/records/[id] - Get record with ZK proof verification
 */
export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const recordId = parseInt(params.id);

        if (isNaN(recordId) || recordId <= 0) {
            return NextResponse.json(
                { error: 'Invalid record ID' },
                { status: 400 }
            );
        }

        // Parse request body
        const body = await request.json() as ZKProofRequest;

        if (!body.proof || !body.userAddress) {
            return NextResponse.json(
                {
                    error: 'Missing required fields: proof and userAddress',
                    type: ZKErrorType.PROOF_VERIFICATION_FAILED
                },
                { status: 400 }
            );
        }

        // Validate user address
        if (!ethers.isAddress(body.userAddress)) {
            return NextResponse.json(
                {
                    error: 'Invalid user address format',
                    type: ZKErrorType.PROOF_VERIFICATION_FAILED
                },
                { status: 400 }
            );
        }

        // Validate ZK proof structure
        if (!validateZKProof(body.proof)) {
            return NextResponse.json(
                {
                    error: 'Invalid ZK proof structure',
                    type: ZKErrorType.PROOF_VERIFICATION_FAILED
                },
                { status: 400 }
            );
        }

        // Initialize contracts
        const { zkContract, academicRecordsContract } = await initializeContracts();

        // Check if record exists
        const recordExists = await academicRecordsContract.recordExists(recordId);
        if (!recordExists) {
            return NextResponse.json(
                { error: 'Record not found' },
                { status: 404 }
            );
        }

        // Verify that the user has access to this record
        const hasAccess = await zkContract.hasAccess(recordId, body.userAddress);
        if (!hasAccess) {
            return NextResponse.json(
                {
                    error: 'User does not have access to this record',
                    type: ZKErrorType.ACCESS_DENIED
                },
                { status: 403 }
            );
        }

        // Verify ZK proof on-chain
        const isValidProof = await verifyZKProofOnChain(zkContract, recordId, body.proof);
        if (!isValidProof) {
            return NextResponse.json(
                {
                    error: 'Invalid ZK proof - verification failed',
                    type: ZKErrorType.PROOF_VERIFICATION_FAILED
                },
                { status: 403 }
            );
        }

        // Get basic record information
        const record = await academicRecordsContract.getRecord(recordId);

        // Get encrypted IPFS hash with valid proof
        const encryptedHash = await getEncryptedIPFSHash(zkContract, recordId, body.proof);

        // Decrypt IPFS hash
        const ipfsHash = decryptIPFSHash(encryptedHash, body.userAddress);

        // Return complete record with document access
        return NextResponse.json({
            record: {
                id: Number(record.id),
                studentId: record.studentId,
                studentName: record.studentName,
                studentAddress: record.studentAddress,
                universityName: record.universityName,
                ipfsHash: ipfsHash,
                metadataHash: record.metadataHash,
                recordType: Number(record.recordType),
                issuer: record.issuer,
                timestamp: Number(record.timestamp),
                verified: record.verified,
                hasZKAccess: true
            },
            proof: {
                verified: true,
                timestamp: Date.now()
            }
        });

    } catch (error) {
        console.error('Error verifying ZK proof for record access:', error);

        if (error instanceof ZKError) {
            return NextResponse.json(
                {
                    error: error.message,
                    type: error.type
                },
                { status: 403 }
            );
        }

        // Check if it's a configuration error
        if (error instanceof Error && (
            error.message.includes('not configured') ||
            error.message.includes('RPC_URL') ||
            error.message.includes('CONTRACT_ADDRESS')
        )) {
            return NextResponse.json(
                { error: 'Server configuration error' },
                { status: 500 }
            );
        }

        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}