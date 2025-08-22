import { vi } from 'vitest';

// Mock environment variables
process.env.NEXT_PUBLIC_ZK_CONTRACT_ADDRESS = '0x1234567890123456789012345678901234567890';

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