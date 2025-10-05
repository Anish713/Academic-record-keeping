import { BaseContractService } from "./base-contract.service";
import AcademicRecords from "../../contracts/AcademicRecords.json";
import { roleManagementService, UserRole } from "./role-management.service";

/**
 * University interface for type safety
 */
export interface University {
  address: string;
  name: string;
  isActive: boolean;
  registrationDate?: number;
}

/**
 * University Management Service
 * Handles university registration, management, and related operations
 */
export class UniversityManagementService extends BaseContractService {
  constructor(contractAddress: string) {
    super(contractAddress, AcademicRecords.abi);
  }

  /**
   * Add a new university to the system
   * @param address - university wallet address
   * @param name - university name
   * @returns Promise<void>
   */
  async addUniversity(address: string, name: string): Promise<void> {
    // First add the university role
    await roleManagementService.addUniversity(address);

    // Then register the university details
    await this.executeTransaction("addUniversity", address, name);
  }

  /**
   * Set/update university name
   * @param address - university address
   * @param name - new university name
   * @returns Promise<void>
   */
  async setUniversityName(address: string, name: string): Promise<void> {
    await this.executeTransaction("setUniversityName", address, name);
  }

  /**
   * Get university name by address
   * @param address - university address
   * @returns Promise<string>
   */
  async getUniversityName(address: string): Promise<string> {
    return await this.executeCall("getUniversityName", address);
  }

  /**
   * Get all registered universities
   * @returns Promise<University[]>
   */
  async getAllUniversities(): Promise<University[]> {
    const addresses: string[] = await this.executeCall("getAllUniversities");

    const universities: University[] = await Promise.all(
      addresses.map(async (address: string) => {
        let name = "Unnamed University";
        let isActive = false;

        try {
          name = await this.getUniversityName(address);
          isActive = await roleManagementService.hasRole(
            UserRole.UNIVERSITY_ROLE,
            address
          );
        } catch (err) {
          console.warn(
            `Failed to fetch details for university ${address}`,
            err
          );
        }

        return {
          address,
          name,
          isActive,
        };
      })
    );

    return universities;
  }

  /**
   * Remove a university from the system
   * @param universityAddress - university address to remove
   * @returns Promise<void>
   */
  async removeUniversity(universityAddress: string): Promise<void> {
    // Remove university role first
    await roleManagementService.removeUniversity(universityAddress);

    // Then remove from university registry
    await this.executeTransaction("removeUniversity", universityAddress);
  }

  /**
   * Check if an address is a registered university
   * @param address - address to check
   * @returns Promise<boolean>
   */
  async isUniversity(address: string): Promise<boolean> {
    return await roleManagementService.hasRole(
      UserRole.UNIVERSITY_ROLE,
      address
    );
  }

  /**
   * Get university details by address
   * @param address - university address
   * @returns Promise<University>
   */
  async getUniversityDetails(address: string): Promise<University> {
    const name = await this.getUniversityName(address);
    const isActive = await this.isUniversity(address);

    return {
      address,
      name,
      isActive,
    };
  }

  /**
   * Check if current user is a university
   * @returns Promise<boolean>
   */
  async isCurrentUserUniversity(): Promise<boolean> {
    return await roleManagementService.isCurrentUserUniversity();
  }

  /**
   * Get records count for a specific university
   * @param universityAddress - university address (optional, defaults to current user)
   * @returns Promise<number>
   */
  async getUniversityRecordsCount(universityAddress?: string): Promise<number> {
    const targetAddress = universityAddress || (await this.getCurrentAddress());
    const recordIds = await this.executeCall(
      "getUniversityRecords",
      targetAddress
    );
    return recordIds.length;
  }

  /**
   * Get all record IDs for a university
   * @param universityAddress - university address (optional, defaults to current user)
   * @returns Promise<number[]>
   */
  async getUniversityRecords(universityAddress?: string): Promise<number[]> {
    const targetAddress = universityAddress || (await this.getCurrentAddress());
    const recordIds = await this.executeCall(
      "getUniversityRecords",
      targetAddress
    );
    return recordIds.map((id: bigint) => Number(id));
  }

  /**
   * Get university statistics
   * @param universityAddress - university address (optional, defaults to current user)
   * @returns Promise<UniversityStats>
   */
  async getUniversityStats(universityAddress?: string): Promise<{
    totalRecords: number;
    university: University;
  }> {
    const targetAddress = universityAddress || (await this.getCurrentAddress());

    const [totalRecords, university] = await Promise.all([
      this.getUniversityRecordsCount(targetAddress),
      this.getUniversityDetails(targetAddress),
    ]);

    return {
      totalRecords,
      university,
    };
  }

  /**
   * Validate university operations permissions
   * @param requiredRole - minimum role required
   * @returns Promise<boolean>
   */
  async validateUniversityPermissions(
    requiredRole: UserRole = UserRole.ADMIN_ROLE
  ): Promise<boolean> {
    const currentAddress = await this.getCurrentAddress();
    return await roleManagementService.hasRole(requiredRole, currentAddress);
  }

  /**
   * Search universities by name (fuzzy search)
   * @param searchTerm - search term
   * @returns Promise<University[]>
   */
  async searchUniversities(searchTerm: string): Promise<University[]> {
    const allUniversities = await this.getAllUniversities();

    if (!searchTerm.trim()) {
      return allUniversities;
    }

    const term = searchTerm.toLowerCase();
    return allUniversities.filter(
      (university) =>
        university.name.toLowerCase().includes(term) ||
        university.address.toLowerCase().includes(term)
    );
  }

  /**
   * Helper method to get current address from wallet service
   * @returns Promise<string>
   */
  private async getCurrentAddress(): Promise<string> {
    const walletService = await import("./wallet.service");
    return await walletService.walletService.getCurrentAddress();
  }
}

// Export singleton instance
export const universityManagementService = new UniversityManagementService(
  process.env.NEXT_PUBLIC_ACADEMIC_RECORDS_CONTRACT_ADDRESS || ""
);
