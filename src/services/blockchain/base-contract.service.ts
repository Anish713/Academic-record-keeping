import { ethers } from "ethers";
import { walletService } from "./wallet.service";

/**
 * Base Contract Service
 * Provides common functionality for all contract services
 */
export abstract class BaseContractService {
  protected contract: ethers.Contract | null = null;
  protected contractAddress: string;
  protected contractABI: any;

  constructor(contractAddress: string, contractABI: any) {
    this.contractAddress = contractAddress;
    this.contractABI = contractABI;
  }

  /**
   * Initialize the contract with the current signer
   * @returns Promise<boolean> - success status
   */
  async init(): Promise<boolean> {
    try {
      const signer = walletService.getSigner();
      if (!signer) {
        throw new Error("Wallet not connected");
      }

      if (!this.contractAddress) {
        throw new Error("Contract address not configured");
      }

      this.contract = new ethers.Contract(
        this.contractAddress,
        this.contractABI,
        signer
      );

      return true;
    } catch (error) {
      console.error("Contract initialization failed:", error);
      return false;
    }
  }

  /**
   * Ensure contract is initialized before operations
   * @throws Error if contract is not initialized
   */
  protected ensureContract(): void {
    if (!this.contract) {
      throw new Error("Contract not initialized. Call init() first.");
    }
  }

  /**
   * Get the contract instance
   * @returns ethers.Contract | null
   */
  getContract(): ethers.Contract | null {
    return this.contract;
  }

  /**
   * Get the contract address
   * @returns string
   */
  getContractAddress(): string {
    return this.contractAddress;
  }

  /**
   * Update contract address (useful for redeployments)
   * @param newAddress - new contract address
   */
  updateContractAddress(newAddress: string): void {
    this.contractAddress = newAddress;
    // Reset contract instance to force re-initialization
    this.contract = null;
  }

  /**
   * Check if contract is initialized
   * @returns boolean
   */
  isInitialized(): boolean {
    return this.contract !== null;
  }

  /**
   * Execute a contract transaction and wait for confirmation
   * @param methodName - contract method name
   * @param args - method arguments
   * @returns Promise<ethers.TransactionReceipt>
   */
  protected async executeTransaction(
    methodName: string,
    ...args: any[]
  ): Promise<ethers.TransactionReceipt> {
    this.ensureContract();

    const tx = await this.contract![methodName](...args);
    return await tx.wait();
  }

  /**
   * Execute a contract view/pure function
   * @param methodName - contract method name
   * @param args - method arguments
   * @returns Promise<any>
   */
  protected async executeCall(
    methodName: string,
    ...args: any[]
  ): Promise<any> {
    this.ensureContract();
    return await this.contract![methodName](...args);
  }

  /**
   * Parse logs from transaction receipt
   * @param receipt - transaction receipt
   * @param eventName - event name to parse
   * @returns any[] - parsed events
   */
  protected parseEvents(
    receipt: ethers.TransactionReceipt,
    eventName: string
  ): any[] {
    this.ensureContract();

    const events: any[] = [];
    receipt.logs?.forEach((log) => {
      try {
        const parsed = this.contract!.interface.parseLog(log);
        if (parsed?.name === eventName) {
          events.push(parsed);
        }
      } catch (e) {
        // Log parsing failed, skip this log
      }
    });

    return events;
  }

  /**
   * Get a single event from transaction receipt
   * @param receipt - transaction receipt
   * @param eventName - event name to parse
   * @returns any | null
   */
  protected getEvent(
    receipt: ethers.TransactionReceipt,
    eventName: string
  ): any | null {
    const events = this.parseEvents(receipt, eventName);
    return events.length > 0 ? events[0] : null;
  }
}
