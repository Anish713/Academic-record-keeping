/**
 * Simple ZK service test utility
 * Use this to test ZK service initialization and identify issues
 */

import { zkService } from '../services/zkService';

export async function testZKServiceInitialization(): Promise<{
    success: boolean;
    error?: string;
    details?: any;
}> {
    try {
        console.log('Testing ZK service initialization...');

        // Test circuit file availability
        const circuitTests = await testCircuitFiles();
        if (!circuitTests.success) {
            return {
                success: false,
                error: 'Circuit files not accessible',
                details: circuitTests
            };
        }

        // Test ZK service initialization
        await zkService.init();

        // Get service status
        const status = zkService.getServiceStatus();
        console.log('ZK Service Status:', status);

        if (!status.initialized) {
            return {
                success: false,
                error: 'ZK service failed to initialize',
                details: status
            };
        }

        return {
            success: true,
            details: status
        };
    } catch (error) {
        console.error('ZK service test failed:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            details: error
        };
    }
}

async function testCircuitFiles(): Promise<{
    success: boolean;
    files: Record<string, boolean>;
}> {
    const files = {
        wasm: false,
        provingKey: false,
        verificationKey: false
    };

    try {
        // Test WASM file
        const wasmResponse = await fetch('/circuits/access-control_js/access-control.wasm');
        files.wasm = wasmResponse.ok;
        console.log('WASM file accessible:', files.wasm);

        // Test proving key
        const provingKeyResponse = await fetch('/circuits/access-control_0001.zkey');
        files.provingKey = provingKeyResponse.ok;
        console.log('Proving key accessible:', files.provingKey);

        // Test verification key
        const verificationKeyResponse = await fetch('/circuits/verification_key.json');
        files.verificationKey = verificationKeyResponse.ok;
        console.log('Verification key accessible:', files.verificationKey);

        return {
            success: files.wasm && files.provingKey && files.verificationKey,
            files
        };
    } catch (error) {
        console.error('Circuit file test failed:', error);
        return {
            success: false,
            files
        };
    }
}

export async function testZKProofGeneration(): Promise<{
    success: boolean;
    error?: string;
    details?: any;
}> {
    try {
        console.log('Testing ZK proof generation...');

        // First ensure ZK service is initialized
        const initTest = await testZKServiceInitialization();
        if (!initTest.success) {
            return {
                success: false,
                error: 'ZK service not initialized',
                details: initTest
            };
        }

        // Check if any records exist first
        const currentAddress = await zkService.getCurrentAddress();
        const accessibleRecords = await zkService.getUserAccessibleRecords();

        let testRecordId: number;

        if (accessibleRecords.length === 0) {
            console.log('No accessible records found. This test requires existing records in the contract.');
            console.log('Please create some test records first or run this test with a user that has access to records.');

            return {
                success: false,
                error: 'No accessible records found for testing. Please create test records first.',
                details: {
                    userAddress: currentAddress,
                    accessibleRecordsCount: 0,
                    suggestion: 'Create test records using the admin interface or deployment scripts'
                }
            };
        } else {
            // Use the first accessible record for testing
            testRecordId = accessibleRecords[0];
            console.log(`Using existing record ID ${testRecordId} for proof generation test`);
        }

        const mockUserAddress = currentAddress;
        const mockAccessKey = 'test-access-key';

        const proofResult = await zkService.generateAccessProof(
            mockUserAddress,
            testRecordId,
            mockAccessKey
        );

        console.log('Proof generation successful:', !!proofResult.proof);

        return {
            success: true,
            details: {
                hasProof: !!proofResult.proof,
                hasPublicSignals: !!proofResult.publicSignals,
                publicSignalsCount: proofResult.publicSignals?.length || 0,
                testedRecordId: testRecordId,
                userAddress: mockUserAddress
            }
        };
    } catch (error) {
        console.error('ZK proof generation test failed:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            details: error
        };
    }
}

// Export a simple test runner
export async function runZKTests(): Promise<void> {
    console.log('=== ZK Service Tests ===');

    const initTest = await testZKServiceInitialization();
    console.log('Initialization Test:', initTest.success ? 'PASS' : 'FAIL');
    if (!initTest.success) {
        console.error('Init Error:', initTest.error);
        console.error('Init Details:', initTest.details);
        return;
    }

    const proofTest = await testZKProofGeneration();
    console.log('Proof Generation Test:', proofTest.success ? 'PASS' : 'FAIL');
    if (!proofTest.success) {
        console.error('Proof Error:', proofTest.error);
        console.error('Proof Details:', proofTest.details);
    }

    console.log('=== Tests Complete ===');
}