import { ethers } from "ethers";
import { BaseContractService } from "./base-contract.service";
import RoleManager from "../../contracts/RoleManager.json";

/**
 * Role types enum for better type safety
 */
export enum UserRole {
  ADMIN_ROLE = "ADMIN_ROLE",
  UNIVERSITY_ROLE = "UNIVERSITY_ROLE",
  SUPER_ADMIN_ROLE = "SUPER_ADMIN_ROLE",
}

/**
 * Role Management Service
 * Handles role-based access control (RBAC) operations
 */
export class RoleManagementService extends BaseContractService {
  private readonly ADMIN_ROLE_HASH: string;
  private readonly UNIVERSITY_ROLE_HASH: string;
  private readonly SUPER_ADMIN_ROLE_HASH: string;

  constructor(contractAddress: string) {
    super(contractAddress, RoleManager.abi);

    // Pre-compute role hashes
    this.ADMIN_ROLE_HASH = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_ROLE"));
    this.UNIVERSITY_ROLE_HASH = ethers.keccak256(
      ethers.toUtf8Bytes("UNIVERSITY_ROLE")
    );
    this.SUPER_ADMIN_ROLE_HASH = ethers.keccak256(
      ethers.toUtf8Bytes("SUPER_ADMIN_ROLE")
    );
  }

  /**
   * Get role hash for a given role type
   * @param role - role type
   * @returns string - role hash
   */
  private getRoleHash(role: UserRole): string {
    switch (role) {
      case UserRole.ADMIN_ROLE:
        return this.ADMIN_ROLE_HASH;
      case UserRole.UNIVERSITY_ROLE:
        return this.UNIVERSITY_ROLE_HASH;
      case UserRole.SUPER_ADMIN_ROLE:
        return this.SUPER_ADMIN_ROLE_HASH;
      default:
        throw new Error(`Invalid role: ${role}`);
    }
  }

  /**
   * Check if an address has a specific role
   * @param role - role to check
   * @param address - address to check
   * @returns Promise<boolean>
   */
  async hasRole(role: UserRole, address: string): Promise<boolean> {
    const roleHash = this.getRoleHash(role);
    return await this.executeCall("hasRole", roleHash, address);
  }

  /**
   * Grant a role to an address
   * @param role - role to grant
   * @param address - address to grant role to
   * @returns Promise<void>
   */
  async grantRole(role: UserRole, address: string): Promise<void> {
    const roleHash = this.getRoleHash(role);
    await this.executeTransaction("grantRole", roleHash, address);
  }

  /**
   * Revoke a role from an address
   * @param role - role to revoke
   * @param address - address to revoke role from
   * @returns Promise<void>
   */
  async revokeRole(role: UserRole, address: string): Promise<void> {
    const roleHash = this.getRoleHash(role);
    await this.executeTransaction("revokeRole", roleHash, address);
  }

  /**
   * Get all addresses with a specific role
   * @param role - role to get addresses for
   * @returns Promise<string[]>
   */
  async getRoleMembers(role: UserRole): Promise<string[]> {
    const roleHash = this.getRoleHash(role);
    const memberCount = await this.executeCall("getRoleMemberCount", roleHash);

    const members: string[] = [];
    for (let i = 0; i < Number(memberCount); i++) {
      const member = await this.executeCall("getRoleMember", roleHash, i);
      members.push(member);
    }

    return members;
  }

  /**
   * Get the admin role for a specific role (who can grant/revoke this role)
   * @param role - role to get admin for
   * @returns Promise<string>
   */
  async getRoleAdmin(role: UserRole): Promise<string> {
    const roleHash = this.getRoleHash(role);
    return await this.executeCall("getRoleAdmin", roleHash);
  }

  /**
   * Check if current user has admin privileges
   * @returns Promise<boolean>
   */
  async isCurrentUserAdmin(): Promise<boolean> {
    const currentAddress = await this.getCurrentAddress();
    return await this.hasRole(UserRole.ADMIN_ROLE, currentAddress);
  }

  /**
   * Check if current user has super admin privileges
   * @returns Promise<boolean>
   */
  async isCurrentUserSuperAdmin(): Promise<boolean> {
    const currentAddress = await this.getCurrentAddress();
    return await this.hasRole(UserRole.SUPER_ADMIN_ROLE, currentAddress);
  }

  /**
   * Check if current user has university privileges
   * @returns Promise<boolean>
   */
  async isCurrentUserUniversity(): Promise<boolean> {
    const currentAddress = await this.getCurrentAddress();
    return await this.hasRole(UserRole.UNIVERSITY_ROLE, currentAddress);
  }

  /**
   * Get current user's roles
   * @returns Promise<UserRole[]>
   */
  async getCurrentUserRoles(): Promise<UserRole[]> {
    const currentAddress = await this.getCurrentAddress();
    const roles: UserRole[] = [];

    for (const role of Object.values(UserRole)) {
      if (await this.hasRole(role, currentAddress)) {
        roles.push(role);
      }
    }

    return roles;
  }

  /**
   * Get all admins
   * @returns Promise<string[]>
   */
  async getAllAdmins(): Promise<string[]> {
    return await this.getRoleMembers(UserRole.ADMIN_ROLE);
  }

  /**
   * Get all universities
   * @returns Promise<string[]>
   */
  async getAllUniversityAddresses(): Promise<string[]> {
    return await this.getRoleMembers(UserRole.UNIVERSITY_ROLE);
  }

  /**
   * Add a new admin
   * @param adminAddress - address to make admin
   * @returns Promise<void>
   */
  async addAdmin(adminAddress: string): Promise<void> {
    await this.grantRole(UserRole.ADMIN_ROLE, adminAddress);
  }

  /**
   * Remove an admin
   * @param adminAddress - admin address to remove
   * @returns Promise<void>
   */
  async removeAdmin(adminAddress: string): Promise<void> {
    await this.revokeRole(UserRole.ADMIN_ROLE, adminAddress);
  }

  /**
   * Add a university
   * @param universityAddress - address to make university
   * @returns Promise<void>
   */
  async addUniversity(universityAddress: string): Promise<void> {
    await this.grantRole(UserRole.UNIVERSITY_ROLE, universityAddress);
  }

  /**
   * Remove a university
   * @param universityAddress - university address to remove
   * @returns Promise<void>
   */
  async removeUniversity(universityAddress: string): Promise<void> {
    await this.revokeRole(UserRole.UNIVERSITY_ROLE, universityAddress);
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
export const roleManagementService = new RoleManagementService(
  process.env.NEXT_PUBLIC_ACADEMIC_RECORDS_CONTRACT_ADDRESS || ""
);
