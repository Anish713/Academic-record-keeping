import Link from 'next/link';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full py-8 bg-white border-t">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-full bg-navy-700 flex items-center justify-center">
                <span className="text-gray-700 hover:text-navy-700 transition-colors font-bold">Logo </span>
              </div>
              <span className="text-sm text-gray-600">
                Academic Record Store
              </span>
            </div>
          </div>

          <div className="flex space-x-6 mb-4 md:mb-0">
            <Link href="/privacy-policy" className="text-sm text-gray-600 hover:text-navy-700 transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms-conditions" className="text-sm text-gray-600 hover:text-navy-700 transition-colors">
              Terms & Conditions
            </Link>
            <a href="mailto:anish@blockchain.com" className="text-sm text-gray-600 hover:text-navy-700 transition-colors">
              anish@blockchain.com
            </a>
          </div>
        </div>

        <div className="mt-8 text-center text-sm text-gray-500">
          © {currentYear} Blockchain Fellowship Team. All Rights Reserved.
        </div>
      </div>
    </footer>
  );
}