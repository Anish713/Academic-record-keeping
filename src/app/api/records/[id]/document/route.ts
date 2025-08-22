import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { ZKError, ZKErrorType, FormattedZKProof } from "../../../../../types/zkTypes";
import {
    withZKValidation,
    validateZKRequestHeaders,
    checkRateLimit,
    createZKErrorResponse,
    initializeZKContract
} from "../../../../../lib/zkMiddleware";

// ZK Contract ABI for document access
const ZK_CONTRACT_ABI = [
    'function getEncryptedHash(uint256 recordId, uint[2] memory _pA, uint[2][2] memory _pB, uint[2] memory _pC, uint[3] memory publicSignals) external returns (bytes32)',
    'function getEncryptedRecord(uint256 recordId) external view returns (tuple(bytes32 encryptedIPFSHash, bytes32 encryptedMetadataHash, bytes32 merkleRoot, uint256 timestamp, address owner, bool exists))'
];

// Academic Records Contract ABI
const ACADEMIC_RECORDS_ABI = [
    'function recordExists(uint256 recordId) external view returns (bool)',
    'function getRecord(uint256 recordId) external view returns (tuple(uint256 id, string studentId, string studentName, address studentAddress, string universityName, string ipfsHash, string metadataHash, uint8 recordType, address issuer, uint256 timestamp, bool verified))'
];

/**
 * Initialize contracts for document access
 */
async function initializeContracts() {
    const rpcUrl = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL;
    const zkContractAddress = process.env.ZK_CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_ZK_CONTRACT_ADDRESS;
    const academicRecordsAddress = process.env.ACADEMIC_RECORDS_CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_ACADEMIC_RECORDS_CONTRACT_ADDRESS;

    if (!rpcUrl || !zkContractAddress || !academicRecordsAddress) {
        throw new ZKError(
            ZKErrorType.CONTRACT_NOT_INITIALIZED,
            'Required contract addresses not configured'
        );
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const zkContract = new ethers.Contract(zkContractAddress, ZK_CONTRACT_ABI, provider);
    const academicRecordsContract = new ethers.Contract(academicRecordsAddress, ACADEMIC_RECORDS_ABI, provider);

    return { provider, zkContract, academicRecordsContract };
}

/**
 * Decrypt IPFS hash using user-specific decryption
 */
function decryptIPFSHash(encryptedHash: string, userAddress: string): string {
    try {
        // Simplified decryption - in production, use proper encryption/decryption
        const hashBytes = ethers.getBytes(encryptedHash);
        const keyBytes = ethers.getBytes(ethers.keccak256(ethers.toUtf8Bytes(userAddress + '_decrypt_key')));

        const decryptedBytes = new Uint8Array(hashBytes.length);
        for (let i = 0; i < hashBytes.length; i++) {
            decryptedBytes[i] = hashBytes[i] ^ keyBytes[i % keyBytes.length];
        }

        // Convert to IPFS hash format
        const decryptedHex = ethers.hexlify(decryptedBytes);

        // Extract IPFS hash (simplified - in production, use proper IPFS hash formatting)
        // This should return a valid IPFS hash like "QmXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
        const ipfsHash = decryptedHex.slice(2, 48); // Take 46 characters for IPFS hash
        return `Qm${ipfsHash}`;
    } catch (error) {
        throw new ZKError(
            ZKErrorType.DECRYPTION_FAILED,
            'Failed to decrypt IPFS hash',
            error
        );
    }
}

/**
 * Generate document URL from IPFS hash
 */
function generateDocumentUrl(ipfsHash: string): string {
    // Use multiple IPFS gateways for redundancy
    const gateways = [
        'https://ipfs.io/ipfs/',
        'https://gateway.pinata.cloud/ipfs/',
        'https://cloudflare-ipfs.com/ipfs/'
    ];

    // Use the first gateway by default, but include alternatives
    const primaryUrl = `${gateways[0]}${ipfsHash}`;

    return primaryUrl;
}

/**
 * POST /api/records/[id]/document - Get document URL with ZK proof
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

        // Validate request headers
        const headerValidation = validateZKRequestHeaders(request);
        if (!headerValidation.isValid) {
            return NextResponse.json(
                { error: headerValidation.error },
                { status: 400 }
            );
        }

        // Check rate limiting
        const rateLimitCheck = checkRateLimit(request);
        if (!rateLimitCheck.allowed) {
            return NextResponse.json(
                { error: rateLimitCheck.error },
                { status: 429 }
            );
        }

        // Use ZK validation middleware
        const validationResult = await withZKValidation(request, recordId);

        if (!validationResult.success) {
            return validationResult.response;
        }

        const { validation } = validationResult;
        const { userAddress, proof } = validation;

        // Initialize contracts
        const { zkContract, academicRecordsContract } = await initializeContracts();

        // Verify record exists
        const recordExists = await academicRecordsContract.recordExists(recordId);
        if (!recordExists) {
            return NextResponse.json(
                { error: 'Record not found' },
                { status: 404 }
            );
        }

        // Get encrypted IPFS hash using the validated proof
        const encryptedHash = await zkContract.getEncryptedHash(
            recordId,
            proof!.pA,
            proof!.pB,
            proof!.pC,
            proof!.publicSignals
        );

        // Decrypt the IPFS hash
        const ipfsHash = decryptIPFSHash(encryptedHash, userAddress);

        // Generate document URL
        const documentUrl = generateDocumentUrl(ipfsHash);

        // Get basic record information for context
        const record = await academicRecordsContract.getRecord(recordId);

        // Return document access information
        return NextResponse.json({
            success: true,
            document: {
                ipfsHash,
                documentUrl,
                accessGranted: true,
                accessTimestamp: new Date().toISOString()
            },
            record: {
                id: Number(record.id),
                studentName: record.studentName,
                universityName: record.universityName,
                recordType: Number(record.recordType),
                verified: record.verified
            },
            proof: {
                verified: true,
                userAddress,
                recordId,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Error providing document access:', error);

        if (error instanceof ZKError) {
            const statusCode = error.type === ZKErrorType.ACCESS_DENIED ? 403 : 500;
            return createZKErrorResponse(error.message, error.type, statusCode);
        }

        return NextResponse.json(
            {
                error: 'Internal server error',
                timestamp: new Date().toISOString()
            },
            { status: 500 }
        );
    }
}

/**
 * GET /api/records/[id]/document - Check document access without proof
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

        const { searchParams } = new URL(request.url);
        const userAddress = searchParams.get('userAddress');

        if (!userAddress) {
            return NextResponse.json(
                {
                    error: 'Missing userAddress parameter',
                    requiresZKProof: true,
                    message: 'Document access requires ZK proof verification. Use POST method with valid proof.'
                },
                { status: 400 }
            );
        }

        if (!ethers.isAddress(userAddress)) {
            return NextResponse.json(
                { error: 'Invalid user address format' },
                { status: 400 }
            );
        }

        // Initialize ZK contract to check access
        const zkContract = await initializeZKContract();

        // Check if user has access (without requiring proof)
        const hasAccess = await zkContract.hasAccess(recordId, userAddress);

        return NextResponse.json({
            recordId,
            userAddress,
            hasAccess,
            requiresZKProof: true,
            message: hasAccess
                ? 'User has access to this record. Use POST method with ZK proof to get document URL.'
                : 'User does not have access to this record.',
            accessCheckTimestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error checking document access:', error);

        return NextResponse.json(
            {
                error: 'Internal server error',
                requiresZKProof: true
            },
            { status: 500 }
        );
    }
}