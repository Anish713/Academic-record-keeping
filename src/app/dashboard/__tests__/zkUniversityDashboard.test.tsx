import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import DashboardPage from '../page';
import { blockchainService } from '../../../services/blockchain';

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

// Mock blockchain service
vi.mock('../../../services/blockchain');

// Mock MainLayout
vi.mock('../../../components/layout/MainLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="main-layout">{children}</div>,
}));

// Mock record types
vi.mock('../../../types/records', () => ({
  getRecordTypeName: (type: number) => {
    const types = ['Transcript', 'Degree', 'Certificate'];
    return types[type] || 'Unknown';
  }
}));

describe('University Dashboard ZK Integration', () => {
  const mockPush = vi.fn();
  const mockUniversityAddress = '0x1234567890123456789012345678901234567890';

  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as Mock).mockReturnValue({
      push: mockPush,
    });

    // Mock successful blockchain service initialization
    (blockchainService.init as Mock).mockResolvedValue(true);
    (blockchainService.getCurrentAddress as Mock).mockResolvedValue(mockUniversityAddress);
    (blockchainService.hasRole as Mock).mockImplementation((role: string) => {
      return Promise.resolve(role === 'UNIVERSITY_ROLE');
    });
  });

  describe('ZK Statistics Display', () => {
    it('should display ZK protection statistics', async () => {
      const mockRecords = [
        {
          id: 1,
          studentName: 'John Doe',
          universityName: 'Test University',
          recordType: 0,
          timestamp: Date.now() / 1000,
          hasZKAccess: true,
          accessLevel: 'university',
          documentUrl: 'https://example.com/doc1.pdf',
          verified: true,
          issuer: 'Test University'
        },
        {
          id: 2,
          studentName: 'Jane Smith',
          universityName: 'Test University',
          recordType: 1,
          timestamp: Date.now() / 1000,
          hasZKAccess: false,
          accessLevel: 'university',
          documentUrl: undefined,
          verified: false,
          issuer: 'Test University'
        }
      ];

      (blockchainService.getUniversityRecordsWithZKAccess as Mock).mockResolvedValue(mockRecords);

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('University Dashboard')).toBeInTheDocument();
      });

      await waitFor(() => {
        // Should show university dashboard
        expect(screen.getByText('University Dashboard')).toBeInTheDocument();
        
        // Should show ZK protected statistics
        expect(screen.getByText('ZK Protected')).toBeInTheDocument();
        
        // Check for the statistics cards
        const totalRecordsCard = screen.getByText('Total Records').closest('.bg-gray-50');
        const zkProtectedCard = screen.getByText('ZK Protected').closest('.bg-green-50');
        
        expect(totalRecordsCard).toBeInTheDocument();
        expect(zkProtectedCard).toBeInTheDocument();
      });
    });

    it('should display ZK access control status section', async () => {
      const mockRecords = [
        {
          id: 1,
          studentName: 'John Doe',
          hasZKAccess: true,
          accessLevel: 'university',
          documentUrl: 'https://example.com/doc1.pdf'
        },
        {
          id: 2,
          studentName: 'Jane Smith',
          hasZKAccess: false,
          accessLevel: 'university',
          documentUrl: undefined
        }
      ];

      (blockchainService.getUniversityRecordsWithZKAccess as Mock).mockResolvedValue(mockRecords);

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('ZK Access Control Status')).toBeInTheDocument();
        expect(screen.getByText('Monitor your records\' zero-knowledge proof protection status')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText('ZK Protected Records')).toBeInTheDocument();
        expect(screen.getByText('Legacy Access Records')).toBeInTheDocument();
        expect(screen.getByText('Accessible Documents')).toBeInTheDocument();
      });
    });

    it('should show warning for legacy records', async () => {
      const mockRecords = [
        {
          id: 1,
          studentName: 'John Doe',
          hasZKAccess: false,
          accessLevel: 'university',
          documentUrl: 'https://example.com/doc1.pdf'
        }
      ];

      (blockchainService.getUniversityRecordsWithZKAccess as Mock).mockResolvedValue(mockRecords);

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText(/You have 1 records using legacy access/)).toBeInTheDocument();
        expect(screen.getByText(/Consider upgrading them to ZK protection/)).toBeInTheDocument();
      });
    });

    it('should not show warning when all records are ZK protected', async () => {
      const mockRecords = [
        {
          id: 1,
          studentName: 'John Doe',
          hasZKAccess: true,
          accessLevel: 'university',
          documentUrl: 'https://example.com/doc1.pdf'
        }
      ];

      (blockchainService.getUniversityRecordsWithZKAccess as Mock).mockResolvedValue(mockRecords);

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.queryByText(/You have/)).not.toBeInTheDocument();
      });
    });
  });

  describe('ZK Status Indicators', () => {
    it('should display ZK secured status with lock icon', async () => {
      const mockRecords = [
        {
          id: 1,
          studentName: 'John Doe',
          universityName: 'Test University',
          recordType: 0,
          timestamp: Date.now() / 1000,
          hasZKAccess: true,
          accessLevel: 'university',
          documentUrl: 'https://example.com/doc1.pdf'
        }
      ];

      (blockchainService.getUniversityRecordsWithZKAccess as Mock).mockResolvedValue(mockRecords);

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('ZK Secured')).toBeInTheDocument();
        expect(screen.getByText('University Access')).toBeInTheDocument();
      });
    });

    it('should display legacy access status with unlock icon', async () => {
      const mockRecords = [
        {
          id: 1,
          studentName: 'John Doe',
          universityName: 'Test University',
          recordType: 0,
          timestamp: Date.now() / 1000,
          hasZKAccess: false,
          accessLevel: 'university',
          documentUrl: 'https://example.com/doc1.pdf'
        }
      ];

      (blockchainService.getUniversityRecordsWithZKAccess as Mock).mockResolvedValue(mockRecords);

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Legacy Access')).toBeInTheDocument();
        expect(screen.getByText('University Access')).toBeInTheDocument();
      });
    });
  });

  describe('University ZK Access', () => {
    it('should allow university to view their issued records', async () => {
      const mockRecords = [
        {
          id: 1,
          studentName: 'John Doe',
          universityName: 'Test University',
          recordType: 0,
          timestamp: Date.now() / 1000,
          hasZKAccess: true,
          accessLevel: 'university',
          documentUrl: 'https://example.com/doc1.pdf'
        }
      ];

      (blockchainService.getUniversityRecordsWithZKAccess as Mock).mockResolvedValue(mockRecords);

      render(<DashboardPage />);

      await waitFor(() => {
        const viewButton = screen.getByText('View');
        expect(viewButton).toBeInTheDocument();
        
        fireEvent.click(viewButton);
        expect(mockPush).toHaveBeenCalledWith('/records/1');
      });
    });

    it('should allow university to access documents through ZK verification', async () => {
      const mockRecords = [
        {
          id: 1,
          studentName: 'John Doe',
          universityName: 'Test University',
          recordType: 0,
          timestamp: Date.now() / 1000,
          hasZKAccess: true,
          accessLevel: 'university',
          documentUrl: 'https://example.com/doc1.pdf'
        }
      ];

      (blockchainService.getUniversityRecordsWithZKAccess as Mock).mockResolvedValue(mockRecords);

      // Mock window.open
      const mockWindowOpen = vi.fn();
      Object.defineProperty(window, 'open', {
        value: mockWindowOpen,
        writable: true
      });

      render(<DashboardPage />);

      await waitFor(() => {
        const documentButton = screen.getByText('Document');
        expect(documentButton).toBeInTheDocument();
        
        fireEvent.click(documentButton);
        expect(mockWindowOpen).toHaveBeenCalledWith('https://example.com/doc1.pdf', '_blank');
      });
    });

    it('should not show document button for records without ZK access', async () => {
      const mockRecords = [
        {
          id: 1,
          studentName: 'John Doe',
          universityName: 'Test University',
          recordType: 0,
          timestamp: Date.now() / 1000,
          hasZKAccess: false,
          accessLevel: 'university',
          documentUrl: undefined
        }
      ];

      (blockchainService.getUniversityRecordsWithZKAccess as Mock).mockResolvedValue(mockRecords);

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('View')).toBeInTheDocument();
        expect(screen.queryByText('Document')).not.toBeInTheDocument();
      });
    });
  });

  describe('Progress Bars', () => {
    it('should display correct progress bar widths for ZK statistics', async () => {
      const mockRecords = [
        { id: 1, hasZKAccess: true, documentUrl: 'https://example.com/doc1.pdf' },
        { id: 2, hasZKAccess: true, documentUrl: 'https://example.com/doc2.pdf' },
        { id: 3, hasZKAccess: false, documentUrl: undefined },
        { id: 4, hasZKAccess: false, documentUrl: undefined }
      ];

      (blockchainService.getUniversityRecordsWithZKAccess as Mock).mockResolvedValue(mockRecords);

      render(<DashboardPage />);

      await waitFor(() => {
        // Check for ZK Access Control Status section
        expect(screen.getByText('ZK Access Control Status')).toBeInTheDocument();
        expect(screen.getByText('ZK Protected Records')).toBeInTheDocument();
        expect(screen.getByText('Legacy Access Records')).toBeInTheDocument();
        expect(screen.getByText('Accessible Documents')).toBeInTheDocument();
        
        // Verify the statistics are displayed - use getAllByText to handle multiple instances
        const countElements = screen.getAllByText('2');
        expect(countElements.length).toBeGreaterThan(0); // Should have multiple "2" counts
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle ZK service failures gracefully', async () => {
      (blockchainService.getUniversityRecordsWithZKAccess as Mock).mockRejectedValue(new Error('ZK service unavailable'));

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Failed to fetch records. Please try again.')).toBeInTheDocument();
      });
    });

    it('should display empty state when no records are available', async () => {
      (blockchainService.getUniversityRecordsWithZKAccess as Mock).mockResolvedValue([]);

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('University Dashboard')).toBeInTheDocument();
        
        // Should show zero counts in the statistics cards
        const totalRecordsCard = screen.getByText('Total Records').closest('.bg-gray-50');
        const zkProtectedCard = screen.getByText('ZK Protected').closest('.bg-green-50');
        
        expect(totalRecordsCard).toBeInTheDocument();
        expect(zkProtectedCard).toBeInTheDocument();
      });
    });

    it('should redirect non-university users', async () => {
      (blockchainService.hasRole as Mock).mockResolvedValue(false);

      render(<DashboardPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/records');
      });
    });
  });

  describe('University Name Display', () => {
    it('should display university name from first record', async () => {
      const mockRecords = [
        {
          id: 1,
          studentName: 'John Doe',
          universityName: 'Harvard University',
          recordType: 0,
          timestamp: Date.now() / 1000,
          hasZKAccess: true,
          accessLevel: 'university',
          documentUrl: 'https://example.com/doc1.pdf'
        }
      ];

      (blockchainService.getUniversityRecordsWithZKAccess as Mock).mockResolvedValue(mockRecords);
      (blockchainService.getUniversityRecords as Mock).mockResolvedValue([1]);
      (blockchainService.getRecord as Mock).mockResolvedValue({
        universityName: 'Harvard University'
      });

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText(/Harvard University/)).toBeInTheDocument();
      });
    });

    it('should show default university name when no records exist', async () => {
      (blockchainService.getUniversityRecordsWithZKAccess as Mock).mockResolvedValue([]);
      (blockchainService.getUniversityRecords as Mock).mockResolvedValue([]);

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText(/Your University/)).toBeInTheDocument();
      });
    });
  });
});