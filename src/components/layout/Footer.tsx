"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

/**
 * Renders the footer section with branding, navigation links, and contact information.
 *
 * Displays a logo, the application name, links to privacy policy and terms & conditions pages, a contact email, and a dynamic copyright.
 */
export default function Footer() {
  const currentYear = new Date().getFullYear();
  const router = useRouter();

  return (
    <footer className="w-full py-8 bg-white border-t">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center overflow-hidden border border-gray-200">
                <Image
                  src="/favicon.ico"
                  alt="CertiChain Logo"
                  width={32}
                  height={32}
                  className="w-full h-full object-contain"
                />
              </div>
              <span className="text-sm text-gray-600">
                CertiChain | Academic Record Store
              </span>
            </div>
          </div>

          <div className="flex space-x-6 mb-4 md:mb-0">
            <button
              type="button"
              onClick={() => router.push("/privacy-policy")}
              className="text-sm text-gray-600 hover:text-navy-700 transition-colors"
            >
              Privacy Policy
            </button>
            <button
              type="button"
              onClick={() => router.push("/terms-conditions")}
              className="text-sm text-gray-600 hover:text-navy-700 transition-colors"
            >
              Terms & Conditions
            </button>
            <a
              href="mailto:anish@blockchain.com"
              className="text-sm text-gray-600 hover:text-navy-700 transition-colors"
            >
              anish@blockchain.com
            </a>
          </div>
        </div>

        <div className="mt-8 text-center text-sm text-gray-500">
          © {currentYear} Anish Shrestha. All Rights Reserved.
        </div>
      </div>
    </footer>
  );
}
