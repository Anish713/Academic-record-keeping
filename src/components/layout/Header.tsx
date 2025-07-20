"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { truncateAddress } from "@/lib/utils";
import { blockchainService } from "@/services/blockchain";

/**
 * Renders the application header with role-based navigation and wallet connection status.
 *
 * Displays navigation buttons based on the user's blockchain roles (university, admin, super admin, or student) and shows either the connected wallet address or a login button. Handles wallet connection and role detection on mount.
 */
export default function Header() {
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState("");
  const [isUniversity, setIsUniversity] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const connectWallet = async () => {
      try {
        const initialized = await blockchainService.init();
        if (!initialized) return;

        const userAddress = await blockchainService.getCurrentAddress();
        if (!userAddress) return;

        setIsConnected(true);
        setAddress(userAddress);

        const hasUniversityRole = await blockchainService.hasRole(
          "UNIVERSITY_ROLE",
          userAddress
        );
        const hasAdminRole = await blockchainService.hasRole(
          "ADMIN_ROLE",
          userAddress
        );
        const hasSuperAdminRole = await blockchainService.hasRole(
          "SUPER_ADMIN_ROLE",
          userAddress
        );

        setIsUniversity(hasUniversityRole);
        setIsAdmin(hasAdminRole);
        setIsSuperAdmin(hasSuperAdminRole);
      } catch (error) {
        console.error("Failed to connect wallet:", error);
      }
    };

    connectWallet();
  }, []);

  const isActive = (path: string) =>
    pathname === path
      ? "text-black font-bold border-b-2 border-blue-700 pb-1"
      : "text-gray-700";

  return (
    <header className="w-full py-4 px-6 bg-white shadow-sm">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <button
            className="flex items-center"
            onClick={() => router.push("/")}
            type="button"
          >
            <div className="flex items-center space-x-2">
              <div
                className="w-10 h-10 rounded-full bg-white flex items-center justify-center overflow-hidden border border-gray-200"
                style={{ background: "white" }}
              >
                <Image
                  src="/favicon.ico"
                  alt="CertiChain Logo"
                  width={40}
                  height={40}
                  className="w-full h-full object-contain bg-white"
                />
              </div>
              <span className="text-md text-gray-600">CertiChain</span>
            </div>
          </button>
        </div>

        <nav className="hidden md:flex items-center space-x-6">
          <button
            className={`${isActive("/")} hover:text-navy-700 transition-colors`}
            onClick={() => router.push("/")}
            type="button"
          >
            Home
          </button>
          <button
            className={`${isActive(
              "/records"
            )} hover:text-navy-700 transition-colors`}
            onClick={() => router.push("/records")}
            type="button"
          >
            Records
          </button>
          <button
            className={`${isActive(
              "/verify"
            )} hover:text-navy-700 transition-colors`}
            onClick={() => router.push("/verify")}
            type="button"
          >
            Verify
          </button>
          <button
            className={`${isActive(
              "/about"
            )} hover:text-navy-700 transition-colors`}
            onClick={() => router.push("/about")}
            type="button"
          >
            About
          </button>
          {(isAdmin || isSuperAdmin) && (
            <button
              className={`${isActive(
                "/admin"
              )} hover:text-navy-600 px-3 py-2 rounded-md text-sm font-medium`}
              onClick={() => router.push("/admin")}
              type="button"
            >
              {isSuperAdmin ? "Super Admin" : "Admin"}
            </button>
          )}
          {isUniversity && (
            <button
              className={`${isActive(
                "/dashboard"
              )} hover:text-navy-600 px-3 py-2 rounded-md text-sm font-medium`}
              onClick={() => router.push("/dashboard")}
              type="button"
            >
              Dashboard
            </button>
          )}
          {isConnected && !isUniversity && !isAdmin && !isSuperAdmin && (
            <button
              className={`${isActive(
                "/student"
              )} hover:text-navy-600 px-3 py-2 rounded-md text-sm font-medium`}
              onClick={() => router.push("/student")}
              type="button"
            >
              Student Dashboard
            </button>
          )}
        </nav>

        <div className="flex items-center space-x-4">
          {isConnected ? (
            <div className="text-sm text-gray-700 font-medium">
              {truncateAddress(address)}
            </div>
          ) : (
            <Button
              variant="navy"
              className="bg-yellow-400 hover:bg-yellow-300 text-black font-bold border-2 border-yellow-500 shadow-lg"
              onClick={() => router.push("/login")}
            >
              Login →
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
