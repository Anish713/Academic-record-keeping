import { ethers } from "ethers";

/**
 * Wallet Connection and Provider Service
 * Handles MetaMask connection, provider initialization, and signer management
 */
export class WalletService {
  private provider: ethers.BrowserProvider | null = null;
  private signer: ethers.Signer | null = null;

  /**
   * Initialize MetaMask connection and provider
   * @returns Promise<boolean> - success status
   */
  async connect(): Promise<boolean> {
    try {
      if (typeof window === "undefined" || !window.ethereum) {
        console.error("MetaMask is not installed");
        return false;
      }

      this.provider = new ethers.BrowserProvider(window.ethereum);
      await this.provider.send("eth_requestAccounts", []);
      this.signer = await this.provider.getSigner();

      return true;
    } catch (error) {
      console.error("Wallet connection failed:", error);
      return false;
    }
  }

  /**
   * Get the current provider instance
   * @returns ethers.BrowserProvider | null
   */
  getProvider(): ethers.BrowserProvider | null {
    return this.provider;
  }

  /**
   * Get the current signer instance
   * @returns ethers.Signer | null
   */
  getSigner(): ethers.Signer | null {
    return this.signer;
  }

  /**
   * Get the current connected address
   * @returns Promise<string> - wallet address
   */
  async getCurrentAddress(): Promise<string> {
    if (!this.signer) {
      throw new Error("Wallet not connected");
    }
    return await this.signer.getAddress();
  }

  /**
   * Check if wallet is connected
   * @returns boolean
   */
  isConnected(): boolean {
    return this.provider !== null && this.signer !== null;
  }

  /**
   * Disconnect wallet and reset state
   */
  disconnect(): void {
    this.provider = null;
    this.signer = null;
  }

  /**
   * Request account change from MetaMask
   * @returns Promise<void>
   */
  async requestAccountChange(): Promise<void> {
    if (!this.provider) {
      throw new Error("Provider not initialized");
    }
    await this.provider.send("wallet_requestPermissions", [
      { eth_accounts: {} },
    ]);
  }

  /**
   * Get network information
   * @returns Promise<ethers.Network>
   */
  async getNetwork(): Promise<ethers.Network> {
    if (!this.provider) {
      throw new Error("Provider not initialized");
    }
    return await this.provider.getNetwork();
  }

  /**
   * Get account balance
   * @param address - address to check balance for (optional, defaults to current address)
   * @returns Promise<string> - balance in ETH
   */
  async getBalance(address?: string): Promise<string> {
    if (!this.provider) {
      throw new Error("Provider not initialized");
    }

    const targetAddress = address || (await this.getCurrentAddress());
    const balance = await this.provider.getBalance(targetAddress);
    return ethers.formatEther(balance);
  }
}

// Export singleton instance
export const walletService = new WalletService();
