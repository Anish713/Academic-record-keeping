import { BaseContractService } from "./base-contract.service";
import StudentManagement from "../../contracts/StudentManagement.json";

/**
 * Student interface for type safety
 */
export interface Student {
  studentId: string;
  address: string;
  registrationDate?: number;
  isActive: boolean;
}

/**
 * Student Management Service
 * Handles student registration, management, and ID mapping
 */
export class StudentManagementService extends BaseContractService {
  constructor(contractAddress: string) {
    super(contractAddress, StudentManagement.abi);
  }

  /**
   * Register a new student
   * @param studentId - unique student identifier
   * @param studentAddress - student wallet address (optional, defaults to current user)
   * @returns Promise<void>
   */
  async registerStudent(
    studentId: string,
    studentAddress?: string
  ): Promise<void> {
    const address = studentAddress || (await this.getCurrentAddress());
    await this.executeTransaction("registerStudent", studentId, address);
  }

  /**
   * Get student ID by wallet address
   * @param address - wallet address
   * @returns Promise<string>
   */
  async getStudentId(address: string): Promise<string> {
    return await this.executeCall("getStudentId", address);
  }

  /**
   * Get wallet address by student ID
   * @param studentId - student identifier
   * @returns Promise<string>
   */
  async getStudentAddress(studentId: string): Promise<string> {
    return await this.executeCall("getStudentAddress", studentId);
  }

  /**
   * Check if a student ID is registered
   * @param studentId - student identifier to check
   * @returns Promise<boolean>
   */
  async isStudentRegistered(studentId: string): Promise<boolean> {
    try {
      const address = await this.getStudentAddress(studentId);
      return address !== "0x0000000000000000000000000000000000000000";
    } catch {
      return false;
    }
  }

  /**
   * Check if an address is registered as a student
   * @param address - wallet address to check
   * @returns Promise<boolean>
   */
  async isAddressRegistered(address: string): Promise<boolean> {
    try {
      const studentId = await this.getStudentId(address);
      return studentId !== "";
    } catch {
      return false;
    }
  }

  /**
   * Get current user's student ID
   * @returns Promise<string>
   */
  async getCurrentUserStudentId(): Promise<string> {
    const currentAddress = await this.getCurrentAddress();
    return await this.getStudentId(currentAddress);
  }

  /**
   * Check if current user is a registered student
   * @returns Promise<boolean>
   */
  async isCurrentUserRegistered(): Promise<boolean> {
    const currentAddress = await this.getCurrentAddress();
    return await this.isAddressRegistered(currentAddress);
  }

  /**
   * Update student wallet address (for when student changes wallet)
   * @param studentId - student identifier
   * @param newAddress - new wallet address
   * @returns Promise<void>
   */
  async updateStudentAddress(
    studentId: string,
    newAddress: string
  ): Promise<void> {
    await this.executeTransaction(
      "updateStudentAddress",
      studentId,
      newAddress
    );
  }

  /**
   * Unregister a student
   * @param studentId - student identifier to unregister
   * @returns Promise<void>
   */
  async unregisterStudent(studentId: string): Promise<void> {
    await this.executeTransaction("unregisterStudent", studentId);
  }

  /**
   * Get student details by ID
   * @param studentId - student identifier
   * @returns Promise<Student>
   */
  async getStudentDetails(studentId: string): Promise<Student> {
    const address = await this.getStudentAddress(studentId);
    const isActive = await this.isStudentRegistered(studentId);

    return {
      studentId,
      address,
      isActive,
    };
  }

  /**
   * Get student details by address
   * @param address - wallet address
   * @returns Promise<Student>
   */
  async getStudentDetailsByAddress(address: string): Promise<Student> {
    const studentId = await this.getStudentId(address);
    const isActive = await this.isAddressRegistered(address);

    return {
      studentId,
      address,
      isActive,
    };
  }

  /**
   * Bulk register students
   * @param students - array of {studentId, address} objects
   * @returns Promise<void>
   */
  async bulkRegisterStudents(
    students: { studentId: string; address: string }[]
  ): Promise<void> {
    // For now, register one by one. Could be optimized with a bulk contract method
    for (const student of students) {
      try {
        await this.registerStudent(student.studentId, student.address);
      } catch (error) {
        console.error(
          `Failed to register student ${student.studentId}:`,
          error
        );
        // Continue with next student instead of failing the entire batch
      }
    }
  }

  /**
   * Search students by partial student ID
   * @param searchTerm - partial student ID to search for
   * @returns Promise<Student[]> - Note: This is a simplified search, real implementation would need events
   */
  async searchStudents(searchTerm: string): Promise<Student[]> {
    // Note: This is a placeholder implementation
    // In a real scenario, you'd need to index student registrations via events
    // or have a separate search service
    console.warn(
      "Student search not fully implemented - requires event indexing"
    );
    return [];
  }

  /**
   * Get total number of registered students
   * @returns Promise<number>
   */
  async getTotalStudents(): Promise<number> {
    // This would require a counter in the contract or event counting
    // For now, return 0 as placeholder
    console.warn(
      "Total students count not implemented - requires contract modification"
    );
    return 0;
  }

  /**
   * Validate student ID format
   * @param studentId - student ID to validate
   * @returns boolean
   */
  validateStudentIdFormat(studentId: string): boolean {
    // Basic validation - customize based on your requirements
    return (
      studentId.length >= 3 &&
      studentId.length <= 50 &&
      /^[a-zA-Z0-9_-]+$/.test(studentId)
    );
  }

  /**
   * Register current user as student
   * @param studentId - student identifier for current user
   * @returns Promise<void>
   */
  async registerCurrentUser(studentId: string): Promise<void> {
    if (!this.validateStudentIdFormat(studentId)) {
      throw new Error("Invalid student ID format");
    }

    await this.registerStudent(studentId);
  }

  /**
   * Check if student can access records
   * @param studentId - student identifier
   * @returns Promise<boolean>
   */
  async canStudentAccessRecords(studentId: string): Promise<boolean> {
    return await this.isStudentRegistered(studentId);
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
export const studentManagementService = new StudentManagementService(
  process.env.NEXT_PUBLIC_STUDENT_MANAGEMENT_CONTRACT_ADDRESS || ""
);
