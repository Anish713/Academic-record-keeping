/**
 * Tests for the enhanced Records page with ZK access control and shared records functionality
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { SecureRecord, SharedRecordInfo } from '@/types/zkTypes';

// Mock all dependencies
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock('@/services/blockchain', () => ({
  blockchainService: {
    init: vi.fn().mockResolvedValue(true),
    getCurrentAddress: vi.fn().mockResolvedValue('0x1234567890123456789012345678901234567890'),
    hasRole: vi.fn().mockResolvedValue(false),
    getStudentRecordsByAddress: vi.fn().mockResolvedValue([]),
    getRecordWithZKAccess: vi.fn(),
    getSharedRecordsWithAccess: vi.fn().mockResolvedValue([]),
    isZKEnabled: vi.fn().mockReturnValue(true),
  },
}));

vi.mock('@/components/layout/MainLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="main-layout">{children}</div>
  ),
}));

vi.mock('@/components/ui/Button', () => ({
  Button: ({ children, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
}));

import RecordsPage from '../page';
import { blockchainService } from '@/services/blockchain';

const mockBlockchainService = blockchainService as any;

describe('RecordsPage with ZK Access Control', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBlockchainService.init.mockResolvedValue(true);
    mockBlockchainService.getCurrentAddress.mockResolvedValue('0x1234567890123456789012345678901234567890');
    mockBlockchainService.hasRole.mockResolvedValue(false);
    mockBlockchainService.isZKEnabled.mockReturnValue(true);
  });

  it('should render the records page with tabs', async () => {
    mockBlockchainService.getStudentRecordsByAddress.mockResolvedValue([]);
    mockBlockchainService.getSharedRecordsWithAccess.mockResolvedValue([]);

    render(<RecordsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('My Records (0)')).toBeInTheDocument();
      expect(screen.getByText('Shared with Me (0)')).toBeInTheDocument();
    });
  });

  it('should display owned records with ZK access', async () => {
    const mockOwnedRecord: SecureRecord = {
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
      documentUrl: 'https://gateway.pinata.cloud/ipfs/QmTest123'
    };

    mockBlockchainService.getStudentRecordsByAddress.mockResolvedValue([1]);
    mockBlockchainService.getRecordWithZKAccess.mockResolvedValue(mockOwnedRecord);
    mockBlockchainService.getSharedRecordsWithAccess.mockResolvedValue([]);

    render(<RecordsPage />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Transcript')).toBeInTheDocument();
      expect(screen.getByText('View Document')).toBeInTheDocument();
    });
  });

  it('should display shared records in the shared tab', async () => {
    const mockSharedRecord: SecureRecord = {
      id: 2,
      studentName: 'Jane Smith',
      studentId: 'STU002',
      studentAddress: '0x2345678901234567890123456789012345678901',
      universityName: 'Another University',
      recordType: 1, // Degree
      ipfsHash: 'QmTest456',
      timestamp: 1641081600,
      university: '0xUniversity456',
      isValid: true,
      hasZKAccess: true,
      accessLevel: 'shared',
      documentUrl: 'https://gateway.pinata.cloud/ipfs/QmTest456'
    };

    const mockSharedRecordInfo: SharedRecordInfo = {
      recordId: 2,
      sharedBy: '0x2345678901234567890123456789012345678901',
      sharedAt: 1641081600,
      accessLevel: 'shared',
      record: mockSharedRecord
    };

    mockBlockchainService.getStudentRecordsByAddress.mockResolvedValue([]);
    mockBlockchainService.getSharedRecordsWithAccess.mockResolvedValue([mockSharedRecordInfo]);

    render(<RecordsPage />);

    // Wait for the shared records to load and update the count
    await waitFor(() => {
      expect(screen.getByText(/Shared with Me \(1\)/)).toBeInTheDocument();
    });

    // Switch to shared tab
    fireEvent.click(screen.getByText(/Shared with Me \(1\)/));

    await waitFor(() => {
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.getByText('Degree')).toBeInTheDocument();
      expect(screen.getByText('Shared')).toBeInTheDocument(); // Shared badge
      expect(screen.getByText(/Shared by: 0x2345/)).toBeInTheDocument();
      expect(screen.getByText('View Document')).toBeInTheDocument();
    });
  });

  it('should not show View Document button for records without ZK access', async () => {
    const recordWithoutAccess: SecureRecord = {
      id: 1,
      studentName: 'John Doe',
      studentId: 'STU001',
      studentAddress: '0x1234567890123456789012345678901234567890',
      universityName: 'Test University',
      recordType: 0,
      ipfsHash: 'QmTest123',
      timestamp: 1640995200,
      university: '0xUniversity123',
      isValid: true,
      hasZKAccess: false,
      accessLevel: 'none',
    };

    mockBlockchainService.getStudentRecordsByAddress.mockResolvedValue([1]);
    mockBlockchainService.getRecordWithZKAccess.mockResolvedValue(recordWithoutAccess);
    mockBlockchainService.getSharedRecordsWithAccess.mockResolvedValue([]);

    render(<RecordsPage />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.queryByText('View Document')).not.toBeInTheDocument();
      expect(screen.getByText('Verify')).toBeInTheDocument(); // Verify button should still be present
    });
  });

  it('should show ZK access status indicator', async () => {
    mockBlockchainService.getStudentRecordsByAddress.mockResolvedValue([1]);
    mockBlockchainService.getRecordWithZKAccess.mockResolvedValue({
      id: 1,
      studentName: 'John Doe',
      studentId: 'STU001',
      studentAddress: '0x1234567890123456789012345678901234567890',
      universityName: 'Test University',
      recordType: 0,
      ipfsHash: 'QmTest123',
      timestamp: 1640995200,
      university: '0xUniversity123',
      isValid: true,
      hasZKAccess: true,
      accessLevel: 'owner',
    });
    mockBlockchainService.getSharedRecordsWithAccess.mockResolvedValue([]);
    mockBlockchainService.isZKEnabled.mockReturnValue(true);

    render(<RecordsPage />);

    await waitFor(() => {
      expect(screen.getByText('Zero Knowledge Access Control')).toBeInTheDocument();
      expect(screen.getByText('ZK access control is active. Only authorized users can view document contents.')).toBeInTheDocument();
    });
  });

  it('should switch between tabs correctly', async () => {
    mockBlockchainService.getStudentRecordsByAddress.mockResolvedValue([]);
    mockBlockchainService.getSharedRecordsWithAccess.mockResolvedValue([]);

    render(<RecordsPage />);

    await waitFor(() => {
      const ownedTab = screen.getByText('My Records (0)');
      const sharedTab = screen.getByText('Shared with Me (0)');

      expect(ownedTab).toHaveClass('border-blue-500', 'text-blue-600');
      expect(sharedTab).toHaveClass('border-transparent', 'text-gray-500');
    });

    // Switch to shared tab
    fireEvent.click(screen.getByText('Shared with Me (0)'));

    await waitFor(() => {
      const ownedTab = screen.getByText('My Records (0)');
      const sharedTab = screen.getByText('Shared with Me (0)');

      expect(sharedTab).toHaveClass('border-blue-500', 'text-blue-600');
      expect(ownedTab).toHaveClass('border-transparent', 'text-gray-500');
    });
  });
});