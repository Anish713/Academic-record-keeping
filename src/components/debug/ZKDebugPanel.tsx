"use client";

import { useState, useEffect } from 'react';
import { blockchainService } from '@/services/blockchain';
import { zkService } from '@/services/zkService';
import { testZKServiceInitialization, testZKProofGeneration } from '@/utils/zkServiceTest';

interface ZKDebugInfo {
  blockchainStatus: {
    initialized: boolean;
    contractAddress: string;
    circuitsLoaded: boolean;
    lastError?: string;
  };
  zkServiceStatus: {
    initialized: boolean;
    circuitLoaded: boolean;
    provingKeyLoaded: boolean;
    verificationKeyLoaded: boolean;
    contractConnected: boolean;
    contractAddress: string;
  };
  environmentVars: {
    zkContractAddress: string;
    circuitWasmUrl: string;
    provingKeyUrl: string;
    verificationKeyUrl: string;
  };
  testResults?: {
    initTest?: any;
    proofTest?: any;
  };
}

export default function ZKDebugPanel() {
  const [debugInfo, setDebugInfo] = useState<ZKDebugInfo | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isRunningTests, setIsRunningTests] = useState(false);

  const loadDebugInfo = async () => {
    try {
      const blockchainStatus = blockchainService.getZKStatus();
      const zkServiceStatus = zkService.getServiceStatus();
      
      const environmentVars = {
        zkContractAddress: process.env.NEXT_PUBLIC_ZK_CONTRACT_ADDRESS || 'Not set',
        circuitWasmUrl: process.env.NEXT_PUBLIC_ZK_CIRCUIT_WASM_URL || 'Not set',
        provingKeyUrl: process.env.NEXT_PUBLIC_ZK_PROVING_KEY_URL || 'Not set',
        verificationKeyUrl: process.env.NEXT_PUBLIC_ZK_VERIFICATION_KEY_URL || 'Not set'
      };

      setDebugInfo(prev => ({
        ...prev,
        blockchainStatus,
        zkServiceStatus,
        environmentVars,
        testResults: prev?.testResults
      }));
    } catch (error) {
      console.error('Failed to load debug info:', error);
    }
  };

  const runTests = async () => {
    setIsRunningTests(true);
    try {
      console.log('Running ZK service tests...');
      
      const initTest = await testZKServiceInitialization();
      console.log('Init test result:', initTest);
      
      let proofTest = null;
      if (initTest.success) {
        proofTest = await testZKProofGeneration();
        console.log('Proof test result:', proofTest);
      }

      setDebugInfo(prev => ({
        ...prev!,
        testResults: {
          initTest,
          proofTest
        }
      }));

      // Refresh debug info after tests
      await loadDebugInfo();
    } catch (error) {
      console.error('Test execution failed:', error);
    } finally {
      setIsRunningTests(false);
    }
  };

  useEffect(() => {
    loadDebugInfo();
  }, []);

  if (!debugInfo) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-blue-700"
      >
        ZK Debug {isVisible ? '▼' : '▲'}
      </button>
      
      {isVisible && (
        <div className="mt-2 bg-white border border-gray-300 rounded-lg shadow-lg p-4 max-w-lg max-h-96 overflow-y-auto">
          <h3 className="font-bold text-lg mb-3">ZK Service Debug Info</h3>
          
          <div className="space-y-4">
            <div className="flex gap-2 mb-4">
              <button
                onClick={loadDebugInfo}
                className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600"
              >
                Refresh
              </button>
              <button
                onClick={runTests}
                disabled={isRunningTests}
                className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600 disabled:bg-gray-400"
              >
                {isRunningTests ? 'Testing...' : 'Run Tests'}
              </button>
            </div>

            <div>
              <h4 className="font-semibold text-green-600">Blockchain Service</h4>
              <div className="text-sm space-y-1">
                <div>Initialized: <span className={debugInfo.blockchainStatus.initialized ? 'text-green-600' : 'text-red-600'}>
                  {debugInfo.blockchainStatus.initialized ? '✓' : '✗'}
                </span></div>
                <div>Circuits Loaded: <span className={debugInfo.blockchainStatus.circuitsLoaded ? 'text-green-600' : 'text-red-600'}>
                  {debugInfo.blockchainStatus.circuitsLoaded ? '✓' : '✗'}
                </span></div>
                <div>Contract: <span className="font-mono text-xs">{debugInfo.blockchainStatus.contractAddress}</span></div>
                {debugInfo.blockchainStatus.lastError && (
                  <div className="text-red-600">Error: {debugInfo.blockchainStatus.lastError}</div>
                )}
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-blue-600">ZK Service</h4>
              <div className="text-sm space-y-1">
                <div>Initialized: <span className={debugInfo.zkServiceStatus.initialized ? 'text-green-600' : 'text-red-600'}>
                  {debugInfo.zkServiceStatus.initialized ? '✓' : '✗'}
                </span></div>
                <div>Circuit: <span className={debugInfo.zkServiceStatus.circuitLoaded ? 'text-green-600' : 'text-red-600'}>
                  {debugInfo.zkServiceStatus.circuitLoaded ? '✓' : '✗'}
                </span></div>
                <div>Proving Key: <span className={debugInfo.zkServiceStatus.provingKeyLoaded ? 'text-green-600' : 'text-red-600'}>
                  {debugInfo.zkServiceStatus.provingKeyLoaded ? '✓' : '✗'}
                </span></div>
                <div>Verification Key: <span className={debugInfo.zkServiceStatus.verificationKeyLoaded ? 'text-green-600' : 'text-red-600'}>
                  {debugInfo.zkServiceStatus.verificationKeyLoaded ? '✓' : '✗'}
                </span></div>
                <div>Contract Connected: <span className={debugInfo.zkServiceStatus.contractConnected ? 'text-green-600' : 'text-red-600'}>
                  {debugInfo.zkServiceStatus.contractConnected ? '✓' : '✗'}
                </span></div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-purple-600">Environment</h4>
              <div className="text-xs space-y-1">
                <div>ZK Contract: <span className="font-mono">{debugInfo.environmentVars.zkContractAddress}</span></div>
                <div>Circuit WASM: <span className="font-mono">{debugInfo.environmentVars.circuitWasmUrl}</span></div>
                <div>Proving Key: <span className="font-mono">{debugInfo.environmentVars.provingKeyUrl}</span></div>
                <div>Verification Key: <span className="font-mono">{debugInfo.environmentVars.verificationKeyUrl}</span></div>
              </div>
            </div>

            {debugInfo.testResults && (
              <div>
                <h4 className="font-semibold text-orange-600">Test Results</h4>
                <div className="text-sm space-y-1">
                  <div>Init Test: <span className={debugInfo.testResults.initTest?.success ? 'text-green-600' : 'text-red-600'}>
                    {debugInfo.testResults.initTest?.success ? '✓' : '✗'}
                  </span></div>
                  {debugInfo.testResults.initTest?.error && (
                    <div className="text-red-600 text-xs">Error: {debugInfo.testResults.initTest.error}</div>
                  )}
                  {debugInfo.testResults.proofTest && (
                    <div>Proof Test: <span className={debugInfo.testResults.proofTest?.success ? 'text-green-600' : 'text-red-600'}>
                      {debugInfo.testResults.proofTest?.success ? '✓' : '✗'}
                    </span></div>
                  )}
                  {debugInfo.testResults.proofTest?.error && (
                    <div className="text-red-600 text-xs">Error: {debugInfo.testResults.proofTest.error}</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}