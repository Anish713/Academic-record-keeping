import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { ZKError, ZKErrorType } from "../../../../types/zkTypes";

// ZK Contract ABI for server-side verification
const ZK_CONTRACT_ABI = [
    'function getUserAccessibleRecords(address user) external view returns (uint256[])',
    'function hasAccess(uint256 recordId, address user) external view returns (bool)'
];

// Academic Records Contract ABI for record retrieval
const ACADEMIC_RECORDS_ABI = [
    'function getRecord(uint256 recordId) external view returns (tuple(uint256 id, string studentId, string studentName, address studentAddress, string universityName, string ipfsHash, string metadataHash, uint8 recordType, address issuer, uint256 timestamp, bool verified))',
    'function recordExists(uint256 recordId) external view returns (bool)'
];

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
 * GET /api/records/accessible - Get all records accessible by a user
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const userAddress = searchParams.get('userAddress');

        if (!userAddress) {
            return NextResponse.json(
                { error: 'Missing required parameter: userAddress' },
                { status: 400 }
            );
        }

        // Validate user address
        if (!ethers.isAddress(userAddress)) {
            return NextResponse.json(
                { error: 'Invalid user address format' },
                { status: 400 }
            );
        }

        // Initialize contracts
        const { zkContract, academicRecordsContract } = await initializeContracts();

        // Get all record IDs accessible by the user
        const accessibleRecordIds = await zkContract.getUserAccessibleRecords(userAddress);

        if (accessibleRecordIds.length === 0) {
            return NextResponse.json({
                records: [],
                total: 0,
                userAddress
            });
        }

        // Fetch record details for each accessible record
        const records = [];
        for (const recordId of accessibleRecordIds) {
            try {
                const recordIdNum = Number(recordId);

                // Check if record still exists
                const recordExists = await academicRecordsContract.recordExists(recordIdNum);
                if (!recordExists) {
                    continue;
                }

                // Get record details (without IPFS hash - requires ZK proof)
                const record = await academicRecordsContract.getRecord(recordIdNum);

                // Determine access level
                let accessLevel = 'shared';
                if (record.studentAddress.toLowerCase() === userAddress.toLowerCase()) {
                    accessLevel = 'owner';
                } else if (record.issuer.toLowerCase() === userAddress.toLowerCase()) {
                    accessLevel = 'university';
                }

                records.push({
                    id: Number(record.id),
                    studentId: record.studentId,
                    studentName: record.studentName,
                    studentAddress: record.studentAddress,
                    universityName: record.universityName,
                    recordType: Number(record.recordType),
                    issuer: record.issuer,
                    timestamp: Number(record.timestamp),
                    verified: record.verified,
                    accessLevel,
                    hasZKAccess: true,
                    requiresZKProof: true // Document access requires ZK proof
                });
            } catch (error) {
                console.error(`Error fetching record ${recordId}:`, error);
                // Continue with other records
            }
        }

        return NextResponse.json({
            records,
            total: records.length,
            userAddress
        });

    } catch (error) {
        console.error('Error retrieving accessible records:', error);

        if (error instanceof ZKError) {
            return NextResponse.json(
                {
                    error: error.message,
                    type: error.type
                },
                { status: 403 }
            );
        }

        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/records/accessible - Check access to specific records
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { userAddress, recordIds } = body;

        if (!userAddress || !recordIds) {
            return NextResponse.json(
                { error: 'Missing required fields: userAddress and recordIds' },
                { status: 400 }
            );
        }

        // Validate user address
        if (!ethers.isAddress(userAddress)) {
            return NextResponse.json(
                { error: 'Invalid user address format' },
                { status: 400 }
            );
        }

        // Validate recordIds array
        if (!Array.isArray(recordIds) || recordIds.length === 0) {
            return NextResponse.json(
                { error: 'recordIds must be a non-empty array' },
                { status: 400 }
            );
        }

        // Initialize contracts
        const { zkContract } = await initializeContracts();

        // Check access for each record
        const accessResults = [];
        for (const recordId of recordIds) {
            try {
                const recordIdNum = parseInt(recordId);
                if (isNaN(recordIdNum) || recordIdNum <= 0) {
                    accessResults.push({
                        recordId,
                        hasAccess: false,
                        error: 'Invalid record ID'
                    });
                    continue;
                }

                const hasAccess = await zkContract.hasAccess(recordIdNum, userAddress);
                accessResults.push({
                    recordId: recordIdNum,
                    hasAccess
                });
            } catch (error) {
                console.error(`Error checking access for record ${recordId}:`, error);
                accessResults.push({
                    recordId,
                    hasAccess: false,
                    error: 'Failed to check access'
                });
            }
        }

        return NextResponse.json({
            userAddress,
            accessResults,
            total: accessResults.length,
            accessible: accessResults.filter(result => result.hasAccess).length
        });

    } catch (error) {
        console.error('Error checking record access:', error);

        if (error instanceof ZKError) {
            return NextResponse.json(
                {
                    error: error.message,
                    type: error.type
                },
                { status: 403 }
            );
        }

        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}