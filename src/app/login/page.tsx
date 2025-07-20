"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import MainLayout from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/Button";
import { blockchainService } from "@/services/blockchain";

/**
 * Renders the login page, allowing users to connect an Ethereum wallet for role-based access or verify a record by ID.
 *
 * Provides wallet connection with role detection (admin or university) and redirects users accordingly. Displays error messages for connection issues and offers an alternative verification method without a wallet.
 *
 * @returns The login page React element.
 */
export default function LoginPage() {
  const router = useRouter();
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState("");

  const connectWallet = async () => {
    setIsConnecting(true);
    setError("");

    try {
      const success = await blockchainService.init();
      if (!success) {
        throw new Error("Failed to initialize blockchain service");
      }

      const address = await blockchainService.getCurrentAddress();

      const isAdmin = await blockchainService.hasRole("ADMIN_ROLE", address);
      const isUniversity = await blockchainService.hasRole(
        "UNIVERSITY_ROLE",
        address
      );

      if (isAdmin) {
        router.push("/admin");
      } else if (isUniversity) {
        router.push("/dashboard");
      } else {
        setError("Your wallet is not associated with a valid role.");
      }
    } catch (err: any) {
      console.error("Error connecting wallet:", err.message || err);
      if (err.message?.includes("MetaMask is not installed")) {
        setError(
          "MetaMask is not installed. Please install MetaMask to continue."
        );
      } else if (err.message?.includes("User rejected")) {
        setError("You denied wallet connection. Please try again.");
      } else {
        setError("Failed to connect wallet. Please try again.");
      }
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-md mx-auto py-16 px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-4">Login</h1>
          <p className="text-white">
            Connect your wallet to access your academic records or university
            dashboard.
          </p>
        </div>

        <div className="bg-white shadow-md rounded-lg p-8">
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-medium text-gray-900 mb-4">
                Connect Wallet
              </h2>
              <p className="text-sm text-gray-600 mb-6">
                Connect your Ethereum wallet to securely access the platform. We
                support MetaMask and other Web3 wallets.
              </p>

              <Button
                variant="navy"
                className="w-full py-3 flex items-center justify-center text-gray-700 hover:text-navy-700 transition-colors"
                onClick={connectWallet}
                disabled={isConnecting}
                aria-busy={isConnecting}
                aria-live="polite"
              >
                {isConnecting ? (
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    />
                  </svg>
                ) : null}
                {isConnecting ? "Connecting..." : "Connect Wallet"}
              </Button>

              {error && (
                <p className="mt-4 text-sm text-red-600" role="alert">
                  {error}
                </p>
              )}
            </div>

            <div className="pt-6 border-t border-gray-200">
              <h2 className="text-xl font-medium text-gray-900 mb-4">
                Access with ID
              </h2>
              <p className="text-sm text-gray-600 mb-6">
                If you have a record ID, you can verify it without connecting a
                wallet.
              </p>

              <Button
                variant="outline"
                className="w-full py-3"
                onClick={() => router.push("/verify")}
              >
                Verify Record
              </Button>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
