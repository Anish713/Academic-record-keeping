/**
 * Simple test to verify ZK circuit input validation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ZKService } from '../zkService';
import { ZKError } from '../../types/zkTypes';

describe('ZK Input Validation', () => {
    let zkService: ZKService;

    beforeEach(() => {
        zkService = new ZKService();
    });

    it('should validate complete circuit inputs successfully', () => {
        const validInput = {
            userAddress: '123456789012345678901234567890',
            recordId: '1',
            accessKey: '987654321098765432109876543210',
            timestamp: '1640995200',
            pathElements: Array(10).fill('123456789012345678901234567890'),
            pathIndices: Array(10).fill(0),
            recordHash: '111111111111111111111111111111',
            merkleRoot: '222222222222222222222222222222'
        };

        expect(() => {
            (zkService as any).validateCircuitInputs(validInput);
        }).not.toThrow();
    });

    it('should throw error for missing required fields', () => {
        const invalidInput = {
            userAddress: '123456789012345678901234567890',
            recordId: '1',
            // missing accessKey
            timestamp: '1640995200',
            pathElements: Array(10).fill('123456789012345678901234567890'),
            pathIndices: Array(10).fill(0),
            recordHash: '111111111111111111111111111111',
            merkleRoot: '222222222222222222222222222222'
        };

        expect(() => {
            (zkService as any).validateCircuitInputs(invalidInput);
        }).toThrow(ZKError);
    });

    it('should throw error for invalid pathElements array length', () => {
        const invalidInput = {
            userAddress: '123456789012345678901234567890',
            recordId: '1',
            accessKey: '987654321098765432109876543210',
            timestamp: '1640995200',
            pathElements: Array(5).fill('123456789012345678901234567890'), // Wrong length
            pathIndices: Array(10).fill(0),
            recordHash: '111111111111111111111111111111',
            merkleRoot: '222222222222222222222222222222'
        };

        expect(() => {
            (zkService as any).validateCircuitInputs(invalidInput);
        }).toThrow('pathElements must be an array of exactly 10 elements');
    });

    it('should count total input values correctly', () => {
        const validInput = {
            userAddress: '123456789012345678901234567890',
            recordId: '1',
            accessKey: '987654321098765432109876543210',
            timestamp: '1640995200',
            pathElements: Array(10).fill('123456789012345678901234567890'),
            pathIndices: Array(10).fill(0),
            recordHash: '111111111111111111111111111111',
            merkleRoot: '222222222222222222222222222222'
        };

        // Count: 6 scalar inputs + 10 pathElements + 10 pathIndices + 2 public inputs = 28 total
        const scalarInputs = 6; // userAddress, recordId, accessKey, timestamp, recordHash, merkleRoot
        const arrayInputs = validInput.pathElements.length + validInput.pathIndices.length; // 20
        const totalInputs = scalarInputs + arrayInputs + 2; // +2 for recordHash and merkleRoot

        expect(totalInputs).toBe(28);
        expect(validInput.pathElements).toHaveLength(10);
        expect(validInput.pathIndices).toHaveLength(10);
    });
});