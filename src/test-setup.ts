import { vi } from 'vitest';
import '@testing-library/jest-dom';

// Mock environment variables
process.env.NEXT_PUBLIC_ZK_CONTRACT_ADDRESS = '0x1234567890123456789012345678901234567890';
process.env.NEXT_PUBLIC_CONTRACT_ADDRESS = '0x1234567890123456789012345678901234567890';
process.env.NEXT_PUBLIC_STUDENT_MANAGEMENT_CONTRACT_ADDRESS = '0x1234567890123456789012345678901234567890';
process.env.NEXT_PUBLIC_PINATA_GATEWAY_URL = 'https://gateway.pinata.cloud/ipfs';

// Mock global objects
Object.defineProperty(window, 'ethereum', {
    writable: true,
    value: {
        request: vi.fn(),
        isMetaMask: true
    }
});

// Mock fetch globally
global.fetch = vi.fn();

// Mock window.location
Object.defineProperty(window, 'location', {
    writable: true,
    value: {
        href: 'http://localhost:3000',
        assign: vi.fn(),
        replace: vi.fn(),
        reload: vi.fn()
    }
});