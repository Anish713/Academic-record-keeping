import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import AdminPage from '../page';
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

describe('Admin Dashboard ZK Integration', () => {
  const mockPush = vi.fn();
  const mockAdminAddress = '0x1234567890123456789012345678901234567890';

  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as Mock).mockReturnValue({
      push: mockPush,
    });

    // Mock successful blockchain service initialization
    (blockchainService.init as Mock).mockResolvedValue(true);
    (blockchainService.getCurrentAddress as Mock).mockResolvedValue(mockAdminAddress);
    (blockchainService.hasRole as Mock).mockImplementation((role: string) => {
      return Promise.resolve(role === 'ADMIN_ROLE' || role === 'SUPER_ADMIN_ROLE');
    });
    (blockchainService.isPaused as Mock).mockResolvedValue(false);
    (blockchainService.getAllUniversities as Mock).mockResolvedValue([]);
    (blockchainService.getTotalRecords as Mock).mockResolvedValue(10);
    (blockchainService.getTotalCustomTypes as Mock).mockResolvedValue(5);
    (blockchainService.getAllAdmins as Mock).mockResolvedValue([mockAdminAddress]);
  });

  describe('ZK Monitoring Tab', () => {
    it('should display ZK monitoring tab for admin users', async () => {
      const mockZKRecords = [
        {
          id: 1,
          studentName: 'John Doe',
          universityName: 'Test University',
          hasZKAccess: true,
          accessLevel: 'admin',
          documentUrl: 'https://example.com/doc1.pdf'
        },
        {
          id: 2,
          studentName: 'Jane Smith',
          universityName: 'Another University',
          hasZKAccess: false,
          accessLevel: 'admin',
          documentUrl: undefined
        }
      ];

      (blockchainService.getAdminRecordsWithZKAccess as Mock).mockResolvedValue(mockZKRecords);

      render(<AdminPage />);

      await waitFor(() => {
        expect(screen.getByText('ZK Monitoring')).toBeInTheDocument();
      });

      // Click on ZK Monitoring tab
      fireEvent.click(screen.getByText('ZK Monitoring'));

      await waitFor(() => {
        expect(screen.getByText('ZK Access Control Monitoring')).toBeInTheDocument();
      });
    });

    it('should display ZK statistics correctly', async () => {
      const mockZKRecords = [
        { id: 1, hasZKAccess: true, accessLevel: 'admin', documentUrl: 'https://example.com/doc1.pdf' },
        { id: 2, hasZKAccess: true, accessLevel: 'admin', documentUrl: 'https://example.com/doc2.pdf' },
        { id: 3, hasZKAccess: false, accessLevel: 'admin', documentUrl: undefined }
      ];

      (blockchainService.getAdminRecordsWithZKAccess as Mock).mockResolvedValue(mockZKRecords);

      render(<AdminPage />);

      await waitFor(() => {
        expect(screen.getByText('ZK Monitoring')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('ZK Monitoring'));

      await waitFor(() => {
        // Should show ZK monitoring interface
        expect(screen.getByText('ZK Access Control Monitoring')).toBeInTheDocument();
        
        // Check for ZK statistics cards - use getAllByText to handle multiple instances
        const zkProtectedElements = screen.getAllByText('ZK Protected Records');
        expect(zkProtectedElements.length).toBeGreaterThan(0);
        
        expect(screen.getByText('Successful Proofs')).toBeInTheDocument();
        expect(screen.getByText('Failed Proofs')).toBeInTheDocument();
      });
    });

    it('should display ZK records table with proper status indicators', async () => {
      const mockZKRecords = [
        {
          id: 1,
          studentName: 'John Doe',
          universityName: 'Test University',
          hasZKAccess: true,
          accessLevel: 'admin',
          documentUrl: 'https://example.com/doc1.pdf'
        }
      ];

      (blockchainService.getAdminRecordsWithZKAccess as Mock).mockResolvedValue(mockZKRecords);

      render(<AdminPage />);

      await waitFor(() => {
        expect(screen.getByText('ZK Monitoring')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('ZK Monitoring'));

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Test University')).toBeInTheDocument();
        expect(screen.getByText('ZK Protected')).toBeInTheDocument();
        expect(screen.getByText('admin')).toBeInTheDocument();
      });
    });

    it('should handle empty ZK records gracefully', async () => {
      (blockchainService.getAdminRecordsWithZKAccess as Mock).mockResolvedValue([]);

      render(<AdminPage />);

      await waitFor(() => {
        expect(screen.getByText('ZK Monitoring')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('ZK Monitoring'));

      await waitFor(() => {
        expect(screen.getByText('No ZK protected records found')).toBeInTheDocument();
      });
    });

    it('should display ZK system health information', async () => {
      (blockchainService.getAdminRecordsWithZKAccess as Mock).mockResolvedValue([]);

      render(<AdminPage />);

      await waitFor(() => {
        expect(screen.getByText('ZK Monitoring')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('ZK Monitoring'));

      await waitFor(() => {
        expect(screen.getByText('ZK System Health')).toBeInTheDocument();
        expect(screen.getByText('Access Attempts')).toBeInTheDocument();
        expect(screen.getByText('System Status')).toBeInTheDocument();
        expect(screen.getByText('ZK Service: Online')).toBeInTheDocument();
        expect(screen.getByText('Circuit: Loaded')).toBeInTheDocument();
        expect(screen.getByText('Verifier Contract: Active')).toBeInTheDocument();
      });
    });
  });

  describe('ZK Records Management', () => {
    it('should allow admin to view ZK protected records', async () => {
      const mockZKRecords = [
        {
          id: 1,
          studentName: 'John Doe',
          universityName: 'Test University',
          hasZKAccess: true,
          accessLevel: 'admin',
          documentUrl: 'https://example.com/doc1.pdf'
        }
      ];

      (blockchainService.getAdminRecordsWithZKAccess as Mock).mockResolvedValue(mockZKRecords);

      render(<AdminPage />);

      await waitFor(() => {
        expect(screen.getByText('ZK Monitoring')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('ZK Monitoring'));

      await waitFor(() => {
        const viewButton = screen.getByText('View');
        expect(viewButton).toBeInTheDocument();
        
        fireEvent.click(viewButton);
        expect(mockPush).toHaveBeenCalledWith('/records/1');
      });
    });

    it('should allow admin to access documents through ZK verification', async () => {
      const mockZKRecords = [
        {
          id: 1,
          studentName: 'John Doe',
          universityName: 'Test University',
          hasZKAccess: true,
          accessLevel: 'admin',
          documentUrl: 'https://example.com/doc1.pdf'
        }
      ];

      (blockchainService.getAdminRecordsWithZKAccess as Mock).mockResolvedValue(mockZKRecords);

      // Mock window.open
      const mockWindowOpen = vi.fn();
      Object.defineProperty(window, 'open', {
        value: mockWindowOpen,
        writable: true
      });

      render(<AdminPage />);

      await waitFor(() => {
        expect(screen.getByText('ZK Monitoring')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('ZK Monitoring'));

      await waitFor(() => {
        const documentButton = screen.getByText('Document');
        expect(documentButton).toBeInTheDocument();
        
        fireEvent.click(documentButton);
        expect(mockWindowOpen).toHaveBeenCalledWith('https://example.com/doc1.pdf', '_blank');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle ZK service failures gracefully', async () => {
      (blockchainService.getAdminRecordsWithZKAccess as Mock).mockRejectedValue(new Error('ZK service unavailable'));

      render(<AdminPage />);

      await waitFor(() => {
        expect(screen.getByText('ZK Monitoring')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('ZK Monitoring'));

      await waitFor(() => {
        // Should still render the monitoring interface even if ZK service fails
        expect(screen.getByText('ZK Access Control Monitoring')).toBeInTheDocument();
        expect(screen.getByText('No ZK protected records found')).toBeInTheDocument();
      });
    });

    it('should display fallback information when ZK stats are unavailable', async () => {
      (blockchainService.getAdminRecordsWithZKAccess as Mock).mockResolvedValue([]);

      render(<AdminPage />);

      await waitFor(() => {
        expect(screen.getByText('ZK Monitoring')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('ZK Monitoring'));

      await waitFor(() => {
        // Should still render the monitoring interface even if ZK service fails
        expect(screen.getByText('ZK Access Control Monitoring')).toBeInTheDocument();
        
        // Should show the statistics cards with zero values - use getAllByText to handle multiple instances
        const zkProtectedElements = screen.getAllByText('ZK Protected Records');
        expect(zkProtectedElements.length).toBeGreaterThan(0);
        
        expect(screen.getByText('Successful Proofs')).toBeInTheDocument();
        expect(screen.getByText('Failed Proofs')).toBeInTheDocument();
      });
    });
  });

  describe('Admin Privileges', () => {
    it('should show ZK monitoring tab only for admin users', async () => {
      // Mock non-admin user
      (blockchainService.hasRole as Mock).mockImplementation((role: string) => {
        return Promise.resolve(false);
      });

      render(<AdminPage />);

      await waitFor(() => {
        // Should redirect to login for non-admin users
        expect(mockPush).toHaveBeenCalledWith('/login');
      });
    });

    it('should allow super admin to access ZK monitoring', async () => {
      (blockchainService.hasRole as Mock).mockImplementation((role: string) => {
        return Promise.resolve(role === 'SUPER_ADMIN_ROLE');
      });

      (blockchainService.getAdminRecordsWithZKAccess as Mock).mockResolvedValue([]);

      render(<AdminPage />);

      await waitFor(() => {
        expect(screen.getByText('ZK Monitoring')).toBeInTheDocument();
      });
    });
  });
});