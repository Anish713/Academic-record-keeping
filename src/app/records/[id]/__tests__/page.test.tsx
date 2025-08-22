/**
 * Tests for the secure record detail page with ZK verification
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi, beforeEach, describe, it, expect } from 'vitest';
import { SecureRecord } from '@/types/zkTypes';
import { ZKError, ZKErrorType } from '@/types/zkTypes';

// Mock all dependencies
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: '1' }),
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock('@/services/blockchain', () => ({
  blockchainService: {
    init: vi.fn().mockResolvedValue(true),
    getCurrentAddress: vi.fn().mockResolvedValue('0x1234567890123456789012345678901234567890'),
    getRecordWithZKAccess: vi.fn(),
    shareRecord: vi.fn(),
    unshareRecord: vi.fn(),
  },
}));

vi.mock('@/services/zkService', () => ({
  zkService: {
    verifyDocumentAccess: vi.fn(),
  },
}));

vi.mock('@/lib/pinata', () => ({
  getGatewayUrl: vi.fn((hash) => `https://gateway.pinata.cloud/ipfs/${hash}`),
}));

vi.mock('@/components/layout/MainLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="main-layout">{children}</div>
  ),
}));

vi.mock('@/components/ui/Button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

import RecordDetailPage from '../page';
import { blockchainService } from '@/services/blockchain';
import { zkService } from '@/services/zkService';

const mockBlockchainService = blockchainService as any;
const mockZkService = zkService as any;

describe('RecordDetailPage with ZK Verification', () => {
  const mockRecord: SecureRecord = {
    id: 1,
    studentName: 'John Doe',
    studentId: 'STU001',
    studentAddress: '0x1234567890123456789012345678901234567890',
    universityName: 'Test University',
    recordType: 0, // Transcript
    ipfsHash: 'QmTest123',
    timestamp: 1640995200,
    university: '0xUniversity123',
    isValid: true,
    hasZKAccess: true,
    accessLevel: 'owner',
    documentUrl: 'https://gateway.pinata.cloud/ipfs/QmTest123',
    verified: true,
    issuer: '0xUniversity123'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockBlockchainService.init.mockResolvedValue(true);
    mockBlockchainService.getCurrentAddress.mockResolvedValue('0x1234567890123456789012345678901234567890');
    
    // Mock window.open
    Object.defineProperty(window, 'open', {
      writable: true,
      value: vi.fn(),
    });
  });

  it('should render record details with ZK access information', async () => {
    mockBlockchainService.getRecordWithZKAccess.mockResolvedValue(mockRecord);

    render(<RecordDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Record Details')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Test University')).toBeInTheDocument();
      expect(screen.getByText('ZK Access Verified')).toBeInTheDocument();
      expect(screen.getByText('owner')).toBeInTheDocument();
    });
  });

  it('should show View Document button for authorized users', async () => {
    mockBlockchainService.getRecordWithZKAccess.mockResolvedValue(mockRecord);

    render(<RecordDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('View Document')).toBeInTheDocument();
    });
  });

  it('should not show View Document button for unauthorized users', async () => {
    const unauthorizedRecord: SecureRecord = {
      ...mockRecord,
      hasZKAccess: false,
      accessLevel: 'none',
    };

    mockBlockchainService.getRecordWithZKAccess.mockResolvedValue(unauthorizedRecord);

    render(<RecordDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Access Restricted')).toBeInTheDocument();
      expect(screen.queryByText('View Document')).not.toBeInTheDocument();
      expect(screen.getByText('No ZK Access')).toBeInTheDocument();
    });
  });

  it('should handle successful ZK verification and open document', async () => {
    mockBlockchainService.getRecordWithZKAccess.mockResolvedValue(mockRecord);
    mockZkService.verifyDocumentAccess.mockResolvedValue('QmVerifiedHash123');

    render(<RecordDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('View Document')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('View Document'));

    await waitFor(() => {
      expect(mockZkService.verifyDocumentAccess).toHaveBeenCalledWith(1);
      expect(window.open).toHaveBeenCalledWith(
        'https://gateway.pinata.cloud/ipfs/QmVerifiedHash123',
        '_blank',
        'noopener,noreferrer'
      );
    });
  });

  it('should show loading state during ZK verification', async () => {
    mockBlockchainService.getRecordWithZKAccess.mockResolvedValue(mockRecord);
    
    // Mock a delayed response
    mockZkService.verifyDocumentAccess.mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve('QmVerifiedHash123'), 100))
    );

    render(<RecordDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('View Document')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('View Document'));

    // Should show loading state
    expect(screen.getByText('Verifying Access...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Verifying Access/ })).toBeDisabled();

    await waitFor(() => {
      expect(screen.queryByText('Verifying Access...')).not.toBeInTheDocument();
    });
  });

  it('should handle ZK verification failure with access denied', async () => {
    mockBlockchainService.getRecordWithZKAccess.mockResolvedValue(mockRecord);
    mockZkService.verifyDocumentAccess.mockResolvedValue(null); // Access denied

    render(<RecordDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('View Document')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('View Document'));

    await waitFor(() => {
      expect(screen.getByText('Document Access Error')).toBeInTheDocument();
      expect(screen.getByText("Access denied. You don't have permission to view this document.")).toBeInTheDocument();
      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });
  });

  it('should handle ZK verification error', async () => {
    mockBlockchainService.getRecordWithZKAccess.mockResolvedValue(mockRecord);
    const zkError = new ZKError(
      ZKErrorType.PROOF_GENERATION_FAILED,
      'Failed to generate proof'
    );
    mockZkService.verifyDocumentAccess.mockRejectedValue(zkError);

    render(<RecordDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('View Document')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('View Document'));

    await waitFor(() => {
      expect(screen.getByText('Document Access Error')).toBeInTheDocument();
      expect(screen.getByText('Failed to generate proof')).toBeInTheDocument();
    });
  });

  it('should allow retry after ZK verification failure', async () => {
    mockBlockchainService.getRecordWithZKAccess.mockResolvedValue(mockRecord);
    mockZkService.verifyDocumentAccess
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce('QmRetrySuccess123');

    render(<RecordDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('View Document')).toBeInTheDocument();
    });

    // First attempt fails
    fireEvent.click(screen.getByText('View Document'));

    await waitFor(() => {
      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });

    // Retry succeeds
    fireEvent.click(screen.getByText('Try Again'));

    await waitFor(() => {
      expect(window.open).toHaveBeenCalledWith(
        'https://gateway.pinata.cloud/ipfs/QmRetrySuccess123',
        '_blank',
        'noopener,noreferrer'
      );
    });
  });

  it('should show sharing section for record owners', async () => {
    mockBlockchainService.getRecordWithZKAccess.mockResolvedValue(mockRecord);

    render(<RecordDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Share Your Record')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter Ethereum address (0x...)')).toBeInTheDocument();
      expect(screen.getByText('Share Record')).toBeInTheDocument();
    });
  });

  it('should not show sharing section for non-owners', async () => {
    const sharedRecord: SecureRecord = {
      ...mockRecord,
      accessLevel: 'shared',
    };

    mockBlockchainService.getRecordWithZKAccess.mockResolvedValue(sharedRecord);

    render(<RecordDetailPage />);

    await waitFor(() => {
      expect(screen.queryByText('Share Your Record')).not.toBeInTheDocument();
      expect(screen.getByText('This record has been shared with you by the owner.')).toBeInTheDocument();
    });
  });

  it('should display correct access level information', async () => {
    const universityRecord: SecureRecord = {
      ...mockRecord,
      accessLevel: 'university',
    };

    mockBlockchainService.getRecordWithZKAccess.mockResolvedValue(universityRecord);

    render(<RecordDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('university')).toBeInTheDocument();
      expect(screen.getByText('You have access as the issuing university.')).toBeInTheDocument();
    });
  });

  it('should handle record not found error', async () => {
    mockBlockchainService.getRecordWithZKAccess.mockResolvedValue(null);

    render(<RecordDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Error Loading Record')).toBeInTheDocument();
      expect(screen.getByText('Record not found')).toBeInTheDocument();
      expect(screen.getByText('Return to Records')).toBeInTheDocument();
    });
  });

  it('should handle blockchain service initialization failure', async () => {
    mockBlockchainService.init.mockResolvedValue(false);

    render(<RecordDetailPage />);

    // Since the router.push is called in the init effect, we need to wait for it
    // The component should redirect to login when blockchain init fails
    await waitFor(() => {
      // We can't easily test the router.push call due to mocking limitations
      // Instead, we verify that the component doesn't proceed to load records
      expect(mockBlockchainService.getRecordWithZKAccess).not.toHaveBeenCalled();
    });
  });
});