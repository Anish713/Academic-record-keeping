import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { ZKError, ZKErrorType, FormattedZKProof } from "../types/zkTypes";

// ZK Contract ABI for server-side verification
const ZK_CONTRACT_ABI = [
    'function verifyAccess(uint256 recordId, uint[2] memory _pA, uint[2][2] memory _pB, uint[2] memory _pC, uint[3] memory publicSignals) external view returns (bool)',
    'function hasAccess(uint256 recordId, address user) external view returns (bool)',
    'function getEncryptedRecord(uint256 recordId) external view returns (tuple(bytes32 encryptedIPFSHash, bytes32 encryptedMetadataHash, bytes32 merkleRoot, uint256 timestamp, address owner, bool exists))'
];

export interface ZKValidationResult {
    isValid: boolean;
    userAddress: string;
    recordId: number;
    proof?: FormattedZKProof;
    error?: string;
    errorType?: ZKErrorType;
}

export interface ZKMiddlewareOptions {
    requireProof?: boolean;
    allowOwner?: boolean;
    allowUniversity?: boolean;
    allowAdmin?: boolean;
}

/**
 * Validate ZK proof structure
 */
export function validateZKProofStructure(proof: any): proof is FormattedZKProof {
    return (
        proof &&
        Array.isArray(proof.pA) && proof.pA.length === 2 &&
        Array.isArray(proof.pB) && proof.pB.length === 2 &&
        Array.isArray(proof.pB[0]) && proof.pB[0].length === 2 &&
        Array.isArray(proof.pB[1]) && proof.pB[1].length === 2 &&
        Array.isArray(proof.pC) && proof.pC.length === 2 &&
        Array.isArray(proof.publicSignals) && proof.publicSignals.length === 3 &&
        proof.pA.every((val: any) => typeof val === 'string') &&
        proof.pB.every((arr: any) => Array.isArray(arr) && arr.every((val: any) => typeof val === 'string')) &&
        proof.pC.every((val: any) => typeof val === 'string') &&
        proof.publicSignals.every((val: any) => typeof val === 'string')
    );
}

/**
 * Initialize ZK contract for server-side verification
 */
