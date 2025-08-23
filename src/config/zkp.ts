/**
 * ZKP Configuration
 * 
 * Configuration settings for Zero Knowledge Proof operations
 */

export interface ZKPConfig {
    circuits: {
        accessVerification: {
            wasmPath: string;
            zkeyPath: string;
            vkeyPath: string;
        };
        recordSharing: {
            wasmPath: string;
            zkeyPath: string;
            vkeyPath: string;
        };
    };
    keys: {
        provingKeysPath: string;
        verificationKeysPath: string;
    };
    security: {
        proofCacheTTL: number; // Time to live for cached proofs in milliseconds
        maxProofAge: number; // Maximum age for accepting proofs in seconds
        enableProofCaching: boolean;
    };
    performance: {
        useWebWorkers: boolean;
        maxConcurrentProofs: number;
        circuitPreloadEnabled: boolean;
    };
    fallback: {
        enableGracefulDegradation: boolean;
        fallbackToBasicAuth: boolean;
        errorReportingEnabled: boolean;
    };
}

export const zkpConfig: ZKPConfig = {
    circuits: {
        accessVerification: {
            wasmPath: '/circuits/access_verification.wasm',
            zkeyPath: '/circuits/access_verification.zkey',
            vkeyPath: '/circuits/access_verification_verification_key.json'
        },
        recordSharing: {
            wasmPath: '/circuits/record_sharing.wasm',
            zkeyPath: '/circuits/record_sharing.zkey',
            vkeyPath: '/circuits/record_sharing_verification_key.json'
        }
    },
    keys: {
        provingKeysPath: '/circuits/keys',
        verificationKeysPath: '/circuits/keys'
    },
    security: {
        proofCacheTTL: 5 * 60 * 1000, // 5 minutes
        maxProofAge: 10 * 60, // 10 minutes
        enableProofCaching: true
    },
    performance: {
        useWebWorkers: true,
        maxConcurrentProofs: 3,
        circuitPreloadEnabled: true
    },
    fallback: {
        enableGracefulDegradation: true,
        fallbackToBasicAuth: false, // Set to true for development
        errorReportingEnabled: true
    }
};

/**
 * Environment-specific configuration overrides
 */
export function getZKPConfig(): ZKPConfig {
    const config = { ...zkpConfig };

    // Development overrides
    if (process.env.NODE_ENV === 'development') {
        config.fallback.fallbackToBasicAuth = true;
        config.security.enableProofCaching = false; // Disable caching in dev for testing
        config.performance.circuitPreloadEnabled = false; // Faster dev startup
    }

    // Production overrides
    if (process.env.NODE_ENV === 'production') {
        config.security.proofCacheTTL = 15 * 60 * 1000; // 15 minutes in production
        config.performance.useWebWorkers = true;
        config.fallback.fallbackToBasicAuth = false;
    }

    // Environment variable overrides
    if (process.env.ZKP_CIRCUIT_PATH) {
        const basePath = process.env.ZKP_CIRCUIT_PATH;
        config.circuits.accessVerification.wasmPath = `${basePath}/access_verification.wasm`;
        config.circuits.accessVerification.zkeyPath = `${basePath}/access_verification.zkey`;
        config.circuits.recordSharing.wasmPath = `${basePath}/record_sharing.wasm`;
        config.circuits.recordSharing.zkeyPath = `${basePath}/record_sharing.zkey`;
    }

    return config;
}