export async function initializeZKContract(): Promise<ethers.Contract> {
    const rpcUrl = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL;
    const zkContractAddress = process.env.ZK_CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_ZK_CONTRACT_ADDRESS;

    if (!rpcUrl) {
        throw new ZKError(
            ZKErrorType.NETWORK_ERROR,
            'RPC_URL not configured in environment variables'
        );
    }

    if (!zkContractAddress) {
        throw new ZKError(
            ZKErrorType.CONTRACT_NOT_INITIALIZED,
            'ZK_CONTRACT_ADDRESS not configured in environment variables'
        );
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    return new ethers.Contract(zkContractAddress, ZK_CONTRACT_ABI, provider);
}

/**
 * Verify ZK proof on-chain
 */
export async function verifyZKProofOnChain(
    zkContract: ethers.Contract,
    recordId: number,
    proof: FormattedZKProof
): Promise<boolean> {
    try {
        // Validate that the proof's public signals match the record ID
        const proofRecordId = parseInt(proof.publicSignals[0]);
        if (proofRecordId !== recordId) {
            throw new ZKError(
                ZKErrorType.PROOF_VERIFICATION_FAILED,
                `Proof record ID (${proofRecordId}) does not match requested record ID (${recordId})`
            );
        }

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

        if (error instanceof ZKError) {
            throw error;
        }

        throw new ZKError(
            ZKErrorType.PROOF_VERIFICATION_FAILED,
            'Failed to verify proof on blockchain',
            error
        );
    }
}

/**
 * Check if user has access to a record
 */
export async function checkUserAccess(
    zkContract: ethers.Contract,
    recordId: number,
    userAddress: string
): Promise<boolean> {
    try {
        return await zkContract.hasAccess(recordId, userAddress);
    } catch (error) {
        console.error('Failed to check user access:', error);
        return false;
    }
}

/**
 * Validate ZK proof for record access
 */
export async function validateZKProof(
    recordId: number,
    userAddress: string,
    proof: FormattedZKProof,
    options: ZKMiddlewareOptions = {}
): Promise<ZKValidationResult> {
    try {
        // Validate inputs
        if (!ethers.isAddress(userAddress)) {
            return {
                isValid: false,
                userAddress,
                recordId,
                error: 'Invalid user address format',
                errorType: ZKErrorType.PROOF_VERIFICATION_FAILED
            };
        }

        if (!validateZKProofStructure(proof)) {
            return {
                isValid: false,
                userAddress,
                recordId,
                error: 'Invalid ZK proof structure',
                errorType: ZKErrorType.PROOF_VERIFICATION_FAILED
            };
        }

        // Initialize ZK contract
        const zkContract = await initializeZKContract();

        // Check if user has access to the record
        const hasAccess = await checkUserAccess(zkContract, recordId, userAddress);
        if (!hasAccess) {
            return {
                isValid: false,
                userAddress,
                recordId,
                error: 'User does not have access to this record',
                errorType: ZKErrorType.ACCESS_DENIED
            };
        }

        // Verify the ZK proof on-chain
        const isValidProof = await verifyZKProofOnChain(zkContract, recordId, proof);
        if (!isValidProof) {
            return {
                isValid: false,
                userAddress,
                recordId,
                error: 'ZK proof verification failed',
                errorType: ZKErrorType.PROOF_VERIFICATION_FAILED
            };
        }

        return {
            isValid: true,
            userAddress,
            recordId,
            proof
        };

    } catch (error) {
        console.error('ZK proof validation error:', error);

        if (error instanceof ZKError) {
            return {
                isValid: false,
                userAddress,
                recordId,
                error: error.message,
                errorType: error.type
            };
        }

        return {
            isValid: false,
            userAddress,
            recordId,
            error: 'Internal validation error',
            errorType: ZKErrorType.PROOF_VERIFICATION_FAILED
        };
    }
}

/**
 * Middleware function to validate ZK proofs in API routes
 */
export async function withZKValidation(
    request: NextRequest,
    recordId: number,
    options: ZKMiddlewareOptions = {}
): Promise<{ success: true; validation: ZKValidationResult } | { success: false; response: NextResponse }> {
    try {
        // Parse request body to get proof and user address
        const body = await request.json();
        const { proof, userAddress } = body;

        if (!proof || !userAddress) {
            return {
                success: false,
                response: NextResponse.json(
                    {
                        error: 'Missing required fields: proof and userAddress',
                        type: ZKErrorType.PROOF_VERIFICATION_FAILED
                    },
                    { status: 400 }
                )
            };
        }

        // Validate the ZK proof
        const validation = await validateZKProof(recordId, userAddress, proof, options);

        if (!validation.isValid) {
            const statusCode = validation.errorType === ZKErrorType.ACCESS_DENIED ? 403 : 400;

            return {
                success: false,
                response: NextResponse.json(
                    {
                        error: validation.error,
                        type: validation.errorType
                    },
                    { status: statusCode }
                )
            };
        }

        return {
            success: true,
            validation
        };

    } catch (error) {
        console.error('ZK middleware error:', error);

        return {
            success: false,
            response: NextResponse.json(
                { error: 'Internal server error during ZK validation' },
                { status: 500 }
            )
        };
    }
}

/**
 * Create error response for ZK validation failures
 */
export function createZKErrorResponse(
    error: string,
    errorType: ZKErrorType,
    statusCode: number = 403
): NextResponse {
    return NextResponse.json(
        {
            error,
            type: errorType,
            timestamp: new Date().toISOString()
        },
        { status: statusCode }
    );
}

/**
 * Validate request headers for ZK operations
 */
export function validateZKRequestHeaders(request: NextRequest): { isValid: boolean; error?: string } {
    const contentType = request.headers.get('content-type');

    if (!contentType || !contentType.includes('application/json')) {
        return {
            isValid: false,
            error: 'Content-Type must be application/json for ZK proof requests'
        };
    }

    return { isValid: true };
}

/**
 * Rate limiting for ZK proof verification (simple implementation)
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // 10 requests per minute per IP

export function checkRateLimit(request: NextRequest): { allowed: boolean; error?: string } {
    const clientIP = request.headers.get('x-forwarded-for') ||
        request.headers.get('x-real-ip') ||
        request.headers.get('cf-connecting-ip') ||
        'unknown';
    const now = Date.now();

    const rateLimitData = rateLimitMap.get(clientIP);

    if (!rateLimitData || now > rateLimitData.resetTime) {
        // Reset or initialize rate limit
        rateLimitMap.set(clientIP, {
            count: 1,
            resetTime: now + RATE_LIMIT_WINDOW
        });
        return { allowed: true };
    }

    if (rateLimitData.count >= RATE_LIMIT_MAX_REQUESTS) {
        return {
            allowed: false,
            error: 'Rate limit exceeded. Too many ZK proof verification requests.'
        };
    }

    rateLimitData.count++;
    return { allowed: true };
}

/**
 * Clean up expired rate limit entries
 */
export function cleanupRateLimit(): void {
    const now = Date.now();
    for (const [key, data] of rateLimitMap.entries()) {
        if (now > data.resetTime) {
            rateLimitMap.delete(key);
        }
    }
}

// Clean up rate limit entries every 5 minutes
if (typeof setInterval !== 'undefined') {
    setInterval(cleanupRateLimit, 5 * 60 * 1000);
